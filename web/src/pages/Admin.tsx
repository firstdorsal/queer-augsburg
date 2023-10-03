import { Component } from "preact";
import { G } from "../types";
import UserList from "../components/UserList";
import UserStats from "../components/UserStats";

interface AdminProps {
    readonly g: G;
}
interface AdminState {}
export default class Admin extends Component<AdminProps, AdminState> {
    render = () => {
        if (this.props.g.qaClient === null) {
            return <div></div>;
        }
        return (
            <div className="Admin">
                <div className={"Pad"} style={{ height: "100px" }}>
                    <h1>Mitglieder</h1>
                    <UserStats g={this.props.g} />
                </div>
                <UserList
                    style={{ height: "calc(100% - 100px)" }}
                    g={this.props.g}
                    qaClient={this.props.g.qaClient}
                />
            </div>
        );
    };
}
