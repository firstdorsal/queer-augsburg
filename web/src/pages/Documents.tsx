import { Component } from "preact";
import { route } from "preact-router";
import { lazy, Suspense } from "preact/compat";
import { Button, Loader } from "rsuite";
import type { CreateDocumentRequestBody } from "../apiTypes/CreateDocumentRequestBody";
import type { GetDocumentsResponseBody } from "../apiTypes/GetDocumentsResponseBody";
import type { WikiDocument } from "../apiTypes/WikiDocument";
import type { WikiDocumentGroup } from "../apiTypes/WikiDocumentGroup";
import DocumentList from "../components/DocumentList";
import DocumentSearch from "../components/DocumentSearch";
import DocumentView from "../components/DocumentView";
import NewDocument from "../components/NewDocument";
import {
    cleanName,
    deriveTitle,
    documentPath,
    firstDocumentId,
    MAX_GROUP_NAME_CHARS,
    mayEditDocuments,
    movedIds
} from "../documents";
import { G } from "../types";

const EditorLoadFailed = () => <p role="alert">Bitte lade die Seite neu.</p>;

// Only editors need CodeMirror and Yjs. A chunk removed by a deploy is an expected failure.
const LazyDocumentEditor = lazy(() =>
    import("../documentEditor/DocumentEditor").catch(() => ({ default: EditorLoadFailed }))
);

interface DocumentsProps {
    readonly g: G;
    readonly path?: string;
    /** From the URL; without it the first document opens. */
    readonly documentId?: string;
}
interface DocumentsState {
    readonly list: GetDocumentsResponseBody | null;
    /** HTTP status of the failed list request; 0 means no answer. */
    readonly listStatus: number | null;
    readonly document: WikiDocument | null;
    /** The id requested last, to drop answers that arrive too late. */
    readonly requestedId: string | null;
    readonly documentProblem: string | null;
    readonly creating: boolean;
    readonly editing: boolean;
    readonly searching: boolean;
    readonly problem: string | null;
    readonly busy: boolean;
}

type ListResult = { ok: true; list: GetDocumentsResponseBody } | { ok: false; message: string };

export default class Documents extends Component<DocumentsProps, DocumentsState> {
    state: DocumentsState = {
        list: null,
        listStatus: null,
        document: null,
        requestedId: null,
        documentProblem: null,
        creating: false,
        editing: false,
        searching: false,
        problem: null,
        busy: false
    };

    private listRequested = false;

    componentDidMount = () => {
        this.load();
    };

    componentDidUpdate = () => {
        this.load();
    };

    private openId = () =>
        // preact-router passes "" for a missing optional parameter.
        this.props.documentId || (this.state.list ? firstDocumentId(this.state.list) : null);

    private load = async () => {
        const client = this.props.g.qaClient;
        if (!client || !this.props.g.loggedIn) return;

        if (!this.listRequested) {
            this.listRequested = true;
            const result = await client.get_documents();
            if (result.ok) this.setState({ list: result.list, listStatus: null });
            else this.setState({ listStatus: result.status });
            return;
        }

        const id = this.openId();
        if (this.state.list === null || id === this.state.requestedId) return;
        this.setState({
            requestedId: id,
            document: null,
            documentProblem: null,
            problem: null,
            editing: false
        });
        if (id === null) return;

        const result = await client.get_document(id);
        if (id !== this.state.requestedId) return;
        if (result.ok) this.setState({ document: result.document });
        else {
            this.setState({
                documentProblem:
                    result.status === 404
                        ? "Dieses Dokument gibt es nicht mehr."
                        : "Das Dokument konnte nicht geladen werden."
            });
        }
    };

    /** Starts over, for a retry or after leaving an editor that had no valid text. */
    private reload = () => {
        this.listRequested = false;
        this.setState({
            list: null,
            listStatus: null,
            document: null,
            requestedId: null,
            documentProblem: null,
            editing: false
        });
    };

    /** Runs a change that answers with the new list. Returns whether it worked. */
    private change = async (action: () => Promise<ListResult>): Promise<boolean> => {
        this.setState({ busy: true, problem: null });
        const result = await action();
        if (result.ok) this.setState({ busy: false, list: result.list });
        else this.setState({ busy: false, problem: result.message });
        return result.ok;
    };

    private client = () => this.props.g.qaClient!;

    private moveGroup = (groupId: string, offset: number) => {
        const ids = this.state.list?.groups.map((group) => group._id) ?? [];
        const moved = movedIds(ids, groupId, offset);
        if (moved) this.change(() => this.client().order_document_groups(moved));
    };

    private moveDocument = (group: WikiDocumentGroup, documentId: string, offset: number) => {
        const moved = movedIds(group.document_ids, documentId, offset);
        if (moved) this.change(() => this.client().order_group_documents(group._id, moved));
    };

    private saveGroupName = async (groupId: string | null, value: string): Promise<boolean> => {
        const name = cleanName(value, MAX_GROUP_NAME_CHARS);
        if (name === null) {
            this.setState({ problem: "Bitte einen Namen ohne Sonderzeichen angeben." });
            return false;
        }
        return this.change(() =>
            groupId === null
                ? this.client().create_document_group(name)
                : this.client().rename_document_group(groupId, name)
        );
    };

    private deleteGroup = (group: WikiDocumentGroup) => {
        const question = `Gruppe „${group.name}“ löschen? Die Dokumente bleiben erhalten.`;
        if (window.confirm(question)) {
            this.change(() => this.client().delete_document_group(group._id));
        }
    };

