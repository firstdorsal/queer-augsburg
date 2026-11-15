import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const theme = readFileSync("src/theme.scss", "utf8");
const tailwindConfig = readFileSync("tailwind.config.js", "utf8");

const defined = new Set([...theme.matchAll(/^\s*(--ui-[a-z0-9-]+):/gm)].map((match) => match[1]));

const sources = (directory: string): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return sources(path);
        return /\.(tsx?|scss)$/.test(entry.name) && !entry.name.endsWith(".test.ts") ? [path] : [];
    });

describe("design tokens", () => {
    it("defines every variable the code uses", () => {
        const used = sources("src").flatMap((path) =>
            [...readFileSync(path, "utf8").matchAll(/var\((--ui-[a-z0-9-]+)/g)].map(
                (match) => match[1]
            )
        );
        expect(used.filter((name) => !defined.has(name))).toEqual([]);
    });

    it("defines every colour Tailwind exposes", () => {
        const list = /const tokens = \[([\s\S]*?)\];/.exec(tailwindConfig)?.[1] ?? "";
        const tokens = [...list.matchAll(/"([a-z0-9-]+)"/g)].map((match) => `--ui-${match[1]}`);
        expect(tokens.length).toBeGreaterThan(50);
        expect(tokens.filter((name) => !defined.has(name))).toEqual([]);
    });
});
