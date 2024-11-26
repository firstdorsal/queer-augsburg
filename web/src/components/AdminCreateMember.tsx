import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Button, Input, Message, useToaster } from "rsuite";
import { ToastContainerProps } from "rsuite/esm/toaster/ToastContainer";
import { G } from "../types";
import { withToasterHook } from "../utils";

interface AdminCreateMemberProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly g: G;
    readonly toaster: ReturnType<typeof useToaster>;
}

interface AdminCreateMemberState {
    readonly newMember: string;
}

const toastParams: ToastContainerProps = { placement: "bottomEnd", duration: 10000 };

export default withToasterHook(
    class AdminCreateMember extends Component<AdminCreateMemberProps, AdminCreateMemberState> {
        constructor(props: AdminCreateMemberProps) {
            super(props);
            this.state = {
                newMember: ""
            };
        }

        componentDidMount = async () => {};

        createMember = async () => {
            if (!this.props.g.qaClient) return;

            const res = await this.props.g.qaClient.admin_create_member(this.state.newMember);
            const data = await res.text();
            if (res.status === 201) {
                this.props.toaster.push(
                    <Message showIcon type={"success"} header={"Nutzer erstellt"} closable>
                        {data}
                    </Message>,
                    toastParams
                );
            } else {
                this.props.toaster.push(
                    <Message showIcon type={"error"} header={"Fehler beim Erstellen"} closable>
                        {data}
                    </Message>,
                    toastParams
                );
            }
        };

        render = () => {
            return (
                <div
                    style={{ ...this.props.style }}
                    className={`AdminCreateMember ${this.props.className ?? ""}`}
                >
                    <Input
                        value={this.state.newMember}
                        onChange={(value) => this.setState({ newMember: value })}
                    />
                    <Button onClick={this.createMember}>Mitglied erstellen</Button>
                </div>
            );
        };
    }
);
