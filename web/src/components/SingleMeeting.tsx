import { Component } from "preact";
import ICalendarLink from "react-icalendar-link";
import {
    BsChevronDown,
    BsChevronUp,
    BsFillExclamationTriangleFill,
    BsFillPeopleFill,
    BsPencilSquare,
    BsQrCode,
    BsShareFill
} from "react-icons/bs";
import { IoMdStats } from "react-icons/io";
import { IoLocation, IoLogoEuro, IoTime } from "react-icons/io5";
import { LuMailQuestion } from "react-icons/lu";
import { MdWheelchairPickup } from "react-icons/md";
import { TbRating18Plus } from "react-icons/tb";
import { Modal } from "rsuite";
import { match } from "ts-pattern";
import { CommonMeetingTag } from "../apiTypes/CommonMeetingTag";
import { Meeting } from "../apiTypes/Meeting";
import { QueerMeetingTag } from "../apiTypes/QueerMeetingTag";
import { G } from "../types";
import EditMeeting from "./EditMeeting";
import Md from "./Md";
import MeetingList from "./MeetingList";
import QrCode from "./QrCode";

interface SingleMeetingProps {
    readonly meeting: Meeting;
    readonly g: G;
    readonly reloadMeetingList: InstanceType<typeof MeetingList>["reloadMeetingList"];
    readonly expanded: boolean;
    readonly index: number;
    readonly switchExpand: InstanceType<typeof MeetingList>["switchExpand"];
}
interface SingleMeetingState {
    readonly editing: boolean;
    readonly showQRCode: boolean;
    readonly locationModalOpen: boolean;
    readonly timeModalOpen: boolean;
}
export default class SingleMeeting extends Component<SingleMeetingProps, SingleMeetingState> {
    constructor(props: SingleMeetingProps) {
        super(props);
        this.state = {
            editing: false,
            showQRCode: false,
            locationModalOpen: false,
            timeModalOpen: false
        };
    }

    changeEditing = (editing: boolean) => {
        this.setState({ editing });
    };

