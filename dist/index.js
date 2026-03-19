// Export all types for absolute compatibility
export * from "./types.js";
/**
 * GithubCDN Universal SDK: A production-grade library for decentralized asset delivery.
 * Works seamlessly in Node.js, Vercel Edge, and the Browser.
 */
export class GithubCDN {
    /** SDK Version */
    static version = "1.0.0";
    config;
    /**
     * Initializes the GithubCDN client.
     * @param config - Configuration object containing token, owner, and repo.
     * @example
     * const cdn = new GithubCDN({ token: "...", owner: "...", repo: "..." });
     */
    constructor(config) {
        this.config = {
            branch: "main",
            userAgent: `Github-CDN-SDK-v${GithubCDN.version}`,
            ...config,
        };
    }
    /**
     * Verifies connection and credentials by pinging the repository.
     * @returns Promise<boolean> - True if the repository is accessible.
     */
    async ping() {
        try {
            await this.request("");
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Internal REST API client.
     */
    async request(path, options = {}) {
        const url = `https://api.github.com/repos/${this.config.owner}/${this.config.repo}${path}`;
        const headers = {
            Authorization: `token ${this.config.token}`,
            "User-Agent": this.config.userAgent,
            Accept: "application/json",
            ...options.headers,
        };
        const res = await fetch(url, { ...options, headers });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ message: res.statusText }));
            throw new Error(`GitHub API Error (${res.status}): ${err.message}`);
        }
        return res.json();
    }
    /**
     * Resolves all public URLs for a given asset.
     * @param asset - Object containing path and id of the asset.
     * @returns CDNLinks - Object containing URLs for different providers.
     */
    resolveLinks(asset) {
        const base = `https://cdn.jsdelivr.net/gh/${this.config.owner}/${this.config.repo}@${this.config.branch}/${asset.path}`;
        const links = {
            cdn: `${base}/manifest.json`,
            fastly: `https://fastly.jsdelivr.net/gh/${this.config.owner}/${this.config.repo}@${this.config.branch}/${asset.path}/manifest.json`,
            raw: `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${asset.path}/manifest.json`,
            origin: `/api/fetch?file=${asset.path}` // Standard proxy convention
        };
        return links;
    }
    /**
     * Lists current assets from the global registry.
     * @returns Promise<CDNAsset[]> - Array of registered assets.
     */
    async list() {
        try {
            const res = await this.request(`/contents/registry.json`);
            const assets = JSON.parse(Buffer.from(res.content, "base64").toString("utf-8"));
            // Inject links dynamically if missing
            return assets.map(a => ({ ...a, links: a.links || this.resolveLinks(a) }));
        }
        catch (e) {
            return [];
        }
    }
    /**
     * High-Performance Physical Purge (Removes asset folders from Git history).
     * @param id - Unique asset ID.
     * @param folderPath - Path to the asset folder in the repo.
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<boolean> - True if successful.
     */
    async delete(id, folderPath, onUpdate) {
        const emit = (message, logType = "process") => {
            onUpdate?.({ type: "log", message, logType });
        };
        emit(`Purging entry: ${id}`, "warning");
        const ref = await this.request(`/git/refs/heads/${this.config.branch}`);
        const headSha = ref.object.sha;
        emit("Filtering repository tree...", "info");
        const treeData = await this.request(`/git/trees/${headSha}?recursive=1`);
        const filtered = treeData.tree.filter((i) => !i.path.startsWith(folderPath));
        emit("Patching registry index...", "info");
        const regNode = filtered.find((i) => i.path === "registry.json");
        const regBlob = await this.request(`/git/blobs/${regNode.sha}`);
        let registry = JSON.parse(Buffer.from(regBlob.content, "base64").toString("utf-8"));
        registry = registry.filter((a) => a.id !== id);
        const newReg = await this.request(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: Buffer.from(JSON.stringify(registry, null, 2)).toString("base64"), encoding: "base64" })
        });
        emit("Committing physical scrub...", "process");
        const finalTree = filtered
            .filter((i) => i.type === "blob")
            .map((i) => {
            if (i.path === "registry.json")
                return { path: i.path, mode: i.mode, type: i.type, sha: newReg.sha };
            return { path: i.path, mode: i.mode, type: i.type, sha: i.sha };
        });
        const newTree = await this.request(`/git/trees`, { method: "POST", body: JSON.stringify({ tree: finalTree }) });
        const commit = await this.request(`/git/commits`, {
            method: "POST",
            body: JSON.stringify({ message: `Scrub: ${id}`, tree: newTree.sha, parents: [headSha] })
        });
        await this.request(`/git/refs/heads/${this.config.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        emit("Purge verified.", "success");
        onUpdate?.({ type: "done", message: "Asset scrubbing complete." });
        return true;
    }
    async getRef(branch = this.config.branch) {
        const ref = await this.request(`/git/refs/heads/${branch}`);
        return ref.object.sha;
    }
    async createBlob(content) {
        const res = await this.request(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({
                content: Buffer.from(content).toString("base64"),
                encoding: "base64"
            })
        });
        return res.sha;
    }
    async createTree(baseSha, items) {
        const res = await this.request(`/git/trees`, {
            method: "POST",
            body: JSON.stringify({ base_tree: baseSha, tree: items })
        });
        return res.sha;
    }
    async createCommit(message, treeSha, parents) {
        const res = await this.request(`/git/commits`, {
            method: "POST",
            body: JSON.stringify({ message, tree: treeSha, parents })
        });
        return res.sha;
    }
    async updateRef(commitSha, branch = this.config.branch) {
        await this.request(`/git/refs/heads/${branch}`, {
            method: "PATCH",
            body: JSON.stringify({ sha: commitSha })
        });
    }
    /**
     * Universal Upload Method (Supports File, Blob, and Node Buffer).
     * Automatically handles chunking and atomic commits.
     *
     * @param input - File, Blob, or Buffer to upload.
     * @param onUpdate - Optional callback for progress and logs.
     * @returns Promise<CDNAsset> - The uploaded asset metadata.
     * @deprecated For Vercel/Serverless environments with small payload limits,
     * use granular methods if the file is extremely large.
     */
    async upload(input, onUpdate) {
        let name = "asset_" + Date.now();
        let type = "application/octet-stream";
        let buffer;
        if (input instanceof Blob) {
            type = input.type;
            if ("name" in input)
                name = input.name;
            buffer = await input.arrayBuffer();
        }
        else if (Buffer.isBuffer(input)) {
            buffer = input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
        }
        else if ("buffer" in input && input.buffer instanceof ArrayBuffer) {
            name = input.name;
            type = input.type;
            buffer = input.buffer;
        }
        else {
            throw new Error("Unsupported upload input Type. Use File, Blob, or Buffer.");
        }
        const CHUNK_SIZE = 5 * 1024 * 1024;
        const totalSize = buffer.byteLength;
        const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
        const uniqueId = Math.random().toString(36).substring(2, 10) + "_" + Date.now().toString(36);
        const now = new Date();
        const path = `uploads/${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, "0")}/${uniqueId}_${name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const emit = (message, logType = "process", progress) => {
            onUpdate?.({
                type: "log",
                message,
                logType,
                progress: progress ? {
                    percentage: Math.round(((progress.currentChunk || 0) / totalChunks) * 100),
                    currentChunk: progress.currentChunk || 0,
                    totalChunks,
                    loaded: (progress.currentChunk || 0) * CHUNK_SIZE,
                    total: totalSize,
                    stage: message
                } : undefined
            });
        };
        emit(`Inverting Data: ${name}`, "info", { currentChunk: 0 });
        const ref = await this.request(`/git/refs/heads/${this.config.branch}`);
        const baseSha = ref.object.sha;
        const treeItems = [];
        for (let i = 0; i < totalChunks; i++) {
            emit(`Pushing chunk ${i + 1}/${totalChunks}...`, "process", { currentChunk: i + 1 });
            const chunk = buffer.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, totalSize));
            const blob = await this.request(`/git/blobs`, {
                method: "POST",
                body: JSON.stringify({ content: Buffer.from(chunk).toString("base64"), encoding: "base64" })
            });
            treeItems.push({ path: `${path}/chunk_${i + 1}`, mode: "100644", type: "blob", sha: blob.sha });
        }
        emit("Finalizing manifest...", "info", { currentChunk: totalChunks });
        const manifest = {
            id: uniqueId, fileName: name, uniqueId, totalChunks, chunkSize: CHUNK_SIZE,
            totalSize, mimeType: type, pathPrefix: path, uploadedAt: now.toISOString(), optimized: true
        };
        const mBlob = await this.request(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: Buffer.from(JSON.stringify(manifest)).toString("base64"), encoding: "base64" })
        });
        treeItems.push({ path: `${path}/manifest.json`, mode: "100644", type: "blob", sha: mBlob.sha });
        emit("Synchronizing registry...", "info");
        const registry = await this.list();
        const newAsset = {
            id: uniqueId, name, size: totalSize, type, path, uploadedAt: now.toISOString(),
            links: this.resolveLinks({ path, id: uniqueId })
        };
        registry.unshift(newAsset);
        const rBlob = await this.request(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: Buffer.from(JSON.stringify(registry, null, 2)).toString("base64"), encoding: "base64" })
        });
        treeItems.push({ path: `registry.json`, mode: "100644", type: "blob", sha: rBlob.sha });
        emit("Creating atomic commit...", "process");
        const tree = await this.request(`/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: baseSha, tree: treeItems }) });
        const commit = await this.request(`/git/commits`, {
            method: "POST",
            body: JSON.stringify({ message: `CDN Upload: ${name}`, tree: tree.sha, parents: [baseSha] })
        });
        await this.request(`/git/refs/heads/${this.config.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        emit("Upload successful.", "success", { currentChunk: totalChunks });
        onUpdate?.({ type: "done", message: "Success", asset: newAsset });
        return newAsset;
    }
    /**
     * Hybrid Multi-Source Retrieval.
     * Automatically races between jsDelivr CDN and GitHub Raw for maximum speed.
     *
     * @param assetPath - Repo-relative path to the asset.
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<{ stream: ReadableStream; manifest: CDNManifest }>
     */
    async fetch(assetPath, onUpdate) {
        const emit = (message, logType = "process") => {
            onUpdate?.({ type: "log", message, logType });
        };
        const sources = [
            `https://cdn.jsdelivr.net/gh/${this.config.owner}/${this.config.repo}@${this.config.branch}/${assetPath}`,
            `https://raw.githubusercontent.com/${this.config.owner}/${this.config.repo}/${this.config.branch}/${assetPath}`
        ];
        const getManifest = async () => {
            try {
                const res = await fetch(`${sources[0]}/manifest.json`, { cache: 'no-store' });
                if (res.ok)
                    return { res, source: "Public CDN" };
                throw new Error();
            }
            catch {
                emit("CDN miss. Fetching via Auth...", "warning");
                const res = await fetch(`${sources[1]}/manifest.json`, {
                    headers: { 'Authorization': `token ${this.config.token}` },
                    cache: 'no-store'
                });
                return { res, source: "GitHub Auth" };
            }
        };
        const { res: mRes, source } = await getManifest();
        if (!mRes.ok)
            throw new Error("Manifest not found.");
        const manifest = await mRes.json();
        emit(`Verified via ${source}. Pipelining ${manifest.totalChunks} chunks.`, "success");
        const sdk = this;
        const stream = new ReadableStream({
            async start(controller) {
                const chunkMap = new Map();
                let next = 1;
                const download = async (i) => {
                    const get = async () => {
                        try {
                            const r = await fetch(`${sources[0]}/chunk_${i}`, { cache: 'no-store' });
                            if (r.ok)
                                return r;
                            throw new Error();
                        }
                        catch {
                            return fetch(`${sources[1]}/chunk_${i}`, {
                                headers: { 'Authorization': `token ${sdk.config.token}` },
                                cache: 'no-store'
                            });
                        }
                    };
                    const r = await get();
                    const b = await r.arrayBuffer();
                    chunkMap.set(i, new Uint8Array(b));
                    while (chunkMap.has(next)) {
                        controller.enqueue(chunkMap.get(next));
                        chunkMap.delete(next);
                        next++;
                    }
                };
                const workers = [];
                for (let i = 1; i <= manifest.totalChunks; i++) {
                    if (workers.length >= 10)
                        await Promise.race(workers);
                    const p = download(i);
                    workers.push(p);
                    p.finally(() => workers.splice(workers.indexOf(p), 1));
                }
                await Promise.all(workers);
                controller.close();
                emit("Stream finalized.", "success");
            }
        });
        return { stream, manifest };
    }
    /**
     * Resynchronizes the local registry by scanning the repository for "ghost" manifests.
     * Useful if registry.json is accidentally deleted or corrupted.
     *
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<{ recovered: number }> - Count of recovered assets.
     */
    async sync(onUpdate) {
        const emit = (message, logType = "process") => {
            onUpdate?.({ type: "log", message, logType });
        };
        emit("Scanning deep structure...", "info");
        const ref = await this.request(`/git/refs/heads/${this.config.branch}`);
        const tree = await this.request(`/git/trees/${ref.object.sha}?recursive=1`);
        const manifests = tree.tree.filter((i) => i.path.endsWith("manifest.json"));
        emit(`Found ${manifests.length} candidate manifests. Re-indexing...`, "process");
        const recovered = [];
        for (const m of manifests) {
            const blob = await this.request(`/git/blobs/${m.sha}`);
            const data = JSON.parse(Buffer.from(blob.content, "base64").toString("utf-8"));
            recovered.push({
                id: data.id,
                name: data.fileName,
                size: data.totalSize,
                type: data.mimeType,
                path: data.pathPrefix,
                uploadedAt: data.uploadedAt,
                links: this.resolveLinks({ path: data.pathPrefix, id: data.id })
            });
        }
        const rBlob = await this.request(`/git/blobs`, {
            method: "POST",
            body: JSON.stringify({ content: Buffer.from(JSON.stringify(recovered, null, 2)).toString("base64"), encoding: "base64" })
        });
        const newTree = await this.request(`/git/trees`, {
            method: "POST",
            body: JSON.stringify({ base_tree: ref.object.sha, tree: [{ path: "registry.json", mode: "100644", type: "blob", sha: rBlob.sha }] })
        });
        const commit = await this.request(`/git/commits`, {
            method: "POST",
            body: JSON.stringify({ message: "Registry Recon", tree: newTree.sha, parents: [ref.object.sha] })
        });
        await this.request(`/git/refs/heads/${this.config.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
        emit(`Recovery complete. ${recovered.length} assets synced.`, "success");
        return { recovered: recovered.length };
    }
}
