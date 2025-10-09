import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, NetworkOnly } from "workbox-strategies";

declare let self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(({ url }) => url.pathname.startsWith("/static/"), new NetworkOnly());

// Cache the API endpoint with offline fallback
registerRoute(
    ({ url }) =>
        url.origin === "https://api.queer-augsburg.de" &&
        url.pathname === "/api/get_meetings/?t=Active",
    new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200]
            }),
            new ExpirationPlugin({
                maxEntries: 20, // Cache multiple variations of query params
                maxAgeSeconds: 7 * 24 * 60 * 60 // 1 week
            })
        ],
        fetchOptions: {
            mode: "cors"
        }
    })
);
