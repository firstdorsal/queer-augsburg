import type { GetDocumentsResponseBody } from "./apiTypes/GetDocumentsResponseBody";
import type { User } from "./apiTypes/User";
import type { WikiDocumentSummary } from "./apiTypes/WikiDocumentSummary";
import { FORBIDDEN_CHARS, maySeeMembersOnlyLinks, trimWhiteSpace } from "./places";

/** Mirror server/src/document_rules.rs. */
export const MAX_DOCUMENT_TITLE_CHARS = 200;
export const MAX_GROUP_NAME_CHARS = 100;
export const MAX_DOCUMENT_TEXT_CHARS = 100_000;
const UNTITLED = "Ohne Titel";

export const mayEditDocuments = (user: User | null | undefined): boolean =>
    user?.capabilities?.includes("UpdateDocuments") === true;

/** Mirrors the server's `User::may_read_documents`. */
export const mayReadDocuments = (user: User | null | undefined): boolean =>
    mayEditDocuments(user) || maySeeMembersOnlyLinks(user);

/** Mirrors the server's `clean_name`: the cleaned name, or `null` if it cannot be saved. */
export const cleanName = (value: string, maxChars: number): string | null => {
    const name = trimWhiteSpace(value);
    if (name === "" || FORBIDDEN_CHARS.test(name) || [...name].length > maxChars) return null;
    return name;
};

/** Mirrors the server's `derive_title`, for the moment between leaving the editor and the save. */
export const deriveTitle = (text: string): string => {
    const lines = text.split(/\r\n|\n/).map(trimWhiteSpace);
    const heading = lines
        .filter((line) => line.startsWith("# "))
        .map((line) => trimWhiteSpace(trimWhiteSpace(line.slice(2)).replace(/#+$/, "")))
        .find((line) => line !== "");
    const title = heading ?? lines.find((line) => trimWhiteSpace(line.replace(/#/g, "")) !== "");
    const clean = [...(title ?? "")]
        .filter((char) => !FORBIDDEN_CHARS.test(char))
        .slice(0, MAX_DOCUMENT_TITLE_CHARS)
        .join("");
    return trimWhiteSpace(clean) || UNTITLED;
};

/** `ids` with `id` moved by `offset` places, `null` if it cannot move that far. */
export const movedIds = (ids: string[], id: string, offset: number): string[] | null => {
    const from = ids.indexOf(id);
    const to = from + offset;
    if (from === -1 || to < 0 || to >= ids.length) return null;
    const moved = ids.filter((other) => other !== id);
    moved.splice(to, 0, id);
    return moved;
};

/** Stored in the text of documents that link each other, so this path stays. */
export const documentPath = (id: string): string => `/dokumente/${id}`;

/** The document the page opens without an id: the first one on the list. */
export const firstDocumentId = (list: GetDocumentsResponseBody): string | null => {
    const inGroup = list.groups.find((group) => group.document_ids.length > 0);
    return inGroup?.document_ids[0] ?? list.ungrouped_ids[0] ?? null;
};

export const titlesById = (list: GetDocumentsResponseBody): Map<string, string> =>
    new Map(list.documents.map((item: WikiDocumentSummary) => [item._id, item.title]));
