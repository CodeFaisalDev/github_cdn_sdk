import { CDNConfig, CDNAsset, CDNManifest, CDNLog, CDNLinks } from "./types.js";
export * from "./types.js";
/**
 * GithubCDN Universal SDK: A production-grade library for decentralized asset delivery.
 * Works seamlessly in Node.js, Vercel Edge, and the Browser.
 */
export declare class GithubCDN {
    /** SDK Version */
    static readonly version: string;
    private config;
    /**
     * Initializes the GithubCDN client.
     * @param config - Configuration object containing token, owner, and repo.
     * @example
     * const cdn = new GithubCDN({ token: "...", owner: "...", repo: "..." });
     */
    constructor(config: CDNConfig);
    /**
     * Verifies connection and credentials by pinging the repository.
     * @returns Promise<boolean> - True if the repository is accessible.
     */
    ping(): Promise<boolean>;
    /**
     * Internal REST API client.
     */
    private request;
    /**
     * Resolves all public URLs for a given asset.
     * @param asset - Object containing path and id of the asset.
     * @returns CDNLinks - Object containing URLs for different providers.
     */
    resolveLinks(asset: {
        path: string;
        id: string;
    }): CDNLinks;
    /**
     * Lists current assets from the global registry.
     * @returns Promise<CDNAsset[]> - Array of registered assets.
     */
    list(): Promise<CDNAsset[]>;
    /**
     * High-Performance Physical Purge (Removes asset folders from Git history).
     * @param id - Unique asset ID.
     * @param folderPath - Path to the asset folder in the repo.
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<boolean> - True if successful.
     */
    delete(id: string, folderPath: string, onUpdate?: (log: CDNLog) => void): Promise<boolean>;
    getRef(branch?: string): Promise<string>;
    createBlob(content: Buffer | Uint8Array | ArrayBuffer): Promise<string>;
    createTree(baseSha: string, items: {
        path: string;
        mode: string;
        type: string;
        sha: string;
    }[]): Promise<string>;
    createCommit(message: string, treeSha: string, parents: string[]): Promise<string>;
    updateRef(commitSha: string, branch?: string): Promise<void>;
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
    upload(input: File | Blob | Buffer | {
        name: string;
        type: string;
        buffer: ArrayBuffer;
    }, onUpdate?: (log: CDNLog) => void): Promise<CDNAsset>;
    /**
     * Hybrid Multi-Source Retrieval.
     * Automatically races between jsDelivr CDN and GitHub Raw for maximum speed.
     *
     * @param assetPath - Repo-relative path to the asset.
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<{ stream: ReadableStream; manifest: CDNManifest }>
     */
    fetch(assetPath: string, onUpdate?: (log: CDNLog) => void): Promise<{
        stream: ReadableStream;
        manifest: CDNManifest;
    }>;
    /**
     * Resynchronizes the local registry by scanning the repository for "ghost" manifests.
     * Useful if registry.json is accidentally deleted or corrupted.
     *
     * @param onUpdate - Optional callback for streaming logs.
     * @returns Promise<{ recovered: number }> - Count of recovered assets.
     */
    sync(onUpdate?: (log: CDNLog) => void): Promise<{
        recovered: number;
    }>;
}
