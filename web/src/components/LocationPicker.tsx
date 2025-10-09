import { Component } from "preact";
import { AutoComplete, Button, Modal } from "rsuite";

interface LocationPickerProps {
    lat?: number;
    lon?: number;
    onLocationSelect: (lat: number, lon: number) => void;
    show: boolean;
    onClose: () => void;
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
}

export default class LocationPicker extends Component<LocationPickerProps, LocationPickerState> {
    private mapContainer: HTMLDivElement | null = null;
    private L: any = null;
    private currentSearchController: AbortController | null = null;

    constructor(props: LocationPickerProps) {
        super(props);
        this.state = {
            mapInstance: null,
            marker: null,
            leafletLoaded: false,
            cssLoaded: false,
            searchQuery: "",
            searchResults: [],
            isSearching: false
        };
    }

    componentDidMount() {
        if (this.props.show) {
            this.loadLeaflet();
        }
    }

    componentDidUpdate(prevProps: LocationPickerProps) {
        if (this.props.show && !prevProps.show) {
            this.loadLeaflet();
        } else if (!this.props.show && prevProps.show) {
            this.destroyMap();
        }

        if (
            this.props.show &&
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

        this.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution:
                '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

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
        this.setState({ searchQuery: value });
        if (value.length > 2) {
            this.performSearch(value);
        } else {
            this.setState({ searchResults: [] });
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

        this.setState({ isSearching: true });

        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
                    query
                )}&format=json&limit=5&addressdetails=1&countrycodes=de`,
                { signal: controller.signal }
            );

            // Check if this request was aborted
            if (controller.signal.aborted) {
                return;
            }

            const results = await response.json();

            // Check again if this request was aborted after getting results
            if (controller.signal.aborted) {
                return;
            }

            const formattedResults = results.map((result: any) => ({
                label: result.display_name,
                value: result.place_id,
                data: result
            }));

            // Only update state if this is still the current search
            if (this.currentSearchController === controller) {
                this.setState({
                    searchResults: formattedResults,
                    isSearching: false
                });
            }
        } catch (error) {
            // Don't handle aborted requests as errors
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            }

            console.error("Search failed:", error);

            // Only update state if this is still the current search
            if (this.currentSearchController === controller) {
                this.setState({
                    searchResults: [],
                    isSearching: false
                });
            }
        }
    };

    selectSearchResult = (_value: string, item: any) => {
        const result = item.data;
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
        const { show, onClose } = this.props;
        const { leafletLoaded, cssLoaded, searchQuery, searchResults, isSearching } = this.state;
        const isLoading = !leafletLoaded || !cssLoaded;

        return (
            <Modal open={show} size="lg" onClose={onClose}>
                <Modal.Header>
                    <Modal.Title>Ort auswählen</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ marginBottom: "15px" }}>
                        <AutoComplete
                            placeholder="Suche nach Ort oder Adresse..."
                            value={searchQuery}
                            data={searchResults}
                            onChange={this.handleSearchChange}
                            onSelect={this.selectSearchResult}
                            style={{ width: "100%" }}
                        />
                    </div>
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
                    <p style={{ marginTop: "10px", fontSize: "14px", color: "#666" }}>
                        Klicken Sie auf die Karte oder ziehen Sie den Marker, um einen Ort
                        auszuwählen. Oder suchen Sie nach einem Ort im obigen Suchfeld.
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={onClose} appearance="primary">
                        OK
                    </Button>
                </Modal.Footer>
            </Modal>
        );
    }
}
