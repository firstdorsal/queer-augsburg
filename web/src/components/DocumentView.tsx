import { Component } from "preact";
import { Button, CheckPicker } from "rsuite";
import type { WikiDocument } from "../apiTypes/WikiDocument";
import type { WikiDocumentGroup } from "../apiTypes/WikiDocumentGroup";
import Md from "./Md";

interface DocumentViewProps {
    readonly document: WikiDocument;
    readonly groups: WikiDocumentGroup[];
    readonly editor: boolean;
    readonly busy: boolean;
    readonly onGroupsChange: (groupIds: string[]) => void;
    readonly onEdit: () => void;
    readonly onDelete: () => void;
}
interface DocumentViewState {}

export default class DocumentView extends Component<DocumentViewProps, DocumentViewState> {
    render = () => {
        const { document, groups, editor, busy, onGroupsChange, onEdit, onDelete } = this.props;
        return (
            <article className="DocumentBody">
                <Md page plainText={document.content} />
                {document.editing && (
                    <p>
                        Dieses Dokument wird gerade bearbeitet. Lade die Seite neu für den neuesten
                        Stand.
                    </p>
                )}
                {editor && (
                    <div className="DocumentActions">
                        <Button appearance="primary" onClick={onEdit}>
                            Bearbeiten
                        </Button>
                        <CheckPicker
                            aria-label="Gruppen des Dokuments"
                            placeholder="Gruppen"
                            searchable={false}
                            disabled={busy}
                            value={document.group_ids}
                            data={groups.map((group) => ({ value: group._id, label: group.name }))}
                            onChange={(groupIds) => onGroupsChange(groupIds as string[])}
                        />
                        <Button color="red" appearance="ghost" disabled={busy} onClick={onDelete}>
                            Löschen
                        </Button>
                    </div>
                )}
            </article>
        );
    };
}
