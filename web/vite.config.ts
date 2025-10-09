import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { imagetools } from "vite-imagetools";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        preact(),
        imagetools(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icon.png"],
            srcDir: "src",
            devOptions: {
                enabled: true,
                navigateFallbackAllowlist: [/^index.html$/]
            },
            workbox: {
                globPatterns: ["**/*.{js,css,html,ico,png,svg}"]
            },
            manifest: {
                name: "Queer Augsburg",
                short_name: "Queer Augsburg",
                start_url: "/",
                description: "Alle treffen von Queer Augsburg auf einen Blick!",
                theme_color: "#ffffff",
                icons: [
                    {
                        src: "logos/pwa-64x64.png",
                        sizes: "64x64",
                        type: "image/png"
                    },
                    {
                        src: "logos/pwa-192x192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "logos/pwa-512x512.png",
                        sizes: "512x512",
                        type: "image/png"
                    }
                ]
            }
        })
    ],
    resolve: {
        alias: {
            react: "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react-dom": "preact/compat",
            "react/jsx-runtime": "preact/jsx-runtime"
        }
    }
});
