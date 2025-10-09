import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(({ url }) => url.pathname.startsWith("/static/"), new NetworkOnly());

// Debug logging
self.addEventListener("fetch", (event) => {
    console.log("Fetch intercepted:", event.request.url);
});

// Cache cross-origin API requests
registerRoute(
    ({ url, request }) => {
        const matches =
            url.origin === "https://api.queer-augsburg.de" && url.pathname === "/api/get_meetings/";

        console.log("Route check:", url.href, "matches:", matches);
        return matches;
    },
    new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200]
            }),
            new ExpirationPlugin({
                maxEntries: 20,
                maxAgeSeconds: 7 * 24 * 60 * 60
            })
        ]
    })
);
