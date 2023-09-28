import { Component } from "preact";
import { G } from "../types";
import UserList from "../components/UserList";

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
                <UserList g={this.props.g} qaClient={this.props.g.qaClient} />
            </div>
        );
    };
}
