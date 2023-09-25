import { Component } from "preact";
import { G, commonTags, queerTags } from "../types";
import {
    Button,
    DatePicker,
    Input,
    Message,
    Modal,
    SelectPicker,
    TagInput,
    TagPicker,
    useToaster
} from "rsuite";
import { Meeting } from "../apiTypes/Meeting";
import { cloneDeep } from "lodash";
import update from "immutability-helper";
import MeetingList from "./MeetingList";
import { withToasterHook } from "../utils";
import Md from "./Md";

interface EditMeetingProps {
    readonly g: G;
    readonly meeting: Meeting;
    readonly editing: boolean;
    readonly changEditing: (editing: boolean) => void;
    readonly reloadMeetingList: InstanceType<typeof MeetingList>["reloadMeetingList"];
    readonly toaster: ReturnType<typeof useToaster>;
    readonly newMeeting?: boolean;
}
interface EditMeetingState {
    readonly editingMeeting: Meeting;
    readonly cords: string;
}
class EditMeeting extends Component<EditMeetingProps, EditMeetingState> {
    constructor(props: EditMeetingProps) {
        super(props);
        this.state = {
            editingMeeting: cloneDeep(props.meeting),
            cords: `${props.meeting.location.lat}, ${props.meeting.location.lon}`
        };
    }