    render = () => {
        const m = this.props.meeting;

        const time = new Intl.DateTimeFormat(["ban", "de-de"], {
            weekday: "short",
            year: "2-digit",
            month: "2-digit",
            day: "2-digit",
            hour: "numeric",
            minute: "numeric"
        }).format(Number(m.time));

        const isPast = Number(m.time) < Date.now();

        // cut the cords after six decimal places
        const lon = Number(m.location.lon).toFixed(6);
        const lat = Number(m.location.lat).toFixed(6);

        return (
            <div
                className={`SingleMeeting Pad${
                    this.props.g.meetingId === m._id ? "ShortHighlight" : ""
                }`}
            >
                <Modal
                    open={this.state.locationModalOpen}
                    onClose={() => {
                        this.setState({ locationModalOpen: false });
                    }}
                >
                    <Modal.Header>
                        <Modal.Title>Ort</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <h1>{m.location.name}</h1>
                        <h2>
                            <a href={`geo:${lat},${lon}`}>
                                {lat}, {lon}
                            </a>
                        </h2>
                        <h2>
                            <a
                                rel="no-referrer"
                                target="_blank"
                                href={`
                            https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}
                                `}
                            >
                                OpenStreetMap
                            </a>
                        </h2>
                        <h2>
                            <a
                                rel="no-referrer"
                                target="_blank"
                                href={`https://www.google.com/maps/place/${lat},${lon}`}
                            >
                                Google Maps
                            </a>
                        </h2>
                        <h2>
                            <a
                                rel="no-referrer"
                                target="_blank"
                                href={`https://www.bing.com/maps?q=${lat},${lon}`}
                            >
                                Bing Maps
                            </a>
                        </h2>
                    </Modal.Body>
                </Modal>

                <div className="Title">{m.title}</div>
                <div className="Tags">
                    {m.tags.freeform.map(renderFreeformTag)}
                    {m.tags.common.map(renderCommonTag)}
                    {m.tags.queer.map(renderQueerTag)}
                </div>
                <div className="Infos">
                    <div className="Left">
                        <div
                            className="Location"
                            title="Ort"
                            onClick={() => {
                                this.setState({ locationModalOpen: true });
                            }}
                        >
                            <IoLocation />
                            <span className="InfoText">{m.location.name}</span>
                        </div>
                        <div className="Authority" title="Organisator">
                            <BsFillPeopleFill />
                            <span className="InfoText">{m.authority}</span>
                        </div>
                        <div className="TriggerWarning" title="Triggerwarnung">
                            <BsFillExclamationTriangleFill />
                            <span className="InfoText">{m.trigger_warning ?? "Keine"}</span>
                        </div>
                        <div className="Accessibility">
                            <MdWheelchairPickup />
                            <span title="Barrierefreiheit" className="InfoText">
                                {m.accessibility ?? "Unbekannt"}
                            </span>
                        </div>
                    </div>
                    <div className="Right">
                        <div
                            style={{ color: isPast ? "#fb0000" : "var(--text-color)" }}
                            className="Time"
                            title="Zeit"
                            onClick={() => {
                                this.setState({ timeModalOpen: true });
                            }}
                        >
                            <Modal
                                open={this.state.timeModalOpen}
                                onClose={() => {
                                    this.setState({ timeModalOpen: false });
                                }}
                            >
                                <Modal.Header>
                                    <Modal.Title>Datum & Uhrzeit</Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    <ICalendarLink
                                        event={{
                                            title: m.title,
                                            description: m.description,
                                            location:
                                                m.location.name +
                                                ", " +
                                                m.location.lat +
                                                ", " +
                                                m.location.lon,
                                            startTime: new Date(Number(m.time)).toISOString(),
                                            endTime: new Date(
                                                Number(m.time) + 3600000
                                            ).toISOString()
                                        }}
                                        filename={m.title + ".ics"}
                                    >
                                        ICS herunterladen (Zum Kalender hinzufügen)
                                    </ICalendarLink>
                                    <br />
                                    <div>
                                        Oder unseren Kalender abonnieren (iCal Feed):
                                        <br />
                                        <span style={{ userSelect: "all" }}>
                                            https://api.queer-augsburg.de/api/ical_feed/
                                        </span>
                                        <br />
                                        <span>oder</span>
                                        <br />
                                        <span>
                                            <a href="webcal://api.queer-augsburg.de/api/ical_feed/">
                                                webcal
                                            </a>
                                        </span>
                                    </div>
                                </Modal.Body>
                            </Modal>

                            <IoTime />
                            <span className="InfoText">{time}</span>
                        </div>
                        <div className="Price" title="Ungefährer Preis">
                            <IoLogoEuro />
                            <span className="InfoText">{priceToString(m.price)}</span>
                        </div>
                        <div className="Age Restriction" title="Altersbeschränkungen">
                            <TbRating18Plus />
                            <span className="InfoText">
                                {ageRestrictionToString(m.age_restriction)}
                            </span>
                        </div>
                        <div className={"Attendance"}>
                            <IoMdStats />
                            <span title="Anwesende" className="InfoText">
                                {isPast
                                    ? m.attendance
                                        ? m.attendance
                                        : "Unbekannt"
                                    : "Ausstehend"}
                            </span>
                        </div>
                    </div>
                </div>

                <div
                    className="Description"
                    style={{
                        position: "relative",
                        height: this.props.expanded ? "400px" : "50px",
                        overflowY: this.props.expanded ? "auto" : "hidden"
                    }}
                >
                    <Md plainText={m.description} />
                </div>
                <a
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                        this.props.switchExpand(this.props.index);
                    }}
                >
                    {this.props.expanded ? (
                        <span>
                            <span>Weniger anzeigen</span>

                            <BsChevronUp
                                style={{ marginLeft: "5px", transform: "translate(0px, 2.5px)" }}
                            />
                        </span>
                    ) : (
                        <span>
                            <span>Mehr anzeigen</span>
                            <BsChevronDown
                                style={{ marginLeft: "5px", transform: "translate(0px, 2.5px)" }}
                            />
                        </span>
                    )}
                </a>

