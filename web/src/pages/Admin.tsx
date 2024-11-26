import { Component } from "preact";
import AdminCreateMember from "../components/AdminCreateMember";
import UserList from "../components/UserList";
import UserStats from "../components/UserStats";
import { G } from "../types";

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
                {this.props.g.account?.capabilities?.includes("CreateMember") && (
                    <AdminCreateMember g={this.props.g} />
                )}
                {this.props.g.account?.capabilities?.includes("GetUsers") && (
                    <>
                        <div className={"Pad"} style={{ height: "100px" }}>
                            <h1>Mitglieder</h1>
                            <UserStats g={this.props.g} />
                        </div>
                        <UserList
                            style={{ height: "calc(100% - 100px)" }}
                            g={this.props.g}
                            qaClient={this.props.g.qaClient}
                        />
                    </>
                )}
            </div>
        );
    };
}
