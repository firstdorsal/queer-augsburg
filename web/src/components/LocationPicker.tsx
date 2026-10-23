import { Component, ComponentChildren } from "preact";
import { FaSearch } from "react-icons/fa";
import { Button, Input, InputGroup, Message, Modal } from "rsuite";
import {
    NOMINATIM_MIN_INTERVAL_MS,
    OSM_REFERRER_POLICY,
    OSM_TILE_OPTIONS,
    OSM_TILE_URL,
    nominatimSearchUrl
} from "../osm";

interface LocationPickerProps {
    lat?: number;
    lon?: number;
    onLocationSelect: (lat: number, lon: number) => void;
    onClose: () => void;
    /** Pre-fills the search field, e.g. with a place name that is not known yet. */
    initialSearchQuery?: string;
    /** Defaults to "Ort auswählen". */
    title?: string;
    /** Rendered above the search field. */
    children?: ComponentChildren;
    /** Replaces the default OK button. */
    footer?: ComponentChildren;
}

interface LocationPickerState {
    mapInstance: any | null;
    marker: any | null;
    leafletLoaded: boolean;
    cssLoaded: boolean;
    searchQuery: string;
    searchResults: Array<{
        label: string;
        value: string;
        data: {
            display_name: string;
            lat: string;
            lon: string;
            place_id: string;
        };
    }>;
    isSearching: boolean;
    /** The map tiles could not be loaded (e.g. blocked by OpenStreetMap). */
    tilesFailed: boolean;
    /** Why the last search showed no results, if it did not. */
    searchProblem: string | null;
}

export default class LocationPicker extends Component<LocationPickerProps, LocationPickerState> {
    private mapContainer: HTMLDivElement | null = null;
    private L: any = null;
    private currentSearchController: AbortController | null = null;
    private lastSearchAt = 0;

    constructor(props: LocationPickerProps) {
        super(props);
        this.state = {
            mapInstance: null,
            marker: null,
            leafletLoaded: false,
            cssLoaded: false,
            searchQuery: props.initialSearchQuery ?? "",
            searchResults: [],
            isSearching: false,
            tilesFailed: false,
            searchProblem: null
        };
    }

    // Mounted only while the dialog is open (see CreatePlaceDialog).
    componentDidMount() {
        this.loadLeaflet();
    }

    componentDidUpdate(prevProps: LocationPickerProps) {
        if (
            this.state.mapInstance &&
            (this.props.lat !== prevProps.lat || this.props.lon !== prevProps.lon)
        ) {
            this.updateMarkerPosition();
        }
    }

    componentWillUnmount() {
        this.destroyMap();
        if (this.currentSearchController) {
            this.currentSearchController.abort();
        }
    }

