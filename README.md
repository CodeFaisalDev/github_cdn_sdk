# GithubCDN SDK 🚀

[![NPM Version](https://img.shields.io/npm/v/github-cdn-sdk?color=blue)](https://www.npmjs.com/package/github-cdn-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A professional, **zero-cost** TypeScript SDK for decentralized asset delivery. Use GitHub as your storage backend and jsDelivr/Cloudflare as your global edge network.

## why use this?
- **Zero Hosting Fees**: Leverages GitHub's free storage and jsDelivr's free global CDN.
- **Edge Native**: Works in Node.js, Vercel Edge, and Cloudflare Workers/Pages.
## 📊 Performance Comparison

| Metric | Without Cloudflare | With Cloudflare Edge |
|:---|:---|:---|
| **Large Asset (350MB)** | 180s - 300s+ | **0.7s** (Edge Cached) |
| **Medium Asset (50MB)** | 25s - 45s | **0.1s** (Edge Cached) |
| **TTFB** | 800ms–1500ms | **15ms–40ms** |
| **Scalability** | 5K req/hr | **Unlimited** (cached) |
| **Cost** | $0 | **$0** |

> **Real-world Benchmarks:** Using Cloudflare edge caching, a **350MB** file is delivered in just **0.7s**, while a standard GitHub fetch for a **50MB** file can take over **25s**.
- **Atomic Commits**: Uses the GitHub Git API to ensure asset uploads and registry updates are atomic.
- **Micro-Chunking**: Automatically splits large files to bypass GitHub's file size limits and optimize streaming.

---

## 📦 Installation

```bash
npm install github-cdn-sdk
```

## 🚀 Quick Start

### 1. Initialize the Client
```typescript
import { GithubCDN } from "github-cdn-sdk";

const cdn = new GithubCDN({
  token: process.env.GITHUB_TOKEN, // Fine-grained PAT with 'Contents' Read/Write
  owner: "your-username",
  repo: "assets-storage",
  branch: "main" // Optional, defaults to main
});
```

### 2. Upload with Progress
```typescript
const file = ...; // File, Blob, or Node.js Buffer
const asset = await cdn.upload(file, (log) => {
  if (log.progress) {
    console.log(`Upload progress: ${log.progress.percentage}%`);
  }
});

console.log("Live URL:", asset.links.cdn);
```

### 3. Fetch & Stream (Cloudflare Native)
The `fetch` method is optimized for **Cloudflare Workers**. It races between multiple sources to ensure the fastest possible TTFB.

```typescript
const { stream, manifest } = await cdn.fetch(asset.path);

return new Response(stream, {
  headers: {
    "Content-Type": manifest.mimeType,
    "Cache-Control": "public, max-age=31536000, immutable"
  }
});
```

---

## 🛠️ API Reference

### `cdn.upload(input, onUpdate?)`
Uploads a binary file. Supports automatic chunking (5MB chunks).
- **input**: `File` | `Blob` | `Buffer`
- **onUpdate**: Callback for progress tracking.

### `cdn.fetch(assetPath, onUpdate?)`
Retrieves an asset as a `ReadableStream`.

### `cdn.delete(id, folderPath)`
Performs a permanent physical scrub, removing the asset and its history from the repository.

### `cdn.list()`
Lists all assets currently tracked in the `registry.json`.

### `cdn.sync()`
Deep-scans the repository to recover lost or corrupted registry metadata.

### `cdn.ping()`
Utility to verify if your GitHub Token and Repository permissions are correctly configured.

---

## 🛡️ Security Best Practices
- **Token Scope**: Use a GitHub Fine-grained Personal Access Token restricted *only* to the specific CDN repository.
- **Secrets Management**: Never commit your `GITHUB_TOKEN` to version control. Use Environment Variables in GitHub Actions or Cloudflare Pages.

## 📜 License
MIT © CodeFaisalDev
