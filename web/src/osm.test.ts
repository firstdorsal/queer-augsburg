import { describe, expect, it } from "vitest";
import productionConfig from "../../deployment/templates/config/qa-web.yml?raw";
import imageConfig from "../server/config.yml?raw";
import {
    NOMINATIM_ORIGIN,
    OSM_REFERRER_POLICY,
    OSM_TILE_OPTIONS,
    OSM_TILE_URL,
    nominatimSearchUrl
} from "./osm";

/** The sources of one CSP directive in a feoco config ("img-src 'self' https://…;"). */
const cspSources = (config: string, directive: string): string[] => {
    const match = new RegExp(`${directive}\\s+([^;]*);`).exec(config);
    if (!match) throw new Error(`no ${directive} in the config`);
    return match[1].split(/\s+/).filter(Boolean);
};

/** CSP host-source matching for an https URL: an optional scheme, and "*." only matches
 * subdomains (so "*.tile.openstreetmap.org" does not allow "tile.openstreetmap.org"). */
const allows = (sources: readonly string[], url: string): boolean => {
    const { protocol, hostname } = new URL(url);
    return sources.some((source) => {
        const parsed = /^(?:([a-z]+):\/\/)?([^/:]+)$/.exec(source);
        if (!parsed) return false;
        const [, scheme, host] = parsed;
        if (scheme !== undefined && `${scheme}:` !== protocol) return false;
        return host.startsWith("*.") ? hostname.endsWith(host.slice(1)) : hostname === host;
    });
};

describe("OpenStreetMap usage policy", () => {
    it("uses the canonical tile URL with attribution and zoom limit", () => {
        expect(OSM_TILE_URL).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
        expect(OSM_TILE_OPTIONS.attribution).toContain("https://www.openstreetmap.org/copyright");
        expect(OSM_TILE_OPTIONS.maxZoom).toBe(19);
    });

    it("sends a Referer to OSM although the site sends none elsewhere", () => {
        expect(OSM_TILE_OPTIONS.referrerPolicy).toBe(OSM_REFERRER_POLICY);
        expect(["no-referrer", ""]).not.toContain(OSM_REFERRER_POLICY);
        expect(productionConfig).toMatch(/referrer-policy: no-referrer/);
    });

    it("builds Nominatim search URLs with an encoded query", () => {
        const url = new URL(nominatimSearchUrl("Rathausplatz 1 & Co, Augsburg"));
        expect(url.origin).toBe(NOMINATIM_ORIGIN);
        expect(url.pathname).toBe("/search");
        expect(url.searchParams.get("q")).toBe("Rathausplatz 1 & Co, Augsburg");
        expect(url.searchParams.get("format")).toBe("json");
    });
});

describe.each([
    ["deployment/templates/config/qa-web.yml (production)", productionConfig],
    ["web/server/config.yml (image default)", imageConfig]
])("CSP of %s", (_name, config) => {
    it("allows the map tiles", () => {
        const tile = OSM_TILE_URL.replace("{z}/{x}/{y}", "13/4331/2840");
        expect(allows(cspSources(config, "img-src"), tile)).toBe(true);
    });

    it("allows the address search", () => {
        expect(allows(cspSources(config, "connect-src"), nominatimSearchUrl("Augsburg"))).toBe(
            true
        );
    });
});

describe("the CSP matcher of this test", () => {
    it("treats *. as subdomains only, like browsers", () => {
        expect(allows(["*.tile.openstreetmap.org"], "https://tile.openstreetmap.org/1.png")).toBe(
            false
        );
        expect(allows(["*.openstreetmap.org"], "https://tile.openstreetmap.org/1.png")).toBe(true);
        expect(
            allows(["http://tile.openstreetmap.org"], "https://tile.openstreetmap.org/1.png")
        ).toBe(false);
        expect(allows(["tile.openstreetmap.org"], "https://tile.openstreetmap.org/1.png")).toBe(
            true
        );
    });
});