    private setGroups = async (groupIds: string[]) => {
        const { document } = this.state;
        if (!document) return;
        const saved = await this.change(() =>
            this.client().set_document_groups(document._id, groupIds)
        );
        if (saved) {
            this.setState((state) => ({
                document:
                    state.document?._id === document._id
                        ? { ...state.document, group_ids: groupIds }
                        : state.document
            }));
        }
    };

    private deleteDocument = async () => {
        const { document } = this.state;
        if (!document || !window.confirm(`„${document.title}“ wirklich löschen?`)) return;
        const deleted = await this.change(() => this.client().delete_document(document._id));
        if (deleted) {
            this.setState({ document: null, requestedId: null });
            route("/dokumente");
        }
    };

    private createDocument = async (body: CreateDocumentRequestBody) => {
        this.setState({ busy: true, problem: null });
        const created = await this.client().create_document(body);
        if (!created.ok) {
            this.setState({ busy: false, problem: created.message });
            return;
        }
        const list = await this.client().get_documents();
        this.setState((state) => ({
            busy: false,
            creating: false,
            list: list.ok ? list.list : state.list,
            problem: list.ok
                ? null
                : "Das Dokument ist angelegt, die Liste konnte aber nicht aktualisiert werden.",
            document: created.document,
            requestedId: created.document._id
        }));
        route(documentPath(created.document._id));
    };

    /** The text arrives before the room's save, so the title is worked out here too. */
    private leaveEditor = (text: string | null) => {
        if (text === null) {
            this.reload();
            return;
        }
        this.setState((state) => {
            const { document, list } = state;
            if (!document || !list) return { editing: false };
            const title = deriveTitle(text);
            return {
                editing: false,
                document: { ...document, content: text, title, editing: false },
                list: {
                    ...list,
                    documents: list.documents.map((item) =>
                        item._id === document._id ? { ...item, title } : item
                    )
                }
            };
        });
    };

    private renderNotice = (text: string, action: "login" | "retry" | null = null) => (
        <div className="Impressum Pad">
            <h1>Dokumente</h1>
            <p>{text}</p>
            {action === "retry" && <Button onClick={this.reload}>Erneut versuchen</Button>}
            {action === "login" && (
                <Button
                    onClick={() => {
                        const { uiConfig } = this.props.g;
                        if (uiConfig) {
                            window.location.href =
                                uiConfig.interosseaWebAddress + "/login?rid=qa_ich";
                        }
                    }}
                >
                    Login
                </Button>
            )}
        </div>
    );

    private renderMain = (list: GetDocumentsResponseBody, editor: boolean) => {
        const { document, documentProblem, busy } = this.state;
        if (documentProblem) {
            return (
                <div className="DocumentBody">
                    <p>{documentProblem}</p>
                    <Button onClick={this.reload}>Erneut versuchen</Button>
                </div>
            );
        }
        if (this.openId() === null) return <p className="DocumentBody">Noch keine Dokumente.</p>;
        if (!document) return <Loader content="Lädt…" />;
        const { qaClient, uiConfig } = this.props.g;
        if (this.state.editing && qaClient && uiConfig) {
            return (
                <Suspense fallback={<Loader content="Lädt…" />}>
                    <LazyDocumentEditor
                        documentId={document._id}
                        apiOrigin={uiConfig.qaServerAddress}
                        client={qaClient}
                        onClose={this.leaveEditor}
                    />
                </Suspense>
            );
        }
        return (
            <DocumentView
                document={document}
                groups={list.groups}
                editor={editor}
                busy={busy}
                onGroupsChange={this.setGroups}
                onEdit={() => this.setState({ editing: true })}
                onDelete={this.deleteDocument}
            />
        );
    };

    render = () => {
        const { g } = this.props;
        const { list, listStatus, creating, searching, problem, busy } = this.state;

        if (g.loggedIn === false) {
            return this.renderNotice("Bitte melde dich an, um die Dokumente zu sehen.", "login");
        }
        if (listStatus !== null) {
            return listStatus === 403
                ? this.renderNotice("Die Dokumente sind nur für bestätigte Mitglieder sichtbar.")
                : this.renderNotice("Die Dokumente konnten nicht geladen werden.", "retry");
        }
        if (list === null || g.loggedIn === null || !g.qaClient) {
            return (
                <div className="Impressum Pad">
                    <Loader content="Lädt…" />
                </div>
            );
        }

        const editor = mayEditDocuments(g.account);
        return (
            <div className={this.state.editing ? "Documents editing Pad" : "Documents Pad"}>
                <div>
                    <DocumentSearch
                        client={g.qaClient}
                        onActiveChange={(active) => this.setState({ searching: active })}
                    />
                    {!searching && (
                        <DocumentList
                            list={list}
                            openId={this.openId()}
                            editor={editor}
                            busy={busy}
                            onMoveGroup={this.moveGroup}
                            onMoveDocument={this.moveDocument}
                            onSaveGroupName={this.saveGroupName}
                            onDeleteGroup={this.deleteGroup}
                            onNewDocument={() => this.setState({ creating: true, problem: null })}
                        />
                    )}
                </div>
                <div>
                    {problem && !creating && <p role="alert">{problem}</p>}
                    {creating ? (
                        <NewDocument
                            groups={list.groups}
                            busy={busy}
                            problem={problem}
                            onCreate={this.createDocument}
                            onCancel={() => this.setState({ creating: false, problem: null })}
                        />
                    ) : (
                        this.renderMain(list, editor)
                    )}
                </div>
            </div>
        );
    };
}
