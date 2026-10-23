import { Component } from "preact";
import { BsCheckCircle, BsExclamationTriangle } from "react-icons/bs";
import { Button, Input, Message, Modal, useToaster } from "rsuite";
import { CreateMeetingsResult } from "../api";
import { MeetingStatus } from "../apiTypes/MeetingStatus";
import { NewMeeting } from "../apiTypes/NewMeeting";
import { NewOnlineMeeting } from "../apiTypes/NewOnlineMeeting";
import { Place } from "../apiTypes/Place";
import {
    BulkDraft,
    BulkParseResult,
    PlacePicks,
    TIME_ZONE,
    buildBulkPrompt,
    parseBulkJson,
    toNewMeeting
} from "../bulkImport";
import {
    MEMBERS_ONLY_LINK_TEXT,
    onlineLabel,
    placeChosenText,
    placeNameKey,
    withPlace
} from "../places";
import { G } from "../types";
import { withToasterHook } from "../utils";
import CreatePlaceDialog from "./CreatePlaceDialog";
import PlaceSelect, { PlacesLoadError } from "./PlaceSelect";

interface BulkImportMeetingsProps {
    readonly g: G;
    readonly status: MeetingStatus;
    readonly onClose: () => void;
    /** Reloads the meeting list after meetings were (possibly) created. */
    readonly onCreated: () => Promise<void>;
    /** Injected by withToasterHook. */
    readonly toaster: ReturnType<typeof useToaster>;
}

interface ParseInputs {
    readonly places: Place[];
    readonly jsonText: string;
    readonly picks: PlacePicks;
}

interface BulkImportMeetingsState extends ParseInputs {
    readonly placesLoading: boolean;
    readonly placesError: boolean;
    /** Derived from the ParseInputs; null while the text field is empty. */
    readonly parsed: BulkParseResult | null;
    /** Name key of the JSON place whose place controls are open although it is resolved. */
    readonly changingPlace: string | null;
    /** While "Neuen Ort anlegen" is open: the JSON place name it is for, and the suggested
     * name (what was typed into that row's dropdown, else the JSON name). */
    readonly creatingPlace: { readonly forName: string; readonly suggestedName: string } | null;
    readonly creating: boolean;
    readonly failure: Extract<CreateMeetingsResult, { ok: false }> | null;
    /** Shown when the clipboard API is unavailable so the prompt can be copied by hand. */
    readonly promptFallback: string | null;
}

const STATUS_LABELS: Record<MeetingStatus, string> = { Active: "Aktiv", Planned: "Geplant" };

const timeFormat = new Intl.DateTimeFormat("de-DE", {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
});

const priceText = (price: readonly number[]) =>
    price.length === 2 && price[0] !== price[1]
        ? `${price[0]}–${price[1]} €`
        : `${price[0] ?? 0} €`;

const ageText = (age: readonly number[]) =>
    age.length === 2 ? `${age[0]}–${age[1]} Jahre` : age[0] ? `ab ${age[0]} Jahren` : "alle";

const meetingCountText = (count: number) => (count === 1 ? "1 Treffen" : `${count} Treffen`);

const onlineText = (online: NewOnlineMeeting) =>
    `${onlineLabel(online)} · ${
        online.url === null
            ? "noch ohne Link"
            : online.members_only
              ? MEMBERS_ONLY_LINK_TEXT
              : "Link öffentlich"
    }`;

class BulkImportMeetings extends Component<BulkImportMeetingsProps, BulkImportMeetingsState> {
    private unmounted = false;
    /** Synchronous guard: state updates are async, so a fast double click could pass `creating`. */
    private createInFlight = false;

    constructor(props: BulkImportMeetingsProps) {
        super(props);
        this.state = {
            places: [],
            placesLoading: true,
            placesError: false,
            jsonText: "",
            picks: {},
            parsed: null,
            changingPlace: null,
            creatingPlace: null,
            creating: false,
            failure: null,
            promptFallback: null
        };
    }

    componentDidMount = () => {
        this.loadPlaces();
    };

