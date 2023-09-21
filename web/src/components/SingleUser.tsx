import { Component } from "preact";
import { User } from "../apiTypes/User";
import { G } from "../types";
import { Button } from "rsuite";

interface SingleUserProps {
    readonly user: User;
    readonly g: G;
}
interface SingleUserState {
    readonly awaitingResponse: boolean;
    readonly accepted_approval: boolean;
    readonly rejected_approval: boolean;
    readonly rejected_approval_reason: string;
}
export default class SingleUser extends Component<SingleUserProps, SingleUserState> {
    constructor(props: SingleUserProps) {
        super(props);
        this.state = {
            awaitingResponse: false,
            accepted_approval: false,
            rejected_approval: false,
            rejected_approval_reason: ""
        };
    }

    acceptApplication = async () => {
        if (this.props.g.qaClient === null) {
            return;
        }
        this.setState({ awaitingResponse: true });
        const res = await this.props.g.qaClient.accept_member_application(this.props.user._id);
        this.setState({ awaitingResponse: false, accepted_approval: res });
    };

    render = () => {
        const u = this.props.user;
        const m = u.member;
        return (
            <div className="SingleUser">
                <div>ID: {u._id}</div>
                {m !== null && (
                    <div>
                        {m.natural_person ? (
                            <>
                                <div>Vorname: {m.name?.first_name}</div>
                                <div>Nachname: {m.name?.last_name}</div>
                                <div>Passname: {m.name?.passport}</div>
                            </>
                        ) : (
                            <div>Institution: {m.institution}</div>
                        )}
                        <div>Email: {m.email}</div>

                        <div className={"pronouns"}>Pronomen:{m.pronouns}</div>

                        <div>Referenz: {m.reference}</div>
                        <div>Phone: {m.phone}</div>
                        <div>User Notes: {m.user_notes}</div>
                        <div>
                            Adresse: {m.address.street} {m.address.number}
                            {m.address.addition ? " " + m.address.addition : ""}, {m.address.zip}{" "}
                            {m.address.city}, {m.address.country}
                        </div>
                        <div style={{ marginTop: "10px" }}>
                            {m.approved || this.state.accepted_approval ? (
                                <span style={{ borderBottom: "2px solid green" }}>
                                    Antrag akzeptiert
                                </span>
                            ) : (
                                <Button
                                    disabled={this.state.awaitingResponse}
                                    onClick={this.acceptApplication}
                                    appearance="primary"
                                >
                                    Antrag akzeptieren
                                </Button>
                            )}

                            {this.state.rejected_approval && (
                                <span style={{ borderBottom: "2px solid red" }}>
                                    {this.state.rejected_approval_reason}
                                </span>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };
}
