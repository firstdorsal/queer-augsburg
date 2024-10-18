import { Component } from "preact";
import { User } from "../apiTypes/User";
import { G, memberShipStatuses } from "../types";
import { Button, Input, Message, Modal, SelectPicker, Toggle, useToaster } from "rsuite";
import { MembershipStatus } from "../apiTypes/MembershipStatus";
import { withToasterHook } from "../utils";
import UserList from "./UserList";
import { Meeting } from "../apiTypes/Meeting";

interface SingleUserProps {
    readonly user: User;
    readonly g: G;
    readonly toaster: ReturnType<typeof useToaster>;
    readonly reloadUserList: InstanceType<typeof UserList>["reloadUserList"];
    readonly meetings: Meeting[];
}
interface SingleUserState {
    readonly awaitingResponse: boolean;
    readonly status: MembershipStatus;
    readonly sendUpdateEmail: boolean;
    readonly updateReason: string;
    readonly updateStatusModalOpen: boolean;
}
class SingleUser extends Component<SingleUserProps, SingleUserState> {
    constructor(props: SingleUserProps) {
        super(props);
        this.state = {
            awaitingResponse: false,
            status: props.user.member?.status ?? "Pending",
            sendUpdateEmail: true,
            updateReason: "",
            updateStatusModalOpen: false
        };
    }

    expandReference = (reference: string | null) => {
        const maybeMeeting = this.props.meetings.find(m => m._id === reference);
        if (maybeMeeting) {
            return (
                <a className="MeetingReference" href={`/?m=${maybeMeeting._id}`}>
                    {maybeMeeting.title}
                </a>
            );
        } else {
            return <span>{reference}</span>;
        }
    };

    update_member_application_status = async () => {
        if (this.props.g.qaClient === null) {
            return;
        }
        this.setState({ awaitingResponse: true });
        const res = await this.props.g.qaClient.update_member_status(
            this.props.user._id,
            this.state.status,
            this.state.sendUpdateEmail,
            this.state.updateReason
        );

        const text = await res.text();

        if (res.status === 200) {
            await this.props.reloadUserList();
            this.props.toaster.push(
                <Message showIcon type={"success"} closable>
                    Status erfolgreich geändert
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
            this.setState({
                updateStatusModalOpen: false
            });
        } else {
            this.props.toaster.push(
                <Message showIcon type={"error"} closable>
                    {text}
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
        }

        this.setState({ awaitingResponse: false });
    };

    render = () => {
        const u = this.props.user;
        const m = u.member;
        return (
            <div className="SingleUser Pad">
                <div>ID: {u._id}</div>
                {m !== null && (
                    <div>
                        {m.natural_person ? (
                            <>
                                <div>Vorname: {m.name?.first_name}</div>
                                <div>Nachname: {m.name?.last_name}</div>
                            </>
                        ) : (
                            <div>Institution: {m.institution}</div>
                        )}
                        <div>Email: {m.email}</div>
                        <div>Typ: {m.type}</div>
                        <div className={"pronouns"}>Pronomen: {m.pronouns}</div>

                        <div>Referenz: {this.expandReference(m.reference)}</div>
                        <div>Phone: {m.phone}</div>
                        <div style={{maxHeight:"1rem",overflow:"hidden"}} title={m.user_notes??""}>User Notes: {m.user_notes}</div>
                        <div>
                            Adresse: {m.address.street} {m.address.number}
                            {m.address.addition ? " " + m.address.addition : ""}, {m.address.zip}{" "}
                            {m.address.city}, {m.address.country}
                        </div>
                        <div>
                            Aktueller Status:{" "}
                            {(() => {
                                switch (m.status) {
                                    case "Pending":
                                        return (
                                            <span style={{ borderBottom: "1px solid yellow" }}>
                                                Ausstehend
                                            </span>
                                        );
                                    case "Approved":
                                        return (
                                            <span style={{ borderBottom: "1px solid lime" }}>
                                                Angenommen
                                            </span>
                                        );
                                    case "Expelled":
                                        return (
                                            <span style={{ borderBottom: "1px solid red" }}>
                                                Ausgeschlossen
                                            </span>
                                        );
                                    case "Left":
                                        return (
                                            <span style={{ borderBottom: "1px solid red" }}>
                                                Verlassen
                                            </span>
                                        );
                                    case "Rejected":
                                        return (
                                            <span style={{ borderBottom: "1px solid red" }}>
                                                Abgelehnt
                                            </span>
                                        );
                                    default:
                                        return (
                                            <span style={{ borderBottom: "1px solid yellow" }}>
                                                Ausstehend
                                            </span>
                                        );
                                }
                            })()}
                            <Button
                                onClick={() =>
                                    this.setState({
                                        updateStatusModalOpen: true
                                    })
                                }
                                style={{
                                    marginLeft: "1em"
                                }}
                                size="xs"
                                appearance="primary"
                            >
                                ändern
                            </Button>
                        </div>

                        <Modal
                            open={this.state.updateStatusModalOpen}
                            onClose={() =>
                                this.setState({
                                    updateStatusModalOpen: false
                                })
                            }
                        >
                            <b>Neuer Status</b>
                            <br />

                            <SelectPicker
                                data={memberShipStatuses.map(item => ({
                                    label: item,
                                    value: item
                                }))}
                                value={this.state.status}
                                onSelect={v =>
                                    this.setState({
                                        status: v
                                    })
                                }
                                cleanable={false}
                            ></SelectPicker>
                            <br />
                            <br />
                            <b>Mitglied über Status Update informieren (Mail schicken)</b>
                            <br />
                            <Toggle
                                value={this.state.sendUpdateEmail}
                                defaultChecked
                                onChange={v => this.setState({ sendUpdateEmail: v })}
                            />

                            <br />
                            <br />
                            <b>Grund für Änderung (Wird per mail geschickt)</b>
                            <br />
                            <Input
                                value={this.state.updateReason}
                                onChange={v => {
                                    this.setState({ updateReason: v });
                                }}
                            />
                            <br />
                            <br />
                            <Button
                                onClick={this.update_member_application_status}
                                loading={this.state.awaitingResponse}
                                disabled={this.props.user.member?.status === this.state.status}
                                appearance="primary"
                            >
                                Update
                            </Button>
                        </Modal>
                    </div>
                )}
            </div>
        );
    };
}

export default withToasterHook(SingleUser);
