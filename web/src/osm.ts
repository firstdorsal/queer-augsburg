// OpenStreetMap services used by the location picker, and the rules of their usage policies
// (https://operations.osmfoundation.org/policies/tiles/ and .../policies/nominatim/):
// - the canonical tile URL, without the old {a,b,c} subdomains;
// - a visible attribution;
// - a Referer: the site sends `Referrer-Policy: no-referrer`, so these requests override it
//   per request and send only the origin (scheme and host, never the path);
// - Nominatim at most once per second and never as search-as-you-type.
// The CSP of web/server/config.yml and deployment/templates/config/qa-web.yml must allow the
// two hosts (img-src, connect-src); osm.test.ts checks that.

import type { TileLayerOptions } from "leaflet";

export const OSM_REFERRER_POLICY: ReferrerPolicy = "strict-origin-when-cross-origin";

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const OSM_TILE_OPTIONS: TileLayerOptions = {
    // The highest zoom level the tile servers provide.
    maxZoom: 19,
    referrerPolicy: OSM_REFERRER_POLICY,
    attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
};

export const NOMINATIM_ORIGIN = "https://nominatim.openstreetmap.org";

/** Minimum time between two searches (Nominatim allows one request per second). */
export const NOMINATIM_MIN_INTERVAL_MS = 1000;

export const nominatimSearchUrl = (query: string): string =>
    `${NOMINATIM_ORIGIN}/search?${new URLSearchParams({
        q: query,
        format: "json",
        limit: "5",
        addressdetails: "1",
        countrycodes: "de"
    })}`;
