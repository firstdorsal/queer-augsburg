import { Component } from "preact";
import MeetingList from "../components/MeetingList";
import { G } from "../types";

interface TreffenProps {
    readonly g: G;
}
interface TreffenState {}
export default class Treffen extends Component<TreffenProps, TreffenState> {
    render = () => {
        if (this.props.g.qaClient === null) {
            return <div></div>;
        }
        return (
            <div className="Treffen">
                <MeetingList g={this.props.g} type={"All"} qaClient={this.props.g.qaClient} />
            </div>
        );
    };
}
