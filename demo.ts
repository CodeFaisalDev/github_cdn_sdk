import { GithubCDN } from "./src/index.js";
import fs from "fs/promises";

/**
 * GithubCDN SDK: Full Lifecycle Demo
 * 1. Initialize
 * 2. Upload a file
 * 3. Fetch its stream
 * 4. Permanently delete
 */
async function runDemo() {
    // ---- 1. INITIALIZATION ----
    const cdn = new GithubCDN({
        token: "your_github_token_here",
        owner: "your_github_username",
        repo: "your_cdn_storage_repo",
        branch: "main"
    });

    try {
        // ---- 2. ATOMIC UPLOAD ----
        console.log("--- Starting Upload ---");
        const fileBuffer = await fs.readFile("./demo-video.mp4");

        const asset = await cdn.upload({
            name: "demo-video.mp4",
            type: "video/mp4",
            buffer: fileBuffer.buffer as ArrayBuffer
        }, (log) => {
            if (log.type === "progress") {
                console.log(`[Progress] ${log.progress?.percentage}% - ${log.progress?.stage}`);
            } else {
                console.log(`[Log] ${log.message}`);
            }
        });

        console.log("\n✅ Asset Uploaded Successfully!");
        console.log("Asset ID:", asset.id);
        console.log("JSDelivr CDN URL:", asset.links.cdn);
        console.log("GitHub Raw URL:", asset.links.raw);

        // ---- 3. HYBRID FETCH (RECONSTRUCTION) ----
        console.log("\n--- Starting Fetch (Streaming) ---");
        const { stream, manifest } = await cdn.fetch(asset.path, (log) => {
            console.log(`[Fetch Status] ${log.message}`);
        });

        console.log("Detected MIME Type:", manifest.mimeType);
        console.log("Total Size:", manifest.totalSize, "bytes");

        // Example: Consuming the stream
        const reader = stream.getReader();
        let totalReceived = 0;
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            totalReceived += value.length;
        }
        console.log(`✅ Fully reconstructed ${totalReceived} bytes.`);

        // ---- 4. PHYSICAL PURGE ----
        console.log("\n--- Starting Physical Purge ---");
        const success = await cdn.delete(asset.id, asset.path, (log) => {
            console.log(`[Purge Status] ${log.message}`);
        });

        if (success) {
            console.log("✅ Asset permanently scrubbed from GitHub history.");
        }

    } catch (error: any) {
        console.error("\n❌ Demo Failed:", error.message);
    }
}

console.log("Note: Replace 'your_github_token_here' etc. before running this demo.");
// runDemo();
