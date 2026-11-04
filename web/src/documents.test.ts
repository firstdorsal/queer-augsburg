import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import cases from "../../server/src/document_validation_cases.json";
import type { GetDocumentsResponseBody } from "./apiTypes/GetDocumentsResponseBody";
import type { MembershipStatus } from "./apiTypes/MembershipStatus";
import type { User } from "./apiTypes/User";
import type { UserCapabilities } from "./apiTypes/UserCapabilities";
import {
    cleanName,
    deriveTitle,
    firstDocumentId,
    MAX_DOCUMENT_TEXT_CHARS,
    MAX_DOCUMENT_TITLE_CHARS,
    MAX_GROUP_NAME_CHARS,
    mayEditDocuments,
    mayReadDocuments,
    movedIds,
    titlesById
} from "./documents";

describe("shared rules", () => {
    it.each(cases.names)("name: $name", ({ value, expected }) => {
        expect(cleanName(value, 20)).toBe(expected);
    });

    it.each(cases.titles)("title: $name", ({ text, expected }) => {
        expect(deriveTitle(text)).toBe(expected);
    });

    it.each(cases.access)("access: $name", ({ capabilities, status, read, edit }) => {
        const user = {
            _id: "u",
            capabilities: capabilities as UserCapabilities[],
            member: status ? { status: status as MembershipStatus } : null
        } as User;
        expect(mayReadDocuments(user)).toBe(read);
        expect(mayEditDocuments(user)).toBe(edit);
    });
});

describe("who may use the documents without an account", () => {
    it("refuses guests and missing capabilities", () => {
        expect(mayReadDocuments(null)).toBe(false);
        expect(mayEditDocuments(undefined)).toBe(false);
        expect(mayReadDocuments({ _id: "u", member: null, capabilities: null })).toBe(false);
    });
});

describe("the deployment", () => {
    const compose = readFileSync(
        new URL("../../deployment/templates/docker-compose.yml", import.meta.url),
        "utf8"
    );

    it("lets the editor open its socket, which https:// alone does not", () => {
        const line = compose.split("\n").find((text) => text.includes("CSP_CONNECT_SRC"));
        expect(line).toContain('ternary "wss://" "ws://"');
        expect(line).toContain("$qaServerHostname");
    });

    it("gives the server the time to save open documents", () => {
        const main = readFileSync(new URL("../../server/src/main.rs", import.meta.url), "utf8");
        const timeout = main.match(
            /ROOMS_SHUTDOWN_TIMEOUT: Duration = Duration::from_secs\((\d+)\)/
        );
        const grace = compose.match(/stop_grace_period: (\d+)s/);
        expect(Number(grace?.[1])).toBeGreaterThan(Number(timeout?.[1]));
    });
});

describe("limits", () => {
    it("match the server", () => {
        expect(cases.limits).toEqual({
            title: MAX_DOCUMENT_TITLE_CHARS,
            group_name: MAX_GROUP_NAME_CHARS,
            text: MAX_DOCUMENT_TEXT_CHARS
        });
    });
});

describe("movedIds", () => {
    const ids = ["a", "b", "c"];

    it("moves up and down", () => {
        expect(movedIds(ids, "b", -1)).toEqual(["b", "a", "c"]);
        expect(movedIds(ids, "b", 1)).toEqual(["a", "c", "b"]);
    });

    it("stops at both ends and for unknown ids", () => {
        expect(movedIds(ids, "a", -1)).toBeNull();
        expect(movedIds(ids, "c", 1)).toBeNull();
        expect(movedIds(ids, "x", 1)).toBeNull();
    });
});

describe("the list", () => {
    const list: GetDocumentsResponseBody = {
        groups: [
            { _id: "g1", name: "Leer", document_ids: [] },
            { _id: "g2", name: "Voll", document_ids: ["d2", "d1"] }
        ],
        documents: [
            { _id: "d1", title: "Eins" },
            { _id: "d2", title: "Zwei" },
            { _id: "d3", title: "Drei" }
        ],
        ungrouped_ids: ["d3"]
    };

    it("opens the first document of the first group that has one", () => {
        expect(firstDocumentId(list)).toBe("d2");
    });

    it("falls back to documents without a group, and to nothing", () => {
        expect(firstDocumentId({ ...list, groups: [] })).toBe("d3");
        expect(firstDocumentId({ groups: [], documents: [], ungrouped_ids: [] })).toBeNull();
    });

    it("finds titles by id", () => {
        expect(titlesById(list).get("d2")).toBe("Zwei");
    });
});
