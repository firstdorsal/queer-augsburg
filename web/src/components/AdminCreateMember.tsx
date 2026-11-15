import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { G } from "../types";
import { Button, Message, Textarea, toaster, type ToastOptions } from "./ui";

interface AdminCreateMemberProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly g: G;
}

interface AdminCreateMemberState {
    readonly newMember: string;
}

const toastParams: ToastOptions = { placement: "bottomEnd", duration: 10000 };

export default class AdminCreateMember extends Component<
    AdminCreateMemberProps,
    AdminCreateMemberState
> {
    constructor(props: AdminCreateMemberProps) {
        super(props);
        this.state = {
            newMember: ""
        };
    }

    componentDidMount = async () => {};

    createMember = async () => {
        if (!this.props.g.qaClient) return;

        this.props.g.qaClient
            .admin_create_member(this.state.newMember)
            .catch(() => {
                toaster.push(
                    <Message showIcon type={"error"} header={"Fehler beim Erstellen"} closable>
                        Fehler beim Erstellen
                    </Message>,
                    toastParams
                );
            })
            .then(async (res) => {
                if (!res) return;
                const data = await res.text();
                if (res.status === 201) {
                    toaster.push(
                        <Message showIcon type={"success"} header={"Nutzer erstellt"} closable>
                            {data}
                        </Message>,
                        toastParams
                    );
                } else {
                    toaster.push(
                        <Message showIcon type={"error"} header={"Fehler beim Erstellen"} closable>
                            {data}
                        </Message>,
                        toastParams
                    );
                }
            });
    };

    render = () => {
        return (
            <div
                style={{ ...this.props.style, margin: "40px" }}
                className={`AdminCreateMember ${this.props.className ?? ""}`}
            >
                <h1>Mitglied erstellen</h1>
                <h3>
                    <a
                        target="_blank"
                        rel="noreferrer"
                        href="https://git.vindelicum.eu/firstdorsal/queer-augsburg/-/blob/5c98a1c11a78c41977c03ed5d8fce102906b71e4/server/src/types.rs#L110"
                    >
                        Format
                    </a>
                </h3>
                <Textarea
                    rows={30}
                    placeholder={placeholder}
                    value={this.state.newMember}
                    onValueChange={(value) => this.setState({ newMember: value })}
                />
                <br />
                <Button onClick={this.createMember}>Mitglied erstellen</Button>
            </div>
        );
    };
}

const placeholder = `{
"type": "Active",
"natural_person": true,
"name": {
    "passport": "Adam Mustermensch",
    "first_name": "Adam",
    "last_name": "Mustermensch"
},
"institution": null,
"pronouns": null,
"address": {
    "street": "Rathausplatz",
    "number": "1",
    "addition": null,
    "zip": "86159",
    "city": "Augsburg",
    "country": "Deutschland"
},
"email": "adam@example.com",
"phone": null,
"user_notes": "Daten aus Papierantrag aufgenommen.",
"reference": null,
"approved_charter": true,
"approved_privacy": true,
"above_18": true 
}`;
