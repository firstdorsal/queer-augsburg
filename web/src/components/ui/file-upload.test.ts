import { describe, expect, it } from "vitest";
import { formatFileSize } from "./file-upload";

describe("formatFileSize", () => {
    it.each([
        [1, "1B"],
        [1023, "1023B"],
        [1024, "1.00KB"],
        [2000, "1.95KB"],
        [3 * 1024 ** 2, "3.00MB"],
        [2 * 1024 ** 3, "2.00GB"]
    ])("writes %d as %s", (size, text) => {
        expect(formatFileSize(size)).toBe(text);
    });
});
