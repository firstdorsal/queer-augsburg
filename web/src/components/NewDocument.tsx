import { Component } from "preact";
import { Button, CheckPicker, Input } from "rsuite";
import type { CreateDocumentRequestBody } from "../apiTypes/CreateDocumentRequestBody";
import type { WikiDocumentGroup } from "../apiTypes/WikiDocumentGroup";
import { cleanName, MAX_DOCUMENT_TEXT_CHARS, MAX_DOCUMENT_TITLE_CHARS } from "../documents";
import Md from "./Md";

interface NewDocumentProps {
    readonly groups: WikiDocumentGroup[];
    readonly busy: boolean;
    readonly problem: string | null;
    readonly onCreate: (document: CreateDocumentRequestBody) => void;
    readonly onCancel: () => void;
}
interface NewDocumentState {
    readonly title: string;
    readonly content: string;
    readonly groupIds: string[];
    readonly invalid: string | null;
}

export default class NewDocument extends Component<NewDocumentProps, NewDocumentState> {
    state: NewDocumentState = { title: "", content: "", groupIds: [], invalid: null };

    private create = () => {
        const title = cleanName(this.state.title, MAX_DOCUMENT_TITLE_CHARS);
        if (title === null) {
            this.setState({ invalid: "Bitte einen Titel ohne Sonderzeichen angeben." });
            return;
        }
        if ([...this.state.content].length > MAX_DOCUMENT_TEXT_CHARS) {
            this.setState({ invalid: "Der Text ist zu lang." });
            return;
        }
        this.setState({ invalid: null });
        this.props.onCreate({
            title,
            content: this.state.content,
            group_ids: this.state.groupIds
        });
    };

    render = () => {
        const { groups, busy, problem, onCancel } = this.props;
        const { title, content, groupIds, invalid } = this.state;
        const message = invalid ?? problem;
        return (
            <div className="DocumentBody">
                <h1>Neues Dokument</h1>
                {message && <p role="alert">{message}</p>}
                <b>Titel</b>
                <Input value={title} onChange={(value) => this.setState({ title: value })} />
                <br />
                <b>Text (Markdown)</b>
                <Input
                    as="textarea"
                    rows={12}
                    value={content}
                    onChange={(value) => this.setState({ content: value })}
                />
                <br />
                <CheckPicker
                    aria-label="Gruppen des Dokuments"
                    placeholder="Gruppen"
                    searchable={false}
                    value={groupIds}
                    data={groups.map((group) => ({ value: group._id, label: group.name }))}
                    onChange={(value) => this.setState({ groupIds: value as string[] })}
                />
                <div className="DocumentActions">
                    <Button appearance="primary" disabled={busy} onClick={this.create}>
                        Anlegen
                    </Button>
                    <Button disabled={busy} onClick={onCancel}>
                        Abbrechen
                    </Button>
                </div>
                <b>Vorschau</b>
                <Md page plainText={`# ${title}\n\n${content}`} />
            </div>
        );
    };
}
