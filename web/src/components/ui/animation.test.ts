import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname);
const sources = readdirSync(dir)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => ({ file, text: readFileSync(join(dir, file), "utf8") }));

describe("enter animations", () => {
    // Tailwind's `duration-*` also sets `transition-duration`, and with the default
    // `transition-property: all` every later change of `left`/`top` is animated: a popover then
    // flies in from the corner of the page while it is being placed. The length of an enter
    // animation is set with `[animation-duration:…]` instead.
    it.each(sources)("$file sets no transition duration next to animate-in", ({ text }) => {
        const classStrings = text.match(/"[^"\n]*animate-in[^"\n]*"/g) ?? [];
        for (const classes of classStrings) {
            expect(classes).not.toMatch(/(^|[\s":])duration-\d/);
        }
    });
});