    updateMeeting = async () => {
        if (!this.props.g.qaClient) return;

        const splitCords = this.state.cords.split(",");

        const success = await this.props.g.qaClient.update_meeting({
            ...this.state.editingMeeting,
            location: {
                ...this.state.editingMeeting.location,
                lat: parseFloat(splitCords[0]),
                lon: parseFloat(splitCords[1])
            }
        });
        if (success) {
            await this.props.reloadMeetingList();
            this.props.changEditing(false);
            this.props.toaster.push(
                <Message showIcon type={"success"} closable>
                    Treffen erfolgreich gespeichert!
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
        } else {
            this.props.toaster.push(
                <Message showIcon type={"error"} closable>
                    Treffen konnte nicht gespeichert werden!
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
        }
    };

    deleteMeeting = async () => {
        if (!this.props.g.qaClient) return;
        const success = await this.props.g.qaClient.delete_meeting(this.state.editingMeeting);
        if (success) {
            await this.props.reloadMeetingList();
            this.props.changEditing(false);
            this.props;
            this.props.toaster.push(
                <Message showIcon type={"success"} closable>
                    Treffen erfolgreich gelöscht!
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
        } else {
            this.props.toaster.push(
                <Message showIcon type={"error"} closable>
                    Treffen konnte nicht gelöscht werden!
                </Message>,
                {
                    placement: "bottomCenter",
                    duration: 5000
                }
            );
        }
    };

    reset = () => {
        this.setState({
            editingMeeting: cloneDeep(this.props.meeting),
            cords: `${this.props.meeting.location.lat}, ${this.props.meeting.location.lon}`
        });
        this.props.changEditing(false);
    };

    render = () => {
        const em = this.state.editingMeeting;
        const emTime = new Date(Number(em.time));
        return (
            <div className="EditMeeting">
                <Modal open={this.props.editing}>
                    <Modal.Body>
                        Titel
                        <Input
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            title: { $set: v }
                                        }
                                    });
                                });
                            }}
                            value={em.title}
                            placeholder="Titel"
                        ></Input>
                        <br />
                        <b>
                            Beschreibung (
                            <a
                                target="_blank"
                                rel="noreferrer"
                                href="https://www.markdownguide.org/cheat-sheet/"
                            >
                                Markdown Support
                            </a>
                            )
                        </b>
                        <br />
                        [linkText](https://www.example.com)
                        <br />
                        **fett**
                        <br />
                        *kursiv*
                        <br />
                        <Input
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            description: { $set: v }
                                        }
                                    });
                                });
                            }}
                            value={em.description}
                            as="textarea"
                            rows={10}
                            placeholder="Beschreibung"
                        ></Input>
                        <br />
                        <b>Beschreibung (Vorschau)</b>
                        <br />
                        <br />
                        <Md plainText={em.description}></Md>
                        <br />
                        <b>Status</b>
                        <br />
                        <SelectPicker
                            value={em.status}
                            data={[
                                { value: "Planned", label: "Geplant" },
                                { value: "Active", label: "Aktiv" }
                            ]}
                            searchable={false}
                        ></SelectPicker>
                        <br />
                        <br />
                        <b>Zeit</b>
                        <br />
                        <DatePicker
                            onChange={v => {
                                const t = v?.getTime();

                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            time: {
                                                $set: t ? BigInt(t) : null
                                            }
                                        }
                                    });
                                });
                            }}
                            value={emTime}
                            format="yyyy-MM-dd HH:mm:ss"
                        />
                        <br />
                        <br />
                        <b>Ort (Name und Koordinaten)</b>
                        <br />
                        <Input
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            location: {
                                                name: { $set: v }
                                            }
                                        }
                                    });
                                });
                            }}
                            value={em.location.name}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="Wittelsbacher Park"
                        ></Input>
                        <Input
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        cords: { $set: v }
                                    });
                                });
                            }}
                            value={this.state.cords}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="48.35725,10.88050"
                        ></Input>
                        <br />
                        <br />
                        <b>Ansprechpersonen/Verantwortliche</b>
                        <br />
                        <Input
                            value={em.authority}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            authority: { $set: v }
                                        }
                                    });
                                });
                            }}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="Paul"
                        ></Input>
                        <br />
                        <br />
                        <b>Triggerwarnungen</b>
                        <Input
                            value={em.trigger_warning}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            trigger_warning: { $set: v }
                                        }
                                    });
                                });
                            }}
                            placeholder="Triggerwarnung"
                        ></Input>
                        <br />
                        <b>Ungefährer Preis (Von - Bis)</b>
                        <br />
                        <Input
                            value={em.price[0]}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            price: {
                                                $set: [parseFloat(v), state.editingMeeting.price[1]]
                                            }
                                        }
                                    });
                                });
                            }}
                            type="number"
                            style={{ width: "50%", display: "inline" }}
                            placeholder="0"
                        ></Input>
                        <Input
                            value={em.price[1]}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            price: {
                                                $set: [state.editingMeeting.price[0], parseFloat(v)]
                                            }
                                        }
                                    });
                                });
                            }}
                            type="number"
                            style={{ width: "50%", display: "inline" }}
                            placeholder="0"
                        ></Input>
                        <br />
                        <br />
                        <b>Altersbeschränkungen (Von - Bis)</b>
                        <br />
                        <Input
                            value={em.age_restriction[0]}
                            type="number"
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            age_restriction: {
                                                $set: [
                                                    state.editingMeeting.age_restriction[0],
                                                    parseInt(v)
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="18"
                        ></Input>
                        <Input
                            value={em.age_restriction[1]}
                            type="number"
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            age_restriction: {
                                                $set: [
                                                    parseInt(v),
                                                    state.editingMeeting.age_restriction[1]
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="31"
                        ></Input>
                        <br />
                        <br />
                        <b>Art der Veranstaltung</b>
                        <TagPicker
                            value={em.tags.common}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            tags: {
                                                common: { $set: v }
                                            }
                                        }
                                    });
                                });
                            }}
                            block
                            data={commonTags.map(item => ({ label: item, value: item }))}
                        ></TagPicker>
                        <br />
                        <b>Für welche Gruppen</b>
                        <TagPicker
                            value={em.tags.queer}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            tags: {
                                                queer: { $set: v }
                                            }
                                        }
                                    });
                                });
                            }}
                            block
                            data={queerTags.map(item => ({ label: item, value: item }))}
                        ></TagPicker>
                        <br />
                        <b>Eigene Tags</b>
                        <TagInput
                            value={em.tags.freeform}
                            onChange={v => {
                                const newTags = cloneDeep(v) as string[];
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            tags: {
                                                freeform: { $set: newTags }
                                            }
                                        }
                                    });
                                });
                            }}
                            block
                        ></TagInput>
                        <b>Wie viele Menschen waren da?</b>
                        <Input
                            value={em.attendance}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            attendance: { $set: parseInt(v) }
                                        }
                                    });
                                });
                            }}
                            type="number"
                            placeholder="0"
                        ></Input>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button
                            onClick={() => {
                                this.updateMeeting();
                            }}
                            appearance="primary"
                        >
                            Speichern
                        </Button>
                        <Button onClick={this.reset} appearance="subtle">
                            Verwerfen
                        </Button>
                        {!this.props.newMeeting && (
                            <Button
                                style={{ background: "#ff2222", color: "white", float: "left" }}
                                onClick={() => {
                                    this.deleteMeeting();
                                }}
                                appearance="subtle"
                            >
                                Löschen
                            </Button>
                        )}
                    </Modal.Footer>
                </Modal>
            </div>
        );
    };
}

export default withToasterHook(EditMeeting);
