import { Component } from "preact";
import MeetingList from "../components/MeetingList";
import { G } from "../types";
import { Loader, SelectPicker } from "rsuite";

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
                {this.props.g.admin && (
                    <SelectPicker
                        data={[
                            { label: "Aktive Treffen", value: "Active" },
                            { label: "Geplante Treffen", value: "Planned" }
                        ]}
                        searchable={false}
                        cleanable={false}
                        value={this.state.type}
                        onChange={value => this.setState({ type: value as any })}
                        placement="topEnd"
                        style={{
                            position: "fixed",
                            right: "20px",
                            bottom: "70px",
                            zIndex: 1000
                        }}
                    />
                )}

                <MeetingList
                    g={this.props.g}
                    type={this.state.type}
                    qaClient={this.props.g.qaClient}
                />
            </div>
        );
    };
}
