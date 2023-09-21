import { Component } from "preact";
import { G, commonTags, queerTags } from "../types";
import { Button, DatePicker, Input, Modal, SelectPicker, TagInput, TagPicker } from "rsuite";
import { Meeting } from "../apiTypes/Meeting";
import { cloneDeep } from "lodash";
import update from "immutability-helper";
import MeetingList from "./MeetingList";

interface EditMeetingProps {
    readonly g: G;
    readonly meeting: Meeting;
    readonly editing: boolean;
    readonly changEditing: (editing: boolean) => void;
    readonly reloadMeetingList: InstanceType<typeof MeetingList>["reloadMeetingList"];
}
interface EditMeetingState {
    readonly editingMeeting: Meeting;
    readonly cords: string;
}
export default class EditMeeting extends Component<EditMeetingProps, EditMeetingState> {
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
        }
    };
    deleteMeeting = async () => {
        if (!this.props.g.qaClient) return;
        const success = await this.props.g.qaClient.update_meeting(this.state.editingMeeting, true);
        if (success) {
            await this.props.reloadMeetingList();
            this.props.changEditing(false);
        }
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
                        Beschreibung
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
                        Status
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
                        Zeit
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
                        Ort (Name und Koordinaten)
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
                        Ansprechpersonen/Verantwortliche
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
                        Triggerwarnungen
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
                        Ungefährer Preis (Von - Bis)
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
                        Altersbeschränkungen (Von - Bis)
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
                        Art der Veranstaltung
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
                        Für welche Gruppen
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
                        Eigene Tags
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
                        Wie viele Menschen waren da?
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
                        <Button onClick={() => this.props.changEditing(false)} appearance="subtle">
                            Verwerfen
                        </Button>
                        <Button
                            style={{ background: "#ff2222", color: "white", float: "left" }}
                            onClick={() => {
                                this.deleteMeeting();
                            }}
                            appearance="subtle"
                        >
                            Löschen
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
        );
    };
}
