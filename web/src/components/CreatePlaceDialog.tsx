import { Component } from "preact";
import { Button, Input, Message } from "rsuite";
import { QaClient } from "../api";
import { Place } from "../apiTypes/Place";
import { findPlaceByName } from "../places";
import LocationPicker from "./LocationPicker";

interface CreatePlaceDialogProps {
    readonly qaClient: QaClient;
    readonly places: readonly Place[];
    /** E.g. what was typed into the place search. */
    readonly initialName: string;
    /** `existed`: the member picked (or the server returned) an existing place instead. */
    readonly onDone: (place: Place, existed: boolean) => void;
    readonly onClose: () => void;
}

interface CreatePlaceDialogState {
    readonly name: string;
    readonly position: { lat: number; lon: number } | null;
    readonly saving: boolean;
    readonly error: string | null;
}

export default class CreatePlaceDialog extends Component<
    CreatePlaceDialogProps,
    CreatePlaceDialogState
> {
    private unmounted = false;

    constructor(props: CreatePlaceDialogProps) {
        super(props);
        this.state = { name: props.initialName.trim(), position: null, saving: false, error: null };
    }

    componentWillUnmount = () => {
        this.unmounted = true;
    };

    create = async () => {
        const name = this.state.name.trim();
        const position = this.state.position;
        if (!name || !position || this.state.saving) return;
        this.setState({ saving: true, error: null });
        const result = await this.props.qaClient.create_place({
            name,
            lat: position.lat,
            lon: position.lon
        });
        if (this.unmounted) return;
        if (!result.ok) {
            this.setState({ saving: false, error: result.message });
            return;
        }
        this.props.onDone(result.place, !result.created);
    };

    render = () => {
        const { position, saving, error } = this.state;
        const name = this.state.name.trim();
        const existing = findPlaceByName(this.props.places, name);
        const initialName = this.props.initialName.trim();

        return (
            <LocationPicker
                title="Neuen Ort anlegen"
                initialSearchQuery={initialName ? `${initialName}, Augsburg` : ""}
                lat={position?.lat}
                lon={position?.lon}
                onLocationSelect={(lat, lon) => this.setState({ position: { lat, lon } })}
                onClose={this.props.onClose}
                footer={
                    <>
                        <Button onClick={this.props.onClose} appearance="subtle" disabled={saving}>
                            Abbrechen
                        </Button>
                        <Button
                            appearance="primary"
                            onClick={this.create}
                            disabled={!name || !position || existing !== null}
                            loading={saving}
                        >
                            Ort anlegen
                        </Button>
                    </>
                }
            >
                <label className="mb-1 block font-semibold" htmlFor="create-place-name">
                    Name des Ortes
                </label>
                <Input
                    id="create-place-name"
                    value={this.state.name}
                    onChange={(value: string) => this.setState({ name: value, error: null })}
                    placeholder="z. B. Café Neruda"
                />
                {existing && (
                    <Message showIcon type="info" className="mt-2">
                        Den Ort „{existing.name}“ gibt es schon.{" "}
                        <Button
                            appearance="link"
                            size="sm"
                            className="p-0 align-baseline"
                            onClick={() => this.props.onDone(existing, true)}
                        >
                            Diesen auswählen
                        </Button>
                    </Message>
                )}
                <p className="mb-3 mt-3 text-sm opacity-80">
                    Suche die Adresse oder klicke auf die Karte, um die Position zu setzen.{" "}
                    <b>{position ? "Position gesetzt." : "Noch keine Position gesetzt."}</b>
                </p>
                {error !== null && (
                    <Message showIcon type="error" className="mb-3">
                        {error}
                    </Message>
                )}
            </LocationPicker>
        );
    };
}
