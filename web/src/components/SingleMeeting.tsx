import { Component } from "preact";
import { IoLocation, IoLogoEuro, IoTime } from "react-icons/io5";
import { FaChildReaching } from "react-icons/fa6";
import {
    BsBellFill,
    BsBookmark,
    BsFillExclamationTriangleFill,
    BsFillPeopleFill,
    BsPencilSquare,
    BsShareFill
} from "react-icons/bs";
import { Meeting } from "../apiTypes/Meeting";
import { CommonMeetingTag } from "../apiTypes/CommonMeetingTag";
import { QueerMeetingTag } from "../apiTypes/QueerMeetingTag";
import { CSSProperties } from "preact/compat";
import { LuMailQuestion } from "react-icons/lu";
import { G } from "../types";

interface SingleMeetingProps {
    readonly meeting: Meeting;
    readonly g: G;
}
interface SingleMeetingState {}
export default class SingleMeeting extends Component<SingleMeetingProps, SingleMeetingState> {
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
            <div className="SingleMeeting Pad">
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
                            <FaChildReaching />
                            <span className="InfoText">
                                {ageRestrictionToString(m.age_restriction)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="Description">{m.description}</div>
                <div className="Actions">
                    <button title="Lesezeichen">
                        <BsBookmark />
                    </button>
                    <button title="Hilfe zu diesem Treffen">
                        <a href="mailto:mail@queer-augsburg.de">
                            <LuMailQuestion style={{ transform: "scale(1.2)" }} />
                        </a>
                    </button>
                    <button title="Teilen">
                        <BsShareFill />
                    </button>
                    <button title="Notifications">
                        <BsBellFill />
                    </button>
                    {this.props.g.admin && (
                        <button className={"Edit"} title="Bearbeiten">
                            <BsPencilSquare />
                        </button>
                    )}
                </div>
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
        return "0€";
    }
};

// TODO
const ageRestrictionToString = (ageRestriction: number[]) => {
    if (ageRestriction.length === 1 && ageRestriction[0] !== 0) {
        return `${ageRestriction[0]}+`;
    } else if (ageRestriction.length === 2) {
        return `${ageRestriction[0]}-${ageRestriction[1]}`;
    } else {
        return "0+";
    }
};
