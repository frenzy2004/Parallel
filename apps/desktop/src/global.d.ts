import type { ParallelBridge } from "../electron/preload.js";

declare global {
  interface Window {
    parallel: ParallelBridge;
  }
}

export {};