    loadPlaces = async () => {
        const qaClient = this.props.g.qaClient;
        if (!qaClient) {
            console.error("Bulk import without an API client");
            this.setState({ placesLoading: false, placesError: true });
            return;
        }
        this.setState({ placesLoading: true, placesError: false });
        let places: Place[];
        try {
            places = await qaClient.get_places();
        } catch (error) {
            console.error("Loading places failed:", error);
            if (!this.unmounted) this.setState({ placesLoading: false, placesError: true });
            return;
        }
        if (this.unmounted) return;
        this.setState({ placesLoading: false });
        this.updateInputs({ places });
    };

    componentWillUnmount = () => {
        this.unmounted = true;
    };

    /** Applies changed inputs and re-parses, so place picks survive edits of the JSON. */
    updateInputs = (
        update: Partial<ParseInputs> | ((inputs: ParseInputs) => Partial<ParseInputs>)
    ) => {
        this.setState((state) => {
            const change = typeof update === "function" ? update(state) : update;
            const next = { ...state, ...change };
            const parsed = next.jsonText.trim()
                ? parseBulkJson(next.jsonText, {
                      places: next.places,
                      picks: next.picks,
                      status: this.props.status,
                      now: Date.now()
                  })
                : null;
            return { ...change, parsed, failure: null };
        });
    };

    /** Picks `place` for every meeting with this place name in the JSON; a newly created
     * place is also added to the list. One state update, so nothing is computed from stale
     * state. */
    pickPlace = (placeName: string, place: Place) => {
        this.setState({ changingPlace: null, creatingPlace: null });
        this.updateInputs((state) => ({
            places: withPlace(state.places, place),
            picks: { ...state.picks, [placeNameKey(placeName)]: place._id }
        }));
    };

    placeCreated = (placeName: string, place: Place, existed: boolean) => {
        this.pickPlace(placeName, place);
        this.props.toaster.push(
            <Message showIcon type={existed ? "info" : "success"} closable>
                {placeChosenText(place, existed)}
            </Message>,
            { placement: "bottomCenter", duration: 4000 }
        );
    };

    close = () => {
        if (!this.state.creating) this.props.onClose();
    };

    copyPrompt = async () => {
        const prompt = buildBulkPrompt(new Date(), this.state.places);
        try {
            await navigator.clipboard.writeText(prompt);
            this.setState({ promptFallback: null });
            this.props.toaster.push(
                <Message showIcon type="success" closable>
                    Prompt kopiert!
                </Message>,
                { placement: "bottomCenter", duration: 3000 }
            );
        } catch (error) {
            console.error("Clipboard write failed:", error);
            this.setState({ promptFallback: prompt });
        }
    };

    create = async () => {
        const qaClient = this.props.g.qaClient;
        const drafts = this.state.parsed?.ok ? this.state.parsed.drafts : [];
        const meetings = drafts.map(toNewMeeting);
        if (
            !qaClient ||
            this.createInFlight ||
            meetings.length === 0 ||
            meetings.some((meeting) => meeting === null)
        ) {
            return;
        }
        this.createInFlight = true;
        this.setState({ creating: true, failure: null });

        const result = await qaClient.create_meetings(meetings as NewMeeting[]);
        if (!result.ok) {
            if (result.kind === "unknown") await this.reloadAfterCreate();
            this.createInFlight = false;
            if (!this.unmounted) this.setState({ creating: false, failure: result });
            return;
        }

        this.props.toaster.push(
            <Message showIcon type="success" closable>
                {meetingCountText(result.meetings.length)} angelegt!
            </Message>,
            { placement: "bottomCenter", duration: 5000 }
        );
        await this.reloadAfterCreate();
        this.createInFlight = false;
        // Reset first: close() refuses to close while creating.
        this.setState({ creating: false }, this.props.onClose);
    };

    reloadAfterCreate = async () => {
        try {
            await this.props.onCreated();
        } catch (error) {
            console.error("Reloading the meeting list failed:", error);
            this.props.toaster.push(
                <Message showIcon type="warning" closable>
                    Die Liste konnte nicht neu geladen werden, bitte die Seite neu laden.
                </Message>,
                { placement: "bottomCenter", duration: 8000 }
            );
        }
    };

