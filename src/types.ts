/**
 * Configuration for the GithubCDN SDK.
 */
export interface CDNConfig {
    /** GitHub Personal Access Token with repo scope */
    token: string;
    /** GitHub organization or username */
    owner: string;
    /** GitHub repository name */
    repo: string;
    /** Branch to use for storage (default: 'main') */
    branch?: string;
    /** User Agent string for GitHub API requests */
    userAgent?: string;
}

/**
 * Metadata for a file asset stored in the CDN.
 */
export interface CDNAsset {
    /** Robust unique ID (typically timestamp_randomHex) */
    id: string;
    /** Original safe filename */
    name: string;
    /** Total file size in bytes */
    size: number;
    /** MIME type (e.g., 'video/mp4') */
    type: string;
    /** Relative path within the repository */
    path: string;
    /** ISO timestamp of upload */
    uploadedAt: string;
    /** Links to the asset across different providers */
    links: CDNLinks;
}

/**
 * High-resolution progress data for long operations.
 */
export interface CDNProgress {
    /** Overall completion percentage (0-100) */
    percentage: number;
    /** Current chunk being processed */
    currentChunk: number;
    /** Total number of chunks */
    totalChunks: number;
    /** Byte count transferred so far */
    loaded: number;
    /** Total byte count */
    total: number;
    /** Current operation description */
    stage: string;
}

/**
 * Asset links across major providers.
 */
export interface CDNLinks {
    /** Primary JSDelivr link */
    cdn: string;
    /** Fastly JSDelivr mirror */
    fastly: string;
    /** Direct GitHub RAW link (authenticated needed for private) */
    raw: string;
    /** Direct Vercel / Origin proxy link */
    origin: string;
}

/**
 * Internal manifest structure for reconstruction.
 */
export interface CDNManifest {
    id: string;
    fileName: string;
    uniqueId: string;
    totalChunks: number;
    chunkSize: number;
    totalSize: number;
    mimeType: string;
    pathPrefix: string;
    uploadedAt: string;
    optimized: boolean;
}

/**
 * Log entry for streaming updates.
 */
export interface CDNLog {
    type: "log" | "error" | "done" | "progress";
    message: string;
    logType?: "info" | "success" | "error" | "warning" | "process";
    progress?: CDNProgress;
    asset?: CDNAsset;
    [key: string]: any;
}
