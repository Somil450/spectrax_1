/**
 * Node 18.x crypto polyfill (preload script)
 *
 * In Node 18.x the Web Crypto API is not exposed on the global scope by
 * default. Libraries like workbox-build's serialize-javascript call
 * `crypto.getRandomValues()` / `crypto.randomUUID()` assuming the global
 * exists — which works in Node 20+ and all modern browsers but crashes
 * on Node 18 with "ReferenceError: crypto is not defined".
 *
 * This script is loaded before the main process via
 *   NODE_OPTIONS="--import ./scripts/crypto-polyfill.mjs"
 * so the polyfill is in place before *any* library code executes —
 * including code that runs inside Vite plugins or worker threads.
 *
 * On Node 20+ the guard prevents double-assignment.
 */

import { webcrypto } from "node:crypto";

if (typeof globalThis.crypto === "undefined") {
  globalThis.crypto = /** @type {any} */ (webcrypto);
}
