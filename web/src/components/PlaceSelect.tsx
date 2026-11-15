import { useState } from "preact/hooks";
import { Place } from "../apiTypes/Place";
import { Button, Select } from "./ui";

interface PlaceSelectProps {
    /** null while the places are loading. */
    readonly places: readonly Place[] | null;
    readonly placeId: string | null;
    readonly label: string;
    readonly onSelect: (place: Place) => void;
    /** "Neuen Ort anlegen" below the list, with what was typed into this dropdown's search;
     * only creating a place opens the map. */
    readonly onCreate: (search: string) => void;
}

/** Dropdown of the stored places with a button to create a new one. */
const PlaceSelect = ({ places, placeId, label, onSelect, onCreate }: PlaceSelectProps) => {
    const [search, setSearch] = useState("");
    return (
        <Select
            block
            data={(places ?? []).map((place) => ({ label: place.name, value: place._id }))}
            value={placeId}
            loading={places === null}
            placeholder="Ort auswählen"
            aria-label={label}
            searchPlaceholder="Ort suchen"
            noResultsText="Kein Ort gefunden, unten neu anlegen"
            onSearch={setSearch}
            onChange={(selectedId) => {
                const place = places?.find((candidate) => candidate._id === selectedId);
                if (!place) {
                    console.error("Selected place is not in the list:", selectedId);
                    return;
                }
                setSearch("");
                onSelect(place);
            }}
            footer={
                <div className="border-t border-ui-border p-2">
                    <Button block size="sm" onClick={() => onCreate(search)}>
                        Neuen Ort anlegen
                    </Button>
                </div>
            }
        />
    );
};

export default PlaceSelect;
