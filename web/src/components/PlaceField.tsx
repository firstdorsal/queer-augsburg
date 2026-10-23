import { Component } from "preact";
import { Message, useToaster } from "rsuite";
import { QaClient } from "../api";
import { Place } from "../apiTypes/Place";
import { findPlaceByName, placeChosenText, withPlace } from "../places";
import { withToasterHook } from "../utils";
import CreatePlaceDialog from "./CreatePlaceDialog";
import LoadError from "./LoadError";
import PlaceSelect from "./PlaceSelect";

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
    /** Suggested name while the "Neuen Ort anlegen" dialog is open. */
    readonly creatingName: string | null;
}

/** Choose one of the stored places, or create a new one (only then the map opens). */
class PlaceField extends Component<PlaceFieldProps, PlaceFieldState> {
    private unmounted = false;

    constructor(props: PlaceFieldProps) {
        super(props);
        this.state = { places: null, loadError: false, creatingName: null };
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

    placeDone = (place: Place, existed: boolean) => {
        this.setState((state) => ({
            creatingName: null,
            places: state.places && withPlace(state.places, place)
        }));
        this.props.onChange(place);
        this.props.toaster.push(
            <Message showIcon type={existed ? "info" : "success"} closable>
                {placeChosenText(place, existed)}
            </Message>,
            { placement: "bottomCenter", duration: 4000 }
        );
    };

    render = () => {
        const { places, loadError, creatingName } = this.state;
        const { placeId, legacyName } = this.props;
        if (loadError) return <LoadError onRetry={this.loadPlaces} />;

        return (
            <div>
                <PlaceSelect
                    places={places}
                    placeId={placeId}
                    label="Ort"
                    onSelect={this.props.onChange}
                    onCreate={(search) =>
                        this.setState({ creatingName: search || legacyName || "" })
                    }
                />
                {!placeId && legacyName && places !== null && (
                    <p className="mb-0 mt-1 text-sm opacity-80">
                        Bisheriger Ort: „{legacyName}“ – bitte einen Ort auswählen oder neu anlegen.
                    </p>
                )}
                {creatingName !== null && places !== null && (
                    <CreatePlaceDialog
                        qaClient={this.props.qaClient}
                        places={places}
                        initialName={creatingName}
                        onDone={this.placeDone}
                        onClose={() => this.setState({ creatingName: null })}
                    />
                )}
            </div>
        );
    };
}

export default withToasterHook(PlaceField);
