import { Component } from "preact";
import { BsCheckCircle, BsDashCircle, BsExclamationTriangle } from "react-icons/bs";
import { Button, Checkbox, Input, Message, Modal, useToaster } from "rsuite";
import { CreateMeetingsResult, QaClient } from "../api";
import { Meeting } from "../apiTypes/Meeting";
import { NewMeeting } from "../apiTypes/NewMeeting";
import { Place } from "../apiTypes/Place";
import { DAY_MS, formatBerlinTime } from "../berlinTime";
import {
    BulkDraft,
    BulkParseResult,
    PlacePicks,
    draftVenue,
    draftVenueText,
    includedDrafts,
    parseBulkJson,
    toNewMeeting
} from "../bulkImport";
import { buildBulkPrompt } from "../bulkPrompt";
import { placeChosenText, placeNameKey, withPlace } from "../places";
import { G } from "../types";
import { withToasterHook } from "../utils";
import CreatePlaceDialog from "./CreatePlaceDialog";
import LoadError from "./LoadError";
import PlaceSelect from "./PlaceSelect";

interface BulkImportMeetingsProps {
    readonly g: G;
    readonly onClose: () => void;
    /** Shows the (planned) meetings after some were (possibly) created. */
    readonly onCreated: () => Promise<void>;
    /** Injected by withToasterHook. */
    readonly toaster: ReturnType<typeof useToaster>;
}

interface ParseInputs {
    readonly places: Place[];
    /** Stored meetings from yesterday on, active and planned, for the duplicate check and
     * the prompt. Loaded fresh, never from the offline cache. */
    readonly existing: Meeting[];
    readonly jsonText: string;
    readonly picks: PlacePicks;
}

interface BulkImportMeetingsState extends ParseInputs {
    /** Places and existing meetings are loading. */
    readonly loading: boolean;
    readonly loadError: boolean;
    /** Ids of the drafts the member chose not to create ("Nicht anlegen"). */
    readonly leftOut: ReadonlySet<string>;
    /** Derived from the ParseInputs; null while the text field is empty. */
    readonly parsed: BulkParseResult | null;
    /** Name key of the JSON place whose place controls are open although it is resolved. */
    readonly changingPlace: string | null;
    /** While "Neuen Ort anlegen" is open: the JSON place name it is for, and the suggested
     * name (what was typed into that row's dropdown, else the JSON name). */
    readonly creatingPlace: { readonly forName: string; readonly suggestedName: string } | null;
    readonly creating: boolean;
    readonly failure: Extract<CreateMeetingsResult, { ok: false }> | null;
    /** Why creating stopped before anything was sent. */
    readonly notice: string | null;
    /** Shown when the clipboard API is unavailable so the prompt can be copied by hand. */
    readonly promptFallback: string | null;
}

const priceText = (price: readonly number[]) =>
    price.length === 2 && price[0] !== price[1]
        ? `${price[0]}–${price[1]} €`
        : `${price[0] ?? 0} €`;

const ageText = (age: readonly number[]) =>
    age.length === 2 ? `${age[0]}–${age[1]} Jahre` : age[0] ? `ab ${age[0]} Jahren` : "alle";

const meetingCountText = (count: number) => (count === 1 ? "1 Treffen" : `${count} Treffen`);

/** Whether re-checking gave a draft a hint it did not have when the member reviewed it. */
const hasNewWarnings = (reviewed: readonly BulkDraft[], rechecked: readonly BulkDraft[]) =>
    rechecked.some((draft) => {
        const before = reviewed.find((candidate) => candidate.id === draft.id);
        return !before || draft.warnings.some((warning) => !before.warnings.includes(warning));
    });

class BulkImportMeetings extends Component<BulkImportMeetingsProps, BulkImportMeetingsState> {
    private unmounted = false;
    /** Synchronous guard: state updates are async, so a fast double click could pass `creating`. */
    private createInFlight = false;

    constructor(props: BulkImportMeetingsProps) {
        super(props);
        this.state = {
            places: [],
            existing: [],
            loading: true,
            loadError: false,
            leftOut: new Set(),
            jsonText: "",
            picks: {},
            parsed: null,
            changingPlace: null,
            creatingPlace: null,
            creating: false,
            failure: null,
            notice: null,
            promptFallback: null
        };
    }

    componentDidMount = () => {
        this.load();
    };

