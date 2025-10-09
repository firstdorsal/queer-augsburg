import { Component } from "preact";
import { Button, Modal } from "rsuite";

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
}

export default class LocationPicker extends Component<LocationPickerProps, LocationPickerState> {
    private mapContainer: HTMLDivElement | null = null;
    private L: any = null;

    constructor(props: LocationPickerProps) {
        super(props);
        this.state = {
            mapInstance: null,
            marker: null,
            leafletLoaded: false,
            cssLoaded: false
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

    render() {
        const { show, onClose } = this.props;
        const { leafletLoaded, cssLoaded } = this.state;
        const isLoading = !leafletLoaded || !cssLoaded;

        return (
            <Modal open={show} size="lg" onClose={onClose}>
                <Modal.Header>
                    <Modal.Title>Ort auswählen</Modal.Title>
                </Modal.Header>
                <Modal.Body>
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
                        auszuwählen.
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