    renderPlaceControls = (draft: BulkDraft, number: number) => {
        const placeKey = placeNameKey(draft.placeName);
        const place = draft.fields.place;
        // With online details, a place name is an error to fix in the JSON, not to pick.
        if (!draft.placeName || draft.fields.online !== null) return null;
        if (place !== null && this.state.changingPlace !== placeKey) {
            return (
                <Button
                    appearance="link"
                    size="sm"
                    className="mt-1 px-0"
                    onClick={() => this.setState({ changingPlace: placeKey })}
                >
                    Ort ändern
                </Button>
            );
        }
        return (
            <div className="mt-2">
                <PlaceSelect
                    places={this.state.places}
                    placeId={place?._id ?? null}
                    label={`Ort für Treffen ${number}`}
                    onSelect={(selected) => this.pickPlace(draft.placeName, selected)}
                    onCreate={(search) =>
                        this.setState({
                            creatingPlace: {
                                forName: draft.placeName,
                                suggestedName: search || draft.placeName
                            }
                        })
                    }
                />
            </div>
        );
    };

    renderDraft = (draft: BulkDraft, index: number) => {
        const fields = draft.fields;
        const number = index + 1;
        const tags = [...fields.tags.common, ...fields.tags.queer, ...fields.tags.freeform];
        const details = [
            fields.authority && `Ansprechperson: ${fields.authority}`,
            `Preis: ${priceText(fields.price)}`,
            `Alter: ${ageText(fields.age_restriction)}`,
            tags.length > 0 && `Tags: ${tags.join(", ")}`,
            fields.accessibility && `Barrierefreiheit: ${fields.accessibility}`,
            fields.trigger_warning && `Triggerwarnung: ${fields.trigger_warning}`
        ].filter(Boolean);

        return (
            <li
                key={index}
                className="border-b border-[var(--background-color-2)] py-3 last:border-b-0"
            >
                <div className="flex items-baseline gap-2">
                    {draft.errors.length === 0 ? (
                        <span
                            className="shrink-0 text-[var(--color-success-icon)]"
                            role="img"
                            aria-label="Bereit"
                        >
                            <BsCheckCircle />
                        </span>
                    ) : (
                        <span
                            className="shrink-0 text-[var(--color-error-text)]"
                            role="img"
                            aria-label="Fehler"
                        >
                            <BsExclamationTriangle />
                        </span>
                    )}
                    <span className="min-w-0 break-words">
                        <span className="text-sm opacity-80">Treffen {number}: </span>
                        <b>{fields.title || "(ohne Titel)"}</b>
                    </span>
                </div>
                <div className="pl-6">
                    <div className="text-sm opacity-80">
                        {fields.time === null ? "Zeit fehlt" : timeFormat.format(fields.time)}
                        {" · "}
                        <span className="break-words">
                            {fields.online !== null
                                ? onlineText(fields.online)
                                : fields.place?.name || draft.placeName || "Ort fehlt"}
                        </span>
                    </div>
                    <div className="break-words text-sm opacity-80">{details.join(" · ")}</div>
                    {fields.description && (
                        <p className="m-0 line-clamp-2 whitespace-pre-line break-words text-sm opacity-80">
                            {fields.description}
                        </p>
                    )}
                    {draft.errors.length > 0 && (
                        <ul className="m-0 mt-1 list-disc pl-4 text-sm text-[var(--color-error-text)]">
                            {draft.errors.map((error, errorIndex) => (
                                <li key={errorIndex} className="break-words">
                                    {error}
                                </li>
                            ))}
                        </ul>
                    )}
                    {draft.warnings.length > 0 && (
                        <ul className="m-0 mt-1 list-disc pl-4 text-sm text-[var(--color-warning-text)]">
                            {draft.warnings.map((warning, warningIndex) => (
                                <li key={warningIndex} className="break-words">
                                    Hinweis: {warning}
                                </li>
                            ))}
                        </ul>
                    )}
                    {this.renderPlaceControls(draft, number)}
                </div>
            </li>
        );
    };

