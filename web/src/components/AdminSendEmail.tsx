import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import { Button, Checkbox, Input, Message, Steps, Uploader, useToaster } from "rsuite";
import { FileType } from "rsuite/esm/Uploader";
import { ToastContainerProps } from "rsuite/esm/toaster/ToastContainer";
import { EmailAttachment } from "../apiTypes/EmailAttachment";
import { G } from "../types";
import { withToasterHook } from "../utils";

interface AdminSendEmailProps {
    readonly className?: string;
    readonly style?: CSSProperties;
    readonly g: G;
    readonly toaster: ReturnType<typeof useToaster>;
}

interface AdminSendEmailState {
    currentStep: number;
    subject: string;
    body: string;
    attachments: FileType[];
    previewId: string;
    verificationCode: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    loading: boolean;
    error: string | null;
    testingMode: boolean;
}

const toastParams: ToastContainerProps = { placement: "bottomEnd", duration: 10000 };
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

export default withToasterHook(
    class AdminSendEmail extends Component<AdminSendEmailProps, AdminSendEmailState> {
        private _isMounted = false;

        constructor(props: AdminSendEmailProps) {
            super(props);
            this.state = {
                currentStep: 0,
                subject: "",
                body: "",
                attachments: [],
                previewId: "",
                verificationCode: "",
                recipientCount: 0,
                sentCount: 0,
                failedCount: 0,
                loading: false,
                error: null,
                testingMode: false
            };
        }

        componentDidMount() {
            this._isMounted = true;
        }

        componentWillUnmount() {
            this._isMounted = false;
        }

        safeSetState = (state: Partial<AdminSendEmailState>) => {
            if (this._isMounted) {
                this.setState(state as AdminSendEmailState);
            }
        };

        fileToBase64 = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => {
                    const result = reader.result as string;
                    // Remove the data:mime/type;base64, prefix
                    const base64 = result.split(",")[1];
                    resolve(base64);
                };
                reader.onerror = (error) => reject(error);
            });
        };

        sendPreview = async () => {
            if (!this.props.g.qaClient) return;

            // Validate
            if (!this.state.subject.trim()) {
                this.props.toaster.push(
                    <Message showIcon type="error" header="Fehler" closable>
                        Bitte gib einen Betreff ein.
                    </Message>,
                    toastParams
                );
                return;
            }

            if (!this.state.body.trim()) {
                this.props.toaster.push(
                    <Message showIcon type="error" header="Fehler" closable>
                        Bitte gib einen E-Mail-Text ein.
                    </Message>,
                    toastParams
                );
                return;
            }

            this.safeSetState({ loading: true, error: null });

            try {
                // Convert files to EmailAttachment format
                const attachments: EmailAttachment[] = await Promise.all(
                    this.state.attachments.map(async (fileType) => {
                        const file = fileType.blobFile as File;
                        const data = await this.fileToBase64(file);
                        return {
                            filename: file.name,
                            content_type: file.type || "application/octet-stream",
                            data
                        };
                    })
                );

                const result = await this.props.g.qaClient.send_email_preview(
                    this.state.subject,
                    this.state.body,
                    attachments
                );

                this.safeSetState({
                    currentStep: 1,
                    previewId: result.preview_id,
                    recipientCount: result.recipient_count,
                    loading: false
                });

                this.props.toaster.push(
                    <Message showIcon type="success" header="Vorschau gesendet" closable>
                        Eine Vorschau wurde an deine E-Mail-Adresse gesendet.
                    </Message>,
                    toastParams
                );
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
                this.safeSetState({ loading: false, error: errorMessage });
                this.props.toaster.push(
                    <Message showIcon type="error" header="Fehler" closable>
                        {errorMessage}
                    </Message>,
                    toastParams
                );
            }
        };

        confirmSend = async () => {
            if (!this.props.g.qaClient) return;

            if (!this.state.verificationCode.trim()) {
                this.props.toaster.push(
                    <Message showIcon type="error" header="Fehler" closable>
                        Bitte gib den Bestätigungscode ein.
                    </Message>,
                    toastParams
                );
                return;
            }

            this.safeSetState({ loading: true, error: null });

            try {
                const result = await this.props.g.qaClient.confirm_send_email(
                    this.state.previewId,
                    this.state.verificationCode,
                    this.state.testingMode
                );

                this.safeSetState({
                    currentStep: 2,
                    sentCount: result.sent_count,
                    failedCount: result.failed_count,
                    loading: false
                });

                if (result.failed_count > 0) {
                    this.props.toaster.push(
                        <Message showIcon type="warning" header="Teilweise erfolgreich" closable>
                            {result.sent_count} E-Mails gesendet, {result.failed_count} fehlgeschlagen.
                        </Message>,
                        toastParams
                    );
                } else {
                    this.props.toaster.push(
                        <Message showIcon type="success" header="Erfolgreich" closable>
                            {result.sent_count} E-Mails wurden erfolgreich gesendet.
                        </Message>,
                        toastParams
                    );
                }
            } catch (err) {
                const errorMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
                this.safeSetState({ loading: false, error: errorMessage });
                this.props.toaster.push(
                    <Message showIcon type="error" header="Fehler" closable>
                        {errorMessage}
                    </Message>,
                    toastParams
                );
            }
        };

        reset = () => {
            this.setState({
                currentStep: 0,
                subject: "",
                body: "",
                attachments: [],
                previewId: "",
                verificationCode: "",
                recipientCount: 0,
                sentCount: 0,
                failedCount: 0,
                loading: false,
                error: null,
                testingMode: false
            });
        };

        getTotalAttachmentSize = (): number => {
            return this.state.attachments.reduce((sum, f) => {
                const file = f.blobFile as File;
                return sum + (file?.size || 0);
            }, 0);
        };

        render = () => {
            const { currentStep, loading } = this.state;

            return (
                <div
                    style={{ ...this.props.style, padding: "20px" }}
                    className={`AdminSendEmail ${this.props.className ?? ""}`}
                >
                    <h2 style={{ marginBottom: "20px" }}>E-Mail an alle Mitglieder senden</h2>

                    <Steps current={currentStep} style={{ marginBottom: "30px" }}>
                        <Steps.Item title="E-Mail verfassen" />
                        <Steps.Item title="Vorschau prüfen" />
                        <Steps.Item title="Versand bestätigt" />
                    </Steps>

                    {currentStep === 0 && (
                        <div>
                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                                    Betreff
                                </label>
                                <Input
                                    placeholder="Betreff der E-Mail"
                                    value={this.state.subject}
                                    onChange={(value) => this.setState({ subject: value })}
                                />
                            </div>

                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                                    Nachricht
                                </label>
                                <Input
                                    as="textarea"
                                    rows={10}
                                    placeholder="Text der E-Mail..."
                                    value={this.state.body}
                                    onChange={(value) => this.setState({ body: value })}
                                />
                            </div>

                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                                    Anhänge (max. 10 MB gesamt)
                                </label>
                                <Uploader
                                    action=""
                                    autoUpload={false}
                                    multiple
                                    fileList={this.state.attachments}
                                    onChange={(fileList) => this.setState({ attachments: fileList })}
                                    shouldQueueUpdate={(fileList) => {
                                        const totalSize = fileList.reduce((sum, f) => {
                                            const file = f.blobFile as File;
                                            return sum + (file?.size || 0);
                                        }, 0);
                                        if (totalSize > MAX_ATTACHMENT_SIZE) {
                                            this.props.toaster.push(
                                                <Message showIcon type="error" header="Fehler" closable>
                                                    Anhänge überschreiten 10 MB.
                                                </Message>,
                                                toastParams
                                            );
                                            return false;
                                        }
                                        return true;
                                    }}
                                    draggable
                                >
                                    <div
                                        style={{
                                            height: 100,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            border: "2px dashed #ccc",
                                            borderRadius: "5px"
                                        }}
                                    >
                                        Dateien hierher ziehen oder klicken zum Auswählen
                                    </div>
                                </Uploader>
                                {this.state.attachments.length > 0 && (
                                    <div style={{ marginTop: "5px", fontSize: "12px", color: "#666" }}>
                                        Gesamt: {(this.getTotalAttachmentSize() / 1024 / 1024).toFixed(2)} MB
                                    </div>
                                )}
                            </div>

                            <div style={{ marginBottom: "15px" }}>
                                <Checkbox
                                    checked={this.state.testingMode}
                                    onChange={(_value, checked) =>
                                        this.setState({ testingMode: checked })
                                    }
                                >
                                    Testmodus (sendet nur an test@queer-augsburg.de)
                                </Checkbox>
                            </div>

                            <Button
                                appearance="primary"
                                onClick={this.sendPreview}
                                loading={loading}
                                disabled={loading}
                            >
                                Vorschau senden
                            </Button>
                        </div>
                    )}

                    {currentStep === 1 && (
                        <div>
                            <Message type="info" style={{ marginBottom: "20px" }}>
                                <p>
                                    Eine Vorschau wurde an deine E-Mail-Adresse gesendet. Bitte prüfe den
                                    Inhalt und gib den Bestätigungscode ein, um die E-Mail an alle{" "}
                                    <strong>{this.state.recipientCount}</strong> Mitglieder zu senden.
                                </p>
                            </Message>

                            <div style={{ marginBottom: "15px" }}>
                                <label style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
                                    Bestätigungscode
                                </label>
                                <Input
                                    placeholder="Code aus der Vorschau-E-Mail"
                                    value={this.state.verificationCode}
                                    onChange={(value) => this.setState({ verificationCode: value })}
                                    style={{ maxWidth: "300px" }}
                                />
                            </div>

                            <div style={{ display: "flex", gap: "10px" }}>
                                <Button
                                    appearance="primary"
                                    onClick={this.confirmSend}
                                    loading={loading}
                                    disabled={loading}
                                >
                                    E-Mail versenden
                                </Button>
                                <Button appearance="subtle" onClick={this.reset} disabled={loading}>
                                    Abbrechen
                                </Button>
                            </div>
                        </div>
                    )}

                    {currentStep === 2 && (
                        <div>
                            {this.state.failedCount === 0 ? (
                                <Message type="success" style={{ marginBottom: "20px" }}>
                                    <p>
                                        Die E-Mail wurde erfolgreich an <strong>{this.state.sentCount}</strong>{" "}
                                        Mitglieder gesendet.
                                    </p>
                                </Message>
                            ) : (
                                <Message type="warning" style={{ marginBottom: "20px" }}>
                                    <p>
                                        <strong>{this.state.sentCount}</strong> E-Mails wurden gesendet.
                                        <br />
                                        <strong>{this.state.failedCount}</strong> E-Mails konnten nicht
                                        zugestellt werden.
                                    </p>
                                </Message>
                            )}

                            <Button appearance="primary" onClick={this.reset}>
                                Neue E-Mail verfassen
                            </Button>
                        </div>
                    )}
                </div>
            );
        };
    }
);
