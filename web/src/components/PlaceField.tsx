import { Component } from "preact";
import { Button, Message, SelectPicker, useToaster } from "rsuite";
import { QaClient } from "../api";
import { Place } from "../apiTypes/Place";
import { findPlaceByName, placeNameKey } from "../places";
import { withToasterHook } from "../utils";
import CreatePlaceDialog from "./CreatePlaceDialog";

interface PlaceFieldProps {
    readonly qaClient: QaClient;
    readonly placeId: string | null;
    /** Location name of a meeting saved before places existed (no `placeId`). */
    readonly legacyName: string | null;
    readonly onChange: (place: Place) => void;
    /** Injected by withToasterHook. */
    readonly toaster: ReturnType<typeof useToaster>;
}

interface PlaceFieldState {
    readonly places: Place[] | null;
    readonly loadError: boolean;
    readonly search: string;
    readonly creating: boolean;
}

const byName = (a: Place, b: Place) => placeNameKey(a.name).localeCompare(placeNameKey(b.name));

/** Choose one of the stored places, or create a new one (only then the map opens). */
class PlaceField extends Component<PlaceFieldProps, PlaceFieldState> {
    private unmounted = false;

    constructor(props: PlaceFieldProps) {
        super(props);
        this.state = { places: null, loadError: false, search: "", creating: false };
    }

    componentDidMount = () => {
        this.loadPlaces();
    };

    componentWillUnmount = () => {
        this.unmounted = true;
    };

    loadPlaces = async () => {
        this.setState({ loadError: false });
        let places: Place[];
        try {
            places = await this.props.qaClient.get_places();
        } catch (error) {
            console.error("Loading places failed:", error);
            if (!this.unmounted) this.setState({ loadError: true });
            return;
        }
        if (this.unmounted) return;
        this.setState({ places });
        // A meeting from before places existed: pre-select its place if the name matches.
        if (!this.props.placeId && this.props.legacyName) {
            const match = findPlaceByName(places, this.props.legacyName);
            if (match) this.props.onChange(match);
        }
    };

    select = (place: Place) => {
        this.setState({ search: "" });
        this.props.onChange(place);
    };

    placeDone = (place: Place, existed: boolean) => {
        this.setState((state) => ({
            creating: false,
            places:
                state.places && !state.places.some((known) => known._id === place._id)
                    ? [...state.places, place].sort(byName)
                    : state.places
        }));
        this.select(place);
        this.props.toaster.push(
            <Message showIcon type={existed ? "info" : "success"} closable>
                {existed
                    ? `Bestehenden Ort „${place.name}“ ausgewählt.`
                    : `Ort „${place.name}“ angelegt.`}
            </Message>,
            { placement: "bottomCenter", duration: 4000 }
        );
    };

    render = () => {
        const { places, loadError, creating, search } = this.state;
        const { placeId, legacyName } = this.props;
        if (loadError) {
            return (
                <Message showIcon type="error">
                    Die Orte konnten nicht geladen werden.{" "}
                    <Button appearance="link" size="sm" className="p-0" onClick={this.loadPlaces}>
                        Erneut versuchen
                    </Button>
                </Message>
            );
        }

        return (
            <div>
                <SelectPicker
                    block
                    data={(places ?? []).map((place) => ({ label: place.name, value: place._id }))}
                    value={placeId}
                    loading={places === null}
                    placeholder="Ort auswählen"
                    aria-label="Ort"
                    cleanable={false}
                    locale={{
                        searchPlaceholder: "Ort suchen",
                        noResultsText: "Kein Ort gefunden, unten neu anlegen"
                    }}
                    onSearch={(value: string) => this.setState({ search: value })}
                    onChange={(selectedId: string | null) => {
                        const place = places?.find((candidate) => candidate._id === selectedId);
                        if (place) this.select(place);
                    }}
                    renderExtraFooter={() => (
                        <div className="border-t border-[var(--rs-border-primary)] p-2">
                            <Button
                                block
                                size="sm"
                                onClick={() => this.setState({ creating: true })}
                            >
                                Neuen Ort anlegen
                            </Button>
                        </div>
                    )}
                />
                {!placeId && legacyName && places !== null && (
                    <p className="mb-0 mt-1 text-sm opacity-80">
                        Bisheriger Ort: „{legacyName}“ – bitte einen Ort auswählen oder neu anlegen.
                    </p>
                )}
                {creating && places !== null && (
                    <CreatePlaceDialog
                        qaClient={this.props.qaClient}
                        places={places}
                        initialName={search || legacyName || ""}
                        onDone={this.placeDone}
                        onClose={() => this.setState({ creating: false, search: "" })}
                    />
                )}
            </div>
        );
    };
}

export default withToasterHook(PlaceField);
