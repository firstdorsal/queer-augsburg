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
    ({ url }) => url.href === "https://api.queer-augsburg.de/api/get_meetings/?i=0&t=Active",
    new NetworkFirst({
        cacheName: "api-cache",
        plugins: [
            new CacheableResponsePlugin({
                statuses: [0, 200] // Cache successful responses
            }),
            new ExpirationPlugin({
                maxEntries: 50,
                maxAgeSeconds: 24 * 60 * 60 // 24 hours
            })
        ]
    })
);
