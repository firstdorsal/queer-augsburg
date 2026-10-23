import { useState } from "preact/hooks";
import { Button, SelectPicker } from "rsuite";
import { Place } from "../apiTypes/Place";

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
        <SelectPicker
            block
            data={(places ?? []).map((place) => ({ label: place.name, value: place._id }))}
            value={placeId}
            loading={places === null}
            placeholder="Ort auswählen"
            aria-label={label}
            cleanable={false}
            locale={{
                searchPlaceholder: "Ort suchen",
                noResultsText: "Kein Ort gefunden, unten neu anlegen"
            }}
            onSearch={setSearch}
            onChange={(selectedId: string | null) => {
                const place = places?.find((candidate) => candidate._id === selectedId);
                if (!place) {
                    console.error("Selected place is not in the list:", selectedId);
                    return;
                }
                setSearch("");
                onSelect(place);
            }}
            renderExtraFooter={() => (
                <div className="border-t border-[var(--rs-border-primary)] p-2">
                    <Button block size="sm" onClick={() => onCreate(search)}>
                        Neuen Ort anlegen
                    </Button>
                </div>
            )}
        />
    );
};

export default PlaceSelect;