    /** Meetings from yesterday on: the prompt lists them, the drafts are compared with
     * them (older drafts get the "in der Vergangenheit" hint anyway). */
    fetchExisting = async (qaClient: QaClient): Promise<Meeting[]> => {
        const from = Date.now() - DAY_MS;
        const [active, planned] = await Promise.all([
            qaClient.get_upcoming_meetings("Active", from),
            qaClient.get_upcoming_meetings("Planned", from)
        ]);
        return [...active, ...planned];
    };

    load = async () => {
        const qaClient = this.props.g.qaClient;
        if (!qaClient) {
            console.error("Bulk import without an API client");
            this.setState({ loading: false, loadError: true });
            return;
        }
        this.setState({ loading: true, loadError: false });
        try {
            const [places, existing] = await Promise.all([
                qaClient.get_places(),
                this.fetchExisting(qaClient)
            ]);
            if (this.unmounted) return;
            this.setState({ loading: false });
            this.updateInputs({ places, existing });
        } catch (error) {
            console.error("Loading places and meetings failed:", error);
            if (!this.unmounted) this.setState({ loading: false, loadError: true });
        }
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
                      existing: next.existing,
                      now: Date.now()
                  })
                : null;
            return { ...change, parsed, failure: null, notice: null };
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

    setLeftOut = (draftId: string, leaveOut: boolean) => {
        this.setState((state) => {
            const leftOut = new Set(state.leftOut);
            if (leaveOut) leftOut.add(draftId);
            else leftOut.delete(draftId);
            return { leftOut, failure: null };
        });
    };

    drafts = (): BulkDraft[] => (this.state.parsed?.ok ? this.state.parsed.drafts : []);

    copyPrompt = async (qaClient: QaClient) => {
        const prompt = buildBulkPrompt({
            now: new Date(),
            places: this.state.places,
            existing: this.state.existing,
            overviewUrl: qaClient.meetingsOverviewUrl()
        });
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
        const checked = includedDrafts(this.drafts(), this.state.leftOut);
        const meetings = checked.map(toNewMeeting);
        if (!qaClient || this.createInFlight || meetings.length === 0) return;
        const ready = meetings.filter((meeting): meeting is NewMeeting => meeting !== null);
        if (ready.length !== meetings.length) return;
        this.createInFlight = true;
        this.setState({ creating: true, failure: null, notice: null });

        // Another editor may have added meetings since the dialog was opened: check again.
        const existing = await this.refreshExisting(qaClient);
        if (existing === null) {
            this.stopCreating(
                "Die bestehenden Termine konnten nicht geladen werden, deshalb wurde nichts angelegt. Bitte erneut versuchen."
            );
            return;
        }
        const recheck = parseBulkJson(this.state.jsonText, {
            places: this.state.places,
            picks: this.state.picks,
            existing,
            now: Date.now()
        });
        if (
            !recheck.ok ||
            hasNewWarnings(checked, includedDrafts(recheck.drafts, this.state.leftOut))
        ) {
            this.stopCreating(
                "Inzwischen gibt es neue Termine, die passen könnten. Es wurde nichts angelegt: bitte die Hinweise prüfen und dann erneut anlegen."
            );
            return;
        }

        const result = await qaClient.create_meetings(ready);
        if (!result.ok) {
            if (result.kind === "unknown") {
                // Some may exist now: show them in the hints and the list.
                await this.refreshExisting(qaClient);
                await this.reloadAfterCreate();
            }
            this.createInFlight = false;
            if (!this.unmounted) this.setState({ creating: false, failure: result });
            return;
        }

        this.props.toaster.push(
            <Message showIcon type="success" closable>
                {meetingCountText(result.meetings.length)} als „Geplant“ angelegt: bitte unter
                „Geplante Treffen“ prüfen und einzeln auf „Aktiv“ stellen.
            </Message>,
            { placement: "bottomCenter", duration: 8000 }
        );
        await this.reloadAfterCreate();
        this.createInFlight = false;
        // Reset first: close() refuses to close while creating.
        this.setState({ creating: false }, this.props.onClose);
    };

    /** Loads the stored meetings again and re-checks the drafts; null if that failed. */
    refreshExisting = async (qaClient: QaClient): Promise<Meeting[] | null> => {
        try {
            const existing = await this.fetchExisting(qaClient);
            if (!this.unmounted) this.updateInputs({ existing });
            return existing;
        } catch (error) {
            console.error("Reloading the stored meetings failed:", error);
            return null;
        }
    };

    stopCreating = (notice: string) => {
        this.createInFlight = false;
        if (!this.unmounted) this.setState({ creating: false, notice });
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
        // Next to "to be announced", a place name is an error to fix in the JSON, not to pick.
        if (
            !draft.placeName ||
            draftVenue(draft.fields, draft.placeName).inPerson.kind !== "place"
        ) {
            return null;
        }
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
        const leftOut = this.state.leftOut.has(draft.id);
        const dimmed = leftOut ? "opacity-60" : "";
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
                key={draft.id}
                className="border-b border-[var(--background-color-2)] py-3 last:border-b-0"
            >
                <div className={`flex items-baseline gap-2 ${dimmed}`}>
                    {leftOut ? (
                        <span className="shrink-0" role="img" aria-label="Wird nicht angelegt">
                            <BsDashCircle />
                        </span>
                    ) : draft.errors.length === 0 ? (
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
                        {leftOut && <span className="text-sm"> (wird nicht angelegt)</span>}
                    </span>
                </div>
                <div className={`pl-6 ${dimmed}`}>
                    <div className="text-sm opacity-80">
                        {fields.time === null ? "Zeit fehlt" : formatBerlinTime(fields.time)}
                        {" · "}
                        <span className="break-words">
                            {draftVenueText(draft.fields, draft.placeName)}
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
                </div>
                {/* Outside the dimmed block, so the controls stay readable. */}
                <div className="pl-6">
                    {!leftOut && this.renderPlaceControls(draft, number)}
                    <div>
                        {/* -ml-2.5 aligns rsuite's padded checkbox with the text above. */}
                        <Checkbox
                            className="-ml-2.5"
                            checked={leftOut}
                            onChange={(_value, checked) => this.setLeftOut(draft.id, checked)}
                        >
                            Nicht anlegen
                        </Checkbox>
                    </div>
                </div>
            </li>
        );
    };

    render = () => {
        const { parsed, creating, failure, notice, creatingPlace, jsonText } = this.state;
        const qaClient = this.props.g.qaClient;
        const drafts = this.drafts();
        const included = includedDrafts(drafts, this.state.leftOut);
        const readyCount = included.filter((draft) => draft.errors.length === 0).length;
        const ready = included.length > 0 && readyCount === included.length;
        const leftOutCount = drafts.length - included.length;
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
                            Die Treffen werden als „Geplant“ angelegt und sind erst öffentlich, wenn
                            du sie unter „Geplante Treffen“ einzeln auf „Aktiv“ stellst.
                        </p>
                        <p className="mb-2">
                            <b>1.</b> Kopiere den Prompt und füge ihn zusammen mit deiner
                            Beschreibung der Termine in ein KI-Modell deiner Wahl ein. Die KI fragt
                            nach, wenn etwas fehlt, und antwortet am Ende mit JSON. Sie fragt auch
                            nach freiwilligen Angaben wie Kosten, Alter, Barrierefreiheit und
                            Triggerwarnungen; die darfst du weglassen. Damit sie doppelte Termine
                            erkennt, enthält der Prompt Titel, Zeit und Ort der nächsten Termine,
                            auch der geplanten; kann sie Webseiten abrufen, liest sie die
                            veröffentlichten Termine auch selbst von der Website.
                        </p>
                        {this.state.loadError || !qaClient ? (
                            <LoadError
                                message="Die Orte und Treffen konnten nicht geladen werden."
                                onRetry={this.load}
                            />
                        ) : (
                            <Button
                                appearance="primary"
                                onClick={() => this.copyPrompt(qaClient)}
                                loading={this.state.loading}
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
                            disabled={this.state.loading || this.state.loadError || creating}
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
                                    {meetingCountText(included.length)} bereit
                                    {leftOutCount > 0 && `, ${leftOutCount} nicht angelegt`}
                                </p>
                                <ul className="m-0 list-none p-0">
                                    {drafts.map(this.renderDraft)}
                                </ul>
                            </>
                        )}
                        {notice !== null && (
                            <Message showIcon type="warning" className="mt-3">
                                {notice}
                            </Message>
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
                        {creatingPlace !== null && qaClient && (
                            <CreatePlaceDialog
                                qaClient={qaClient}
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
                            {included.length > 0
                                ? `${meetingCountText(included.length)} anlegen`
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
