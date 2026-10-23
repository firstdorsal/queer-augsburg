import { Component } from "preact";
import MeetingList from "../components/MeetingList";
import { G } from "../types";
import { Loader } from "rsuite";

interface TreffenProps {
    readonly g: G;
}
interface TreffenState {
    readonly type: "Planned" | "Active";
}
export default class Treffen extends Component<TreffenProps, TreffenState> {
    constructor(props: TreffenProps) {
        super(props);
        this.state = {
            type: "Active"
        };
    }

    render = () => {
        if (this.props.g.qaClient === null) {
            return (
                <div className="Treffen">
                    <Loader size="md" style={{ width: "100%", textAlign: "center" }} />
                </div>
            );
        }
        return (
            <div className="Treffen">
                <MeetingList
                    g={this.props.g}
                    // Only editors can switch to the planned meetings; after logging out the
                    // list goes back to the active ones.
                    type={
                        this.props.g.account?.capabilities?.includes(`UpdateMeetings`)
                            ? this.state.type
                            : "Active"
                    }
                    qaClient={this.props.g.qaClient}
                    onTypeChange={type => this.setState({ type })}
                />
            </div>
        );
    };
}
