import vinext from "vinext";
import { defineConfig } from "vite";

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

export default defineConfig({
  // A reload recovers requests that still use an earlier optimized dep hash.
  optimizeDeps: {
    ignoreOutdatedRequests: true,
  },
  server: {
    host: "localhost",
    strictPort: true,
    ...(isCodexSeatbeltSandbox ? { watch: { useFsEvents: false, usePolling: true } } : {}),
  },
  plugins: [vinext()],
});
