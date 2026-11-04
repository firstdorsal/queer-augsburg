import { Component } from "preact";
import { Button, Input } from "rsuite";
import type { GetDocumentsResponseBody } from "../apiTypes/GetDocumentsResponseBody";
import type { WikiDocumentGroup } from "../apiTypes/WikiDocumentGroup";
import { documentPath, titlesById } from "../documents";

interface MoveButtonsProps {
    readonly label: string;
    readonly disabled: boolean;
    readonly first: boolean;
    readonly last: boolean;
    readonly onMove: (offset: number) => void;
}

const MoveButtons = ({ label, disabled, first, last, onMove }: MoveButtonsProps) => (
    <>
        <Button
            size="xs"
            appearance="subtle"
            aria-label={`${label} nach oben`}
            disabled={disabled || first}
            onClick={() => onMove(-1)}
        >
            ↑
        </Button>
        <Button
            size="xs"
            appearance="subtle"
            aria-label={`${label} nach unten`}
            disabled={disabled || last}
            onClick={() => onMove(1)}
        >
            ↓
        </Button>
    </>
);

interface DocumentListProps {
    readonly list: GetDocumentsResponseBody;
    readonly openId: string | null;
    readonly editor: boolean;
    readonly busy: boolean;
    readonly onMoveGroup: (groupId: string, offset: number) => void;
    readonly onMoveDocument: (group: WikiDocumentGroup, documentId: string, offset: number) => void;
    readonly onSaveGroupName: (groupId: string | null, name: string) => Promise<boolean>;
    readonly onDeleteGroup: (group: WikiDocumentGroup) => void;
    readonly onNewDocument: () => void;
}
interface DocumentListState {
    /** The group being named; `null` for a new one, `undefined` when nothing is. */
    readonly namingGroupId: string | null | undefined;
    readonly name: string;
}

export default class DocumentList extends Component<DocumentListProps, DocumentListState> {
    state: DocumentListState = { namingGroupId: undefined, name: "" };

    private saveName = async () => {
        const { namingGroupId, name } = this.state;
        if (namingGroupId === undefined) return;
        if (await this.props.onSaveGroupName(namingGroupId, name)) {
            this.setState({ namingGroupId: undefined, name: "" });
        }
    };

    private renderNameForm = () => (
        <div className="DocumentGroupForm">
            <Input
                aria-label="Name der Gruppe"
                placeholder="Name der Gruppe"
                value={this.state.name}
                onChange={(name) => this.setState({ name })}
            />
            <Button size="sm" disabled={this.props.busy} onClick={this.saveName}>
                Speichern
            </Button>
            <Button
                size="sm"
                appearance="subtle"
                onClick={() => this.setState({ namingGroupId: undefined, name: "" })}
            >
                Abbrechen
            </Button>
        </div>
    );

    private renderDocument = (
        id: string,
        title: string,
        move?: { group: WikiDocumentGroup; index: number }
    ) => {
        const { editor, busy, openId, onMoveDocument } = this.props;
        return (
            <li key={id}>
                <a className={id === openId ? "active" : ""} href={documentPath(id)}>
                    {title}
                </a>
                {editor && move && (
                    <MoveButtons
                        label={title}
                        disabled={busy}
                        first={move.index === 0}
                        last={move.index === move.group.document_ids.length - 1}
                        onMove={(offset) => onMoveDocument(move.group, id, offset)}
                    />
                )}
            </li>
        );
    };

    private renderGroup = (group: WikiDocumentGroup, index: number) => {
        const { list, editor, busy, onMoveGroup, onDeleteGroup } = this.props;
        const titles = titlesById(list);
        return (
            <section key={group._id}>
                {this.state.namingGroupId === group._id ? (
                    this.renderNameForm()
                ) : (
                    <div className="DocumentGroupHeading">
                        <h2>{group.name}</h2>
                        {editor && (
                            <>
                                <MoveButtons
                                    label={`Gruppe ${group.name}`}
                                    disabled={busy}
                                    first={index === 0}
                                    last={index === list.groups.length - 1}
                                    onMove={(offset) => onMoveGroup(group._id, offset)}
                                />
                                <Button
                                    size="xs"
                                    appearance="subtle"
                                    aria-label={`Gruppe ${group.name} umbenennen`}
                                    onClick={() =>
                                        this.setState({
                                            namingGroupId: group._id,
                                            name: group.name
                                        })
                                    }
                                >
                                    ✎
                                </Button>
                                <Button
                                    size="xs"
                                    appearance="subtle"
                                    aria-label={`Gruppe ${group.name} löschen`}
                                    disabled={busy}
                                    onClick={() => onDeleteGroup(group)}
                                >
                                    ✕
                                </Button>
                            </>
                        )}
                    </div>
                )}
                {group.document_ids.length === 0 ? (
                    <p className="DocumentEmptyGroup">Keine Dokumente</p>
                ) : (
                    <ul>
                        {group.document_ids.map((id, documentIndex) =>
                            this.renderDocument(id, titles.get(id) ?? "", {
                                group,
                                index: documentIndex
                            })
                        )}
                    </ul>
                )}
            </section>
        );
    };

    render = () => {
        const { list, editor, onNewDocument } = this.props;
        const titles = titlesById(list);
        return (
            <nav className="DocumentList" aria-label="Dokumente">
                {list.groups.map(this.renderGroup)}
                {list.ungrouped_ids.length > 0 && (
                    <section>
                        {list.groups.length > 0 && (
                            <div className="DocumentGroupHeading">
                                <h2>Ohne Gruppe</h2>
                            </div>
                        )}
                        <ul>
                            {list.ungrouped_ids.map((id) =>
                                this.renderDocument(id, titles.get(id) ?? "")
                            )}
                        </ul>
                    </section>
                )}
                {editor && (
                    <div className="DocumentActions">
                        <Button onClick={onNewDocument}>Neues Dokument</Button>
                        {this.state.namingGroupId === null ? (
                            this.renderNameForm()
                        ) : (
                            <Button
                                onClick={() => this.setState({ namingGroupId: null, name: "" })}
                            >
                                Neue Gruppe
                            </Button>
                        )}
                    </div>
                )}
            </nav>
        );
    };
}