                <div className="Actions">
                    <button title="Hilfe zu diesem Treffen">
                        <a
                            href={`mailto:mail@queer-augsburg.de
                            ?subject=Hilfe zum Treffen: ${m.title}
                        `}
                        >
                            <LuMailQuestion style={{ transform: "scale(1.2)" }} />
                        </a>
                    </button>
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    url: this.props.g.uiConfig?.qaWebAddress + `/?m=${m._id}`
                                });
                            }
                            window.history.pushState({}, "", `/?m=${m._id}`);
                        }}
                        title="Teilen"
                    >
                        <BsShareFill />
                    </button>

                    {this.props.g.account?.capabilities?.includes(`UpdateMeetings`) && (
                        <>
                            <span className={"Admin"}>
                                <button
                                    onClick={() => {
                                        this.setState({ editing: true });
                                    }}
                                    className={"Edit"}
                                    title="Bearbeiten"
                                >
                                    <BsPencilSquare />
                                </button>
                                <button
                                    onClick={() => {
                                        this.setState({ showQRCode: true });
                                    }}
                                    title={"Anmeldungs QR-Code anzeigen"}
                                >
                                    <BsQrCode />
                                </button>
                            </span>
                            <Modal
                                open={this.state.showQRCode}
                                onClose={() => {
                                    this.setState({ showQRCode: false });
                                }}
                            >
                                <Modal.Body>
                                    <h2>Link zur Vereinsanmeldung</h2>
                                    <div>
                                        <span style={{ userSelect: "all" }}>
                                            {this.props.g.uiConfig?.qaWebAddress +
                                                `/ich?ref=${m._id}`}
                                        </span>

                                        <br />
                                        <br />
                                        <QrCode
                                            url={
                                                this.props.g.uiConfig?.qaWebAddress +
                                                `/ich?ref=${m._id}`
                                            }
                                        ></QrCode>
                                    </div>
                                </Modal.Body>
                            </Modal>
                        </>
                    )}
                </div>
                <EditMeeting
                    reloadMeetingList={this.props.reloadMeetingList}
                    changEditing={this.changeEditing}
                    editing={this.state.editing}
                    g={this.props.g}
                    meeting={this.props.meeting}
                ></EditMeeting>
            </div>
        );
    };
}

const renderFreeformTag = (tag: string) => {
    return <span className="Tag">{tag}</span>;
};

const renderCommonTag = (tag: CommonMeetingTag) => {
    const tag2 = match(tag)
        .with("Kultur", () => "Kultur 📖")
        .with("Party", () => "Party 🪩")
        .with("Orga", () => "Orga 💡")
        .with("Sport", () => "Sport 🏃")
        .with("Education", () => "Education 🏫")
        .with("Meet", () => "Meet 🟢")
        .with("Students", () => "Students 🧑‍🎓")
        .with("Marketing", () => "Marketing 📸")
        .with("Cinema", () => "Cinema 🍿")
        .with("Talks", () => "Talks 🗣️")
        .with("Open", () => "Open 👐")
        .with("Explores", () => "Explores 🏞️")
        .with("Connect", () => "Connect 🔗")
        .with("Ostqueer", () => "Ostqueer ➡️")
        .with("Queermas", () => "Queermas 🎄")
        .exhaustive();

    return <span className="Tag">{tag2}</span>;
};

const renderQueerTag = (tag: QueerMeetingTag) => {
    let t = tag as string;
    if (tag === "Everyone") t = "Alle";
    return <span className={`Tag ${tag}`}>{t}</span>;
};

const priceToString = (price: number[]) => {
    if (price.length === 1 && price[0] !== 0) {
        return `${price[0]}€`;
    } else if (price.length === 2) {
        return `${price[0]}-${price[1]}€`;
    } else {
        return "Kostenlos";
    }
};

const ageRestrictionToString = (ageRestriction: number[]) => {
    if (ageRestriction.length === 1 && ageRestriction[0] !== 0) {
        return `${ageRestriction[0]}+`;
    } else if (ageRestriction.length === 2) {
        return `${ageRestriction[0]}-${ageRestriction[1]}`;
    } else {
        return "Keine";
    }
};