    render = () => {
        const { parsed, creating, failure, creatingPlace, jsonText } = this.state;
        const drafts = parsed?.ok ? parsed.drafts : [];
        const readyCount = drafts.filter((draft) => draft.errors.length === 0).length;
        const ready = drafts.length > 0 && readyCount === drafts.length;
        // Unsaved pasted JSON must not be lost to a stray backdrop click or Esc.
        const keepOpen = creating || jsonText.trim() !== "";

        return (
            <div className="BulkImportMeetings">
                <Modal
                    open={true}
                    onClose={this.close}
                    backdrop={keepOpen ? "static" : true}
                    keyboard={!keepOpen}
                >
                    <Modal.Header closeButton={!creating}>
                        <Modal.Title>Mehrere Treffen anlegen</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <p className="mb-2 text-sm opacity-80">
                            Die Treffen werden mit dem Status „{STATUS_LABELS[this.props.status]}“
                            angelegt.
                        </p>
                        <p className="mb-2">
                            <b>1.</b> Kopiere den Prompt und füge ihn zusammen mit deiner
                            Beschreibung der Termine in ein KI-Modell deiner Wahl ein. Die KI fragt
                            nach, wenn etwas fehlt, und antwortet am Ende mit JSON.
                        </p>
                        {this.state.placesError ? (
                            <PlacesLoadError onRetry={this.loadPlaces} />
                        ) : (
                            <Button
                                appearance="primary"
                                onClick={this.copyPrompt}
                                loading={this.state.placesLoading}
                            >
                                Prompt kopieren
                            </Button>
                        )}
                        {this.state.promptFallback !== null && (
                            <div className="mt-2">
                                <p className="text-sm opacity-80">
                                    Kopieren in die Zwischenablage ist hier nicht möglich. Bitte den
                                    Text markieren und kopieren:
                                </p>
                                <Input
                                    as="textarea"
                                    rows={8}
                                    readOnly
                                    value={this.state.promptFallback}
                                    aria-label="Prompt"
                                />
                            </div>
                        )}
                        <p className="mb-2 mt-5">
                            <b>2.</b> Füge die Antwort der KI hier ein:
                        </p>
                        <Input
                            as="textarea"
                            rows={8}
                            value={jsonText}
                            onChange={(value: string) => this.updateInputs({ jsonText: value })}
                            disabled={
                                this.state.placesLoading || this.state.placesError || creating
                            }
                            placeholder='[{ "title": "Stammtisch", "start": "2026-10-27T19:00", "place": "…" }]'
                            aria-label="JSON mit Treffen"
                        />
                        {parsed !== null && !parsed.ok && (
                            <Message showIcon type="error" className="mt-3">
                                {parsed.error}
                            </Message>
                        )}
                        {drafts.length > 0 && (
                            <>
                                <p className="mb-0 mt-5" aria-live="polite">
                                    <b>3.</b> Prüfen: {readyCount} von{" "}
                                    {meetingCountText(drafts.length)} bereit
                                </p>
                                <ul className="m-0 list-none p-0">
                                    {drafts.map(this.renderDraft)}
                                </ul>
                            </>
                        )}
                        {failure !== null && (
                            <Message
                                showIcon
                                type={failure.kind === "unknown" ? "warning" : "error"}
                                className="mt-3"
                            >
                                {failure.kind === "unknown"
                                    ? failure.message
                                    : `Es wurde nichts angelegt: ${failure.message}`}
                            </Message>
                        )}
                        {creatingPlace !== null && this.props.g.qaClient && (
                            <CreatePlaceDialog
                                qaClient={this.props.g.qaClient}
                                places={this.state.places}
                                initialName={creatingPlace.suggestedName}
                                onDone={(place, existed) =>
                                    this.placeCreated(creatingPlace.forName, place, existed)
                                }
                                onClose={() => this.setState({ creatingPlace: null })}
                            />
                        )}
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            appearance="primary"
                            onClick={this.create}
                            disabled={!ready}
                            loading={creating}
                        >
                            {drafts.length > 0
                                ? `${meetingCountText(drafts.length)} anlegen`
                                : "Treffen anlegen"}
                        </Button>
                        <Button onClick={this.close} appearance="subtle" disabled={creating}>
                            Abbrechen
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    };
}

export default withToasterHook(BulkImportMeetings);
