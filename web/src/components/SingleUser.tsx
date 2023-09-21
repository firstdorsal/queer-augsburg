import { Component } from "preact";
import { User } from "../apiTypes/User";
import { G } from "../types";
import { Button } from "rsuite";

interface SingleUserProps {
    readonly user: User;
    readonly g: G;
}
interface SingleUserState {}
export default class SingleUser extends Component<SingleUserProps, SingleUserState> {
    acceptApplication = async () => {
        if (this.props.g.qaClient === null) {
            return;
        }
        await this.props.g.qaClient.accept_member_application(this.props.user._id);
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
                            {m.approved ? (
                                <span style={{ borderBottom: "2px solid green" }}>
                                    Antrag akzeptiert
                                </span>
                            ) : (
                                <Button onClick={this.acceptApplication} appearance="primary">
                                    Antrag akzeptieren
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        );
    };
}
