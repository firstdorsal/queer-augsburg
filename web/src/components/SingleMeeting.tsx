import { Component } from "preact";
import { IoLocation, IoLogoEuro, IoTime } from "react-icons/io5";
import { TbRating18Plus } from "react-icons/tb";
import {
    BsBellFill,
    BsBookmark,
    BsFillExclamationTriangleFill,
    BsFillPeopleFill,
    BsPencilSquare,
    BsQrCode,
    BsShareFill
} from "react-icons/bs";
import { Meeting } from "../apiTypes/Meeting";
import { CommonMeetingTag } from "../apiTypes/CommonMeetingTag";
import { QueerMeetingTag } from "../apiTypes/QueerMeetingTag";
import { LuMailQuestion } from "react-icons/lu";
import { G } from "../types";
import EditMeeting from "./EditMeeting";
import MeetingList from "./MeetingList";
import { Button, Modal } from "rsuite";
import QrCode from "./QrCode";

interface SingleMeetingProps {
    readonly meeting: Meeting;
    readonly g: G;
    readonly reloadMeetingList: InstanceType<typeof MeetingList>["reloadMeetingList"];
}
interface SingleMeetingState {
    readonly editing: boolean;
    readonly showQRCode: boolean;
}
export default class SingleMeeting extends Component<SingleMeetingProps, SingleMeetingState> {
    constructor(props: SingleMeetingProps) {
        super(props);
        this.state = {
            editing: false,
            showQRCode: false
        };
    }

    changeEditing = (editing: boolean) => {
        this.setState({ editing });
    };

    render = () => {
        const m = this.props.meeting;

        const time = new Intl.DateTimeFormat(["ban", "de-de"], {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "numeric",
            minute: "numeric"
        }).format(Number(m.time));

        const isPast = Number(m.time) < Date.now();

        return (
            <div
                className={`SingleMeeting Pad${
                    this.props.g.meetingId === m._id ? " ShortHighlight" : ""
                }`}
            >
                <div className="Title">{m.title}</div>
                <div className="Tags">
                    {m.tags.freeform.map(renderFreeformTag)}
                    {m.tags.common.map(renderCommonTag)}
                    {m.tags.queer.map(renderQueerTag)}
                </div>
                <div className="Infos">
                    <div className="Left">
                        <div className="Location" title="Ort">
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
                    </div>
                    <div className="Right">
                        <div
                            style={{ color: isPast ? "#fb0000" : "var(--text-color)" }}
                            className="Time"
                            title="Zeit"
                        >
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
                    </div>
                </div>

                <div className="Description" style={{ position: "relative" }}>
                    {m.description}
                </div>

                <div className="Actions">
                    <button title="Lesezeichen">
                        <BsBookmark />
                    </button>
                    <button title="Hilfe zu diesem Treffen">
                        <a href="mailto:mail@queer-augsburg.de">
                            <LuMailQuestion style={{ transform: "scale(1.2)" }} />
                        </a>
                    </button>
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({
                                    url: this.props.g.uiConfig?.qaWebAddress + `/?m=${m._id}`
                                });
                            } else {
                                // change the url
                                window.history.pushState({}, "", `/?m=${m._id}`);
                            }
                        }}
                        title="Teilen"
                    >
                        <BsShareFill />
                    </button>
                    <button title="Notifications">
                        <BsBellFill />
                    </button>
                    {this.props.g.admin && (
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
    return <span className="Tag">{tag}</span>;
};

const renderQueerTag = (tag: QueerMeetingTag) => {
    return <span className={`Tag ${tag}`}>{tag}</span>;
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
