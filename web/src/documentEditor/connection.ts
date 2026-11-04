/** What the editor does when the socket closes. Close codes: server/src/document_rooms.rs. */

export type EditorProblem =
    | "loggedOut"
    | "noPermission"
    | "deleted"
    | "tooLarge"
    | "damaged"
    | "broken";

export type CloseAction =
    /** y-websocket reconnects by itself. */
    | { kind: "reconnect" }
    /** The session may be gone: renew it first, then reconnect ourselves. */
    | { kind: "renew" }
    | { kind: "stop"; problem: EditorProblem };

/** A browser reports a refused handshake only as 1006, the same as a lost network. */
const ABNORMAL_CLOSE = 1006;

/** Pinned against the server by server/src/document_validation_cases.json. */
export const CLOSE_CODES = {
    badMessage: 4400,
    session: 4401,
    noPermission: 4403,
    deleted: 4404,
    tooLarge: 4413,
    damaged: 4422
} as const;

export const closeAction = (code: number): CloseAction => {
    switch (code) {
        case ABNORMAL_CLOSE:
        case CLOSE_CODES.session:
            return { kind: "renew" };
        case CLOSE_CODES.noPermission:
            return { kind: "stop", problem: "noPermission" };
        case CLOSE_CODES.deleted:
            return { kind: "stop", problem: "deleted" };
        case CLOSE_CODES.tooLarge:
            return { kind: "stop", problem: "tooLarge" };
        case CLOSE_CODES.damaged:
            return { kind: "stop", problem: "damaged" };
        case CLOSE_CODES.badMessage:
            return { kind: "stop", problem: "broken" };
        default:
            return { kind: "reconnect" };
    }
};

/** Whether y-websocket reconnects by itself; otherwise its `closed` event reaches us. */
export const reconnectsByItself = (code: number): boolean => closeAction(code).kind === "reconnect";

export const PROBLEM_TEXTS: Record<EditorProblem, string> = {
    loggedOut:
        "Bitte melde dich neu an. Kopiere vorher deinen Text, falls er noch nicht gespeichert ist.",
    noPermission: "Du darfst dieses Dokument nicht mehr bearbeiten.",
    deleted: "Dieses Dokument wurde gelöscht.",
    tooLarge: "Das Dokument ist zu groß. Kopiere deinen Text und lege ein neues Dokument an.",
    damaged: "Der gespeicherte Stand ist beschädigt. Bitte sag dem Vorstand Bescheid.",
    broken: "Die Verbindung wurde wegen eines Fehlers beendet. Bitte lade die Seite neu."
};

/** The API origin as WebSocket address. */
export const syncUrl = (apiOrigin: string): string =>
    `${apiOrigin.replace(/^http/, "ws")}/api/document_sync`;

const FIRST_RETRY_MS = 500;
const LONGEST_RETRY_MS = 15_000;

/** Waits grow, and differ, so that a restart does not bring everybody back at the same moment. */
export const retryDelay = (attempt: number, random: number = Math.random()): number => {
    const longest = Math.min(LONGEST_RETRY_MS, FIRST_RETRY_MS * 2 ** attempt);
    return Math.round(longest * (0.5 + random / 2));
};