    loadLeafletCSS = async () => {
        if (this.state.cssLoaded) return;

        return new Promise<void>((resolve) => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = "/leaflet/leaflet.css";
            link.onload = () => {
                this.setState({ cssLoaded: true });
                resolve();
            };
            document.head.appendChild(link);
        });
    };

    loadLeaflet = async () => {
        if (this.state.leafletLoaded && this.state.cssLoaded) {
            this.initializeMap();
            return;
        }

        try {
            await this.loadLeafletCSS();

            const L = await import("leaflet");
            this.L = L.default;

            delete (this.L.Icon.Default.prototype as any)._getIconUrl;
            this.L.Icon.Default.mergeOptions({
                iconRetinaUrl: "/leaflet/images/marker-icon-2x.png",
                iconUrl: "/leaflet/images/marker-icon.png",
                shadowUrl: "/leaflet/images/marker-shadow.png"
            });

            this.setState({ leafletLoaded: true });
            setTimeout(() => this.initializeMap(), 100);
        } catch (error) {
            console.error("Failed to load Leaflet:", error);
        }
    };

    initializeMap = () => {
        if (!this.mapContainer || this.state.mapInstance || !this.L) return;

        const { lat, lon } = this.props;
        const validLat = lat || 48.3601;
        const validLon = lon || 10.8934;

        const map = this.L.map(this.mapContainer).setView([validLat, validLon], 13);

        const tiles = this.L.tileLayer(OSM_TILE_URL, OSM_TILE_OPTIONS).addTo(map);
        tiles.on("tileerror", () => {
            if (this.state.tilesFailed) return;
            console.error("OpenStreetMap tiles failed to load");
            this.setState({ tilesFailed: true });
        });

        const marker = this.L.marker([validLat, validLon], { draggable: true }).addTo(map);

        marker.on("dragend", () => {
            const position = marker.getLatLng();
            this.props.onLocationSelect(position.lat, position.lng);
        });

        map.on("click", (e: any) => {
            const { lat, lng } = e.latlng;
            marker.setLatLng([lat, lng]);
            this.props.onLocationSelect(lat, lng);
        });

        this.setState({ mapInstance: map, marker });

        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    };

    updateMarkerPosition = () => {
        const { lat, lon } = this.props;
        const { mapInstance, marker } = this.state;

        if (mapInstance && marker && lat && lon && this.L) {
            const newLatLng = this.L.latLng(lat, lon);
            marker.setLatLng(newLatLng);
            mapInstance.setView(newLatLng);
        }
    };

    destroyMap = () => {
        if (this.state.mapInstance) {
            this.state.mapInstance.remove();
            this.setState({ mapInstance: null, marker: null });
        }
    };

    handleSearchChange = (value: string) => {
        this.setState({ searchQuery: value, searchProblem: null });
    };

    handleSearchSubmit = () => {
        const { searchQuery, isSearching } = this.state;
        // Only explicit searches, and not faster than Nominatim allows (see osm.ts).
        const tooSoon = Date.now() - this.lastSearchAt < NOMINATIM_MIN_INTERVAL_MS;
        if (searchQuery.length > 2 && !isSearching && !tooSoon) {
            this.lastSearchAt = Date.now();
            this.performSearch(searchQuery);
        }
    };

    handleKeyPress = (event: KeyboardEvent) => {
        if (event.key === "Enter") {
            this.handleSearchSubmit();
        }
    };

    performSearch = async (query: string) => {
        // Abort previous search if it exists
        if (this.currentSearchController) {
            this.currentSearchController.abort();
        }

        // Create new controller for this search
        this.currentSearchController = new AbortController();
        const controller = this.currentSearchController;

        this.setState({ isSearching: true, searchProblem: null });

        try {
            const response = await fetch(nominatimSearchUrl(query), {
                signal: controller.signal,
                referrerPolicy: OSM_REFERRER_POLICY
            });

            // Check if this request was aborted
            if (controller.signal.aborted) {
                return;
            }

            // A block (403) or rate limit (429) must not look like "no results".
            if (!response.ok) throw new Error(`Nominatim answered HTTP ${response.status}`);
            const results = await response.json();

            // Check again if this request was aborted after getting results
            if (controller.signal.aborted) {
                return;
            }

            const formattedResults = results.map((result: any) => ({
                label: result.display_name,
                value: result.display_name,
                data: result
            }));

            // Only update state if this is still the current search
            if (this.currentSearchController === controller) {
                this.setState({
                    searchResults: formattedResults,
                    isSearching: false,
                    searchProblem:
                        formattedResults.length === 0 ? "Keine Treffer für diese Suche." : null
                });
            }
        } catch (error) {
            // Don't handle aborted requests as errors
            if (error instanceof DOMException && error.name === "AbortError") {
                return;
            }

            console.error("Search failed:", error);

            // Only update state if this is still the current search
            if (this.currentSearchController === controller) {
                this.setState({
                    searchResults: [],
                    isSearching: false,
                    searchProblem:
                        "Die Adresssuche ist gerade nicht erreichbar. Setze den Ort direkt auf der Karte."
                });
            }
        }
    };

    selectSearchResult = (result: any) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);

        this.props.onLocationSelect(lat, lon);

        if (this.state.mapInstance && this.state.marker && this.L) {
            const newLatLng = this.L.latLng(lat, lon);
            this.state.marker.setLatLng(newLatLng);
            this.state.mapInstance.setView(newLatLng, 15);
        }

        this.setState({
            searchQuery: result.display_name,
            searchResults: []
        });
    };

    render() {
        const { onClose, title, children, footer } = this.props;
        const {
            leafletLoaded,
            cssLoaded,
            searchQuery,
            searchResults,
            isSearching,
            tilesFailed,
            searchProblem
        } = this.state;
        const isLoading = !leafletLoaded || !cssLoaded;

        return (
            <Modal open size="lg" onClose={onClose}>
                <Modal.Header>
                    <Modal.Title>{title ?? "Ort auswählen"}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {children}
                    <div style={{ marginBottom: "15px", position: "relative" }}>
                        <InputGroup style={{ width: "100%" }}>
                            <Input
                                placeholder="Suche nach Ort oder Adresse..."
                                value={searchQuery}
                                onChange={this.handleSearchChange}
                                onKeyPress={this.handleKeyPress}
                            />
                            <InputGroup.Button onClick={this.handleSearchSubmit}>
                                <FaSearch />
                            </InputGroup.Button>
                        </InputGroup>
                        {searchResults.length > 0 && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    backgroundColor: "var(--rs-bg-card)",
                                    border: "1px solid var(--rs-border-primary)",
                                    borderRadius: "6px",
                                    maxHeight: "200px",
                                    overflowY: "auto",
                                    zIndex: 1000,
                                    boxShadow: "var(--rs-shadow-lg)"
                                }}
                            >
                                {searchResults.map((result) => (
                                    <div
                                        key={result.data.place_id}
                                        onClick={() => this.selectSearchResult(result.data)}
                                        style={{
                                            padding: "10px 15px",
                                            cursor: "pointer",
                                            borderBottom: "1px solid var(--rs-border-primary)",
                                            fontSize: "14px",
                                            color: "var(--rs-text-primary)"
                                        }}
                                        onMouseEnter={(e) => {
                                            (e.target as HTMLElement).style.backgroundColor =
                                                "var(--rs-state-hover)";
                                        }}
                                        onMouseLeave={(e) => {
                                            (e.target as HTMLElement).style.backgroundColor =
                                                "transparent";
                                        }}
                                    >
                                        {result.label}
                                    </div>
                                ))}
                            </div>
                        )}
                        {isSearching && (
                            <div
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    right: 0,
                                    backgroundColor: "var(--rs-bg-card)",
                                    border: "1px solid var(--rs-border-primary)",
                                    borderRadius: "6px",
                                    padding: "10px 15px",
                                    zIndex: 1000,
                                    boxShadow: "var(--rs-shadow-lg)",
                                    color: "var(--rs-text-secondary)"
                                }}
                            >
                                Suche läuft...
                            </div>
                        )}
                    </div>
                    {searchProblem !== null && (
                        <Message showIcon type="info" className="mb-3">
                            {searchProblem}
                        </Message>
                    )}
                    {tilesFailed && (
                        <Message showIcon type="warning" className="mb-3">
                            Die Karte konnte nicht vollständig geladen werden. Du kannst den Ort
                            trotzdem über die Suche oder per Klick auf die Karte setzen.
                        </Message>
                    )}
                    {isLoading && (
                        <div
                            style={{
                                height: "400px",
                                width: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: "#f5f5f5"
                            }}
                        >
                            <p>Karte wird geladen...</p>
                        </div>
                    )}
                    <div
                        ref={(el) => (this.mapContainer = el)}
                        style={{
                            height: "400px",
                            width: "100%",
                            display: isLoading ? "none" : "block"
                        }}
                    />
                </Modal.Body>
                <Modal.Footer>
                    {footer ?? (
                        <Button onClick={onClose} appearance="primary">
                            OK
                        </Button>
                    )}
                </Modal.Footer>
            </Modal>
        );
    }
}
