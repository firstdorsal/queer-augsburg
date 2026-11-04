import { describe, expect, it } from "vitest";
import cases from "../../../server/src/document_validation_cases.json";
import { CLOSE_CODES, closeAction, reconnectsByItself, retryDelay, syncUrl } from "./connection";

describe("closeAction", () => {
    it("uses the close codes of the server", () => {
        expect(CLOSE_CODES).toEqual(cases.close_codes);
    });

    it.each([
        [4403, "noPermission"],
        [4404, "deleted"],
        [4413, "tooLarge"],
        [4422, "damaged"],
        [4400, "broken"]
    ])("stops on %i", (code, problem) => {
        expect(closeAction(code)).toEqual({ kind: "stop", problem });
        expect(reconnectsByItself(code)).toBe(false);
    });

    it("renews the session on 4401 and on a failed connection", () => {
        expect(closeAction(4401)).toEqual({ kind: "renew" });
        expect(closeAction(1006)).toEqual({ kind: "renew" });
        expect(reconnectsByItself(1006)).toBe(false);
    });

    it("leaves restarts to y-websocket", () => {
        for (const code of [1000, 1001, 1011, 1012, 1013]) {
            expect(closeAction(code)).toEqual({ kind: "reconnect" });
            expect(reconnectsByItself(code)).toBe(true);
        }
    });
});

describe("syncUrl", () => {
    it("turns the API origin into a WebSocket address", () => {
        expect(syncUrl("https://api.queer-augsburg.de")).toBe(
            "wss://api.queer-augsburg.de/api/document_sync"
        );
        expect(syncUrl("http://localhost:20351")).toBe("ws://localhost:20351/api/document_sync");
    });
});

describe("retryDelay", () => {
    it("grows up to a limit and varies", () => {
        expect(retryDelay(0, 1)).toBe(500);
        expect(retryDelay(2, 1)).toBe(2_000);
        expect(retryDelay(20, 1)).toBe(15_000);
        expect(retryDelay(20, 0)).toBe(7_500);
    });
});
