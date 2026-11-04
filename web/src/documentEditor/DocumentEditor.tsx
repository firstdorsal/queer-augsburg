import { defaultKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { useEffect, useRef, useState } from "preact/hooks";
import { Button, Message } from "rsuite";
import {
    yCollab,
    yRemoteSelectionsTheme,
    ySyncAnnotation,
    yUndoManagerKeymap
} from "y-codemirror.next";
import { WebsocketProvider } from "y-websocket";
import * as Y from "yjs";
import type { QaClient } from "../api";
import type { WikiDocumentVersion } from "../apiTypes/WikiDocumentVersion";
import Md from "../components/Md";
import { MAX_DOCUMENT_TEXT_CHARS } from "../documents";
import { prefersDarkMode } from "../utils";
import {
    closeAction,
    EditorProblem,
    PROBLEM_TEXTS,
    reconnectsByItself,
    retryDelay,
    syncUrl
} from "./connection";
import { remoteSelections, userColorTheme } from "./remoteSelections";

/** Mirrors TEXT_ROOT in server/src/document_rooms.rs. */
const TEXT_ROOT = "content";
/** Without a limit an attempt to a backend that just went away hangs for 30 s. */
const CONNECT_TIMEOUT_MS = 3_000;
const PREVIEW_PAUSE_MS = 200;
/** Mirrors SERVER_CLIENT_ID in server/src/document_rooms.rs. */
const SERVER_CLIENT_ID = 2 ** 32;

type Connection = "connecting" | "connected" | "offline";

const CONNECTION_TEXTS: Record<Connection, string> = {
    connecting: "Verbinde…",
    connected: "Verbunden, Änderungen werden automatisch gespeichert",
    offline: "Offline, Änderungen werden nachgetragen"
};

// Global CSS does not reach the shadow root the editor lives in.
const editorTheme = (dark: boolean) =>
    EditorView.theme(
        {
            "&": { height: "100%", color: dark ? "#e9ebf0" : "#272c36" },
            ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.5" },
            ".cm-content": { caretColor: dark ? "#e9ebf0" : "#272c36" },
            ".cm-gutters": {
                backgroundColor: "transparent",
                border: "none",
                color: dark ? "#a4a9b3" : "#8e8e93"
            }
        },
        { dark }
    );

interface DocumentEditorProps {
    readonly documentId: string;
    readonly apiOrigin: string;
    readonly client: QaClient;
    /** With the text as it was when leaving, `null` if the editor never had the real one. */
    readonly onClose: (text: string | null) => void;
}

export default function DocumentEditor({
    documentId,
    apiOrigin,
    client,
    onClose
}: DocumentEditorProps) {
    const host = useRef<HTMLDivElement>(null);
    const text = useRef<Y.Text | null>(null);
    /** Local changes the server has not confirmed. */
    const unsent = useRef(false);
    const everSynced = useRef(false);
    const [connection, setConnection] = useState<Connection>("connecting");
    const [synced, setSynced] = useState(false);
    const [problem, setProblem] = useState<EditorProblem | null>(null);
    const [saveFailing, setSaveFailing] = useState(false);
    const [tooLong, setTooLong] = useState(false);
    const [preview, setPreview] = useState("");
    const [showPreview, setShowPreview] = useState(() => window.innerWidth > 900);
    const [versions, setVersions] = useState<WikiDocumentVersion[] | null>(null);
    const [versionsProblem, setVersionsProblem] = useState<string | null>(null);
    const [openVersion, setOpenVersion] = useState<WikiDocumentVersion | null>(null);

    useEffect(() => {
        const doc = new Y.Doc();
        const ytext = doc.getText(TEXT_ROOT);
        text.current = ytext;
        const provider = new WebsocketProvider(syncUrl(apiOrigin), documentId, doc, {
            // Tabs would otherwise sync past the server and its permission checks.
            disableBc: true,
            connect: false,
            shouldReconnect: (event) => reconnectsByItself(event.code)
        });
        provider.awareness.setLocalStateField("cursor", null);

        let stopped = false;
        let attempt = 0;
        let retry: ReturnType<typeof setTimeout> | undefined;
        let connectTimeout: ReturnType<typeof setTimeout> | undefined;

        const stop = (reason: EditorProblem) => {
            stopped = true;
            provider.disconnect();
            setProblem(reason);
        };

        const reconnectAfterRenewal = async () => {
            setConnection("offline");
            const session = await client.renew_session();
            if (stopped) return;
            if (session === "loggedOut") {
                stop("loggedOut");
                return;
            }
            retry = setTimeout(() => {
                if (!stopped) provider.connect();
            }, retryDelay(attempt++));
        };

        provider.on("status", ({ status }) => {
            clearTimeout(connectTimeout);
            if (status === "connected") {
                attempt = 0;
                setConnection("connected");
            } else if (status === "connecting") {
                setSynced(false);
                setConnection((current) => (current === "offline" ? "offline" : "connecting"));
                connectTimeout = setTimeout(() => provider.ws?.close(), CONNECT_TIMEOUT_MS);
            } else {
                setSynced(false);
                setConnection("offline");
            }
        });
        provider.on("sync", (isSynced) => {
            if (isSynced) {
                unsent.current = false;
                everSynced.current = true;
                setSynced(true);
            }
        });
        provider.on("closed", ({ code }) => {
            const action = closeAction(code);
            if (action.kind === "stop") stop(action.problem);
            else if (action.kind === "renew") reconnectAfterRenewal();
        });
        const onAwareness = () => {
            const state = provider.awareness.getStates().get(SERVER_CLIENT_ID);
            setSaveFailing(state?.saveFailed === true);
        };
        provider.awareness.on("change", onAwareness);

        const editable = new Compartment();
        const onlyWithinLimit = EditorState.changeFilter.of((transaction) => {
            const remote = transaction.annotation(ySyncAnnotation) !== undefined;
            const fits = transaction.newDoc.length <= MAX_DOCUMENT_TEXT_CHARS;
            const shrinks = transaction.newDoc.length <= transaction.startState.doc.length;
            setTooLong(!fits);
            return remote || fits || shrinks;
        });
        // The CSP blocks the <style> element CodeMirror uses in `document`, not the constructable
        // stylesheet it uses in a shadow root.
        const root = host.current!.shadowRoot ?? host.current!.attachShadow({ mode: "open" });
        const view = new EditorView({
            parent: root,
            root,
            state: EditorState.create({
                doc: "",
                extensions: [
                    lineNumbers(),
                    EditorView.lineWrapping,
                    syntaxHighlighting(defaultHighlightStyle),
                    // No `history()`: its undo would take back other people's text too.
                    keymap.of([...yUndoManagerKeymap, ...defaultKeymap]),
                    markdown(),
                    editorTheme(prefersDarkMode()),
                    userColorTheme,
                    yRemoteSelectionsTheme,
                    yCollab(ytext, null),
                    remoteSelections(provider.awareness),
                    onlyWithinLimit,
                    editable.of(EditorView.editable.of(false))
                ]
            })
        });

        let previewTimer: ReturnType<typeof setTimeout> | undefined;
        const onText = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
            if (transaction.local && !provider.wsconnected) unsent.current = true;
            clearTimeout(previewTimer);
            previewTimer = setTimeout(() => setPreview(ytext.toString()), PREVIEW_PAUSE_MS);
        };
        ytext.observe(onText);

        const allowEditing = (allowed: boolean) =>
            view.dispatch({
                effects: editable.reconfigure(EditorView.editable.of(allowed))
            });
        const onSync = (isSynced: boolean) => {
            if (isSynced && !stopped) allowEditing(true);
        };
        provider.on("sync", onSync);
        const onClosed = () => {
            if (stopped) allowEditing(false);
        };
        provider.on("closed", onClosed);

        const warnBeforeLeaving = (event: BeforeUnloadEvent) => {
            if (unsent.current) event.preventDefault();
        };
        window.addEventListener("beforeunload", warnBeforeLeaving);

        provider.connect();

        return () => {
            stopped = true;
            clearTimeout(retry);
            clearTimeout(connectTimeout);
            clearTimeout(previewTimer);
            window.removeEventListener("beforeunload", warnBeforeLeaving);
            ytext.unobserve(onText);
            provider.awareness.off("change", onAwareness);
            view.destroy();
            provider.destroy();
            doc.destroy();
            text.current = null;
        };
    }, [documentId, apiOrigin, client]);

    const close = () => {
        const question = "Es gibt Änderungen, die noch nicht übertragen sind. Trotzdem verlassen?";
        if (unsent.current && !window.confirm(question)) return;
        const haveRealText = everSynced.current && problem === null;
        onClose(haveRealText ? (text.current?.toString() ?? null) : null);
    };

    const toggleVersions = async () => {
        if (versions) {
            setVersions(null);
            setOpenVersion(null);
            return;
        }
        const result = await client.get_document_versions(documentId);
        if (result.ok) {
            setVersions(result.versions);
            setVersionsProblem(null);
        } else {
            setVersionsProblem(result.message || "Die Versionen konnten nicht geladen werden.");
        }
    };

    /** An ordinary edit: the others see it at once, and it can be replaced again. */
    const restore = (version: WikiDocumentVersion) => {
        const ytext = text.current;
        if (!ytext || !window.confirm("Den aktuellen Text durch diese Version ersetzen?")) return;
        ytext.doc?.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, version.content);
        });
        setOpenVersion(null);
    };

    const status = everSynced.current
        ? synced || connection === "offline"
            ? CONNECTION_TEXTS[connection]
            : "Gleicht ab…"
        : "Verbinde…";
    return (
        <div className="DocumentEditor">
            <div className="DocumentEditorBar">
                <span role="status" aria-live="polite">
                    {problem ? "" : status}
                </span>
                <Button size="sm" onClick={() => setShowPreview(!showPreview)}>
                    {showPreview ? "Vorschau aus" : "Vorschau an"}
                </Button>
                <Button size="sm" onClick={toggleVersions}>
                    Frühere Versionen
                </Button>
                <Button size="sm" appearance="primary" onClick={close}>
                    Fertig
                </Button>
            </div>
            {problem && (
                <Message showIcon type="error">
                    {PROBLEM_TEXTS[problem]}
                </Message>
            )}
            {saveFailing && (
                <Message showIcon type="warning">
                    Speichern klappt gerade nicht. Schreib ruhig weiter, es wird wiederholt.
                </Message>
            )}
            {tooLong && (
                <Message showIcon type="warning">
                    Das Dokument hat die Höchstlänge von {MAX_DOCUMENT_TEXT_CHARS} Zeichen erreicht.
                </Message>
            )}
            {versionsProblem && <p role="alert">{versionsProblem}</p>}
            {versions && (
                <div className="DocumentVersions">
                    {versions.length === 0 && <p>Noch keine früheren Versionen.</p>}
                    <ul>
                        {versions.map((version) => (
                            <li key={version._id}>
                                <button type="button" onClick={() => setOpenVersion(version)}>
                                    {new Date(version.saved_at).toLocaleString("de-DE")}
                                </button>
                            </li>
                        ))}
                    </ul>
                    {openVersion && (
                        <div>
                            <Button size="sm" onClick={() => restore(openVersion)}>
                                Diese Version wiederherstellen
                            </Button>
                            <Md page plainText={openVersion.content} />
                        </div>
                    )}
                </div>
            )}
            <div className={showPreview ? "DocumentPanes" : "DocumentPanes single"}>
                <div ref={host} className="DocumentEditorPane" />
                {showPreview && (
                    <div className="DocumentBody">
                        <Md page plainText={preview} />
                    </div>
                )}
            </div>
            <details className="DocumentHelp">
                <summary>Markdown-Hilfe</summary>
                <ul>
                    <li>
                        <code># Überschrift</code>, <code>## Unterüberschrift</code>: Die erste
                        Überschrift ist der Titel des Dokuments.
                    </li>
                    <li>
                        <code>**fett**</code>, <code>*kursiv*</code>
                    </li>
                    <li>
                        <code>- Punkt</code>, <code>1. Punkt</code>: Listen
                    </li>
                    <li>
                        <code>[Text](https://example.org)</code>: Link in einem neuen Tab
                    </li>
                    <li>
                        <code>[Text](/dokumente/abc)</code>: Link auf ein anderes Dokument
                    </li>
                    <li>
                        <code>&gt; Zitat</code>, <code>---</code>: Zitat, Trennlinie
                    </li>
                    <li>Eine Leerzeile beginnt einen neuen Absatz.</li>
                    <li>Bilder und Tabellen werden nicht angezeigt.</li>
                    <li>Alle bestätigten Mitglieder können jedes Dokument lesen.</li>
                </ul>
            </details>
        </div>
    );
}
