import { Component } from "preact";
import { route } from "preact-router";
import { Input, Loader } from "rsuite";
import { QaClient } from "../api";
import type { WikiDocumentHit } from "../apiTypes/WikiDocumentHit";
import { documentPath } from "../documents";

const MIN_QUERY_CHARS = 2;
const TYPING_PAUSE_MS = 300;

interface DocumentSearchProps {
    readonly client: QaClient;
    /** Tells the page whether results replace the list. */
    readonly onActiveChange: (active: boolean) => void;
}
interface DocumentSearchState {
    readonly query: string;
    readonly hits: WikiDocumentHit[] | null;
    readonly problem: string | null;
    readonly searching: boolean;
}

export default class DocumentSearch extends Component<DocumentSearchProps, DocumentSearchState> {
    state: DocumentSearchState = { query: "", hits: null, problem: null, searching: false };

    private timer: ReturnType<typeof setTimeout> | undefined;
    /** Only the answer to the latest request counts. */
    private latestRequest = 0;

    componentWillUnmount = () => {
        clearTimeout(this.timer);
        this.latestRequest++;
    };

    private change = (query: string) => {
        clearTimeout(this.timer);
        this.latestRequest++;
        const active = query.trim().length >= MIN_QUERY_CHARS;
        this.setState({ query, hits: null, problem: null, searching: active });
        this.props.onActiveChange(query.trim() !== "");
        if (active) this.timer = setTimeout(() => this.search(query), TYPING_PAUSE_MS);
    };

    private search = async (query: string) => {
        const request = ++this.latestRequest;
        const result = await this.props.client.search_documents(query);
        if (request !== this.latestRequest) return;
        if (result.ok) this.setState({ hits: result.hits, searching: false });
        else this.setState({ problem: result.message, searching: false });
    };

    private open = (id: string) => {
        this.change("");
        route(documentPath(id));
    };

    private renderResults = () => {
        const { query, hits, problem, searching } = this.state;
        if (query.trim() === "") return null;
        if (query.trim().length < MIN_QUERY_CHARS) {
            return <p>Bitte mindestens {MIN_QUERY_CHARS} Zeichen eingeben.</p>;
        }
        if (searching) return <Loader content="Suche…" />;
        if (problem) return <p role="alert">{problem}</p>;
        if (hits?.length === 0) return <p>Nichts gefunden.</p>;
        return (
            <ul className="DocumentHits">
                {hits?.map((hit) => (
                    <li key={hit._id}>
                        <button type="button" onClick={() => this.open(hit._id)}>
                            <b>{hit.title}</b>
                            {hit.snippet && <span>{hit.snippet}</span>}
                        </button>
                    </li>
                ))}
            </ul>
        );
    };

    render = () => (
        <div className="DocumentSearch">
            <Input
                type="search"
                aria-label="Dokumente durchsuchen"
                placeholder="Dokumente durchsuchen"
                value={this.state.query}
                onChange={this.change}
            />
            {this.renderResults()}
        </div>
    );
}
