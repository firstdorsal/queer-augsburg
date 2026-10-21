import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so the PWA/imagetools plugins stay out of unit tests.
export default defineConfig({
    test: {
        // A non-Berlin zone proves that the Europe/Berlin conversion ignores the local zone.
        env: { TZ: "America/Los_Angeles" }
    }
});
