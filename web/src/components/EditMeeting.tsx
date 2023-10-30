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
    readonly type: "Planned" | "Active";
}

interface EditMeetingState {
    readonly editingMeeting: Meeting;
}

class EditMeeting extends Component<EditMeetingProps, EditMeetingState> {
    constructor(props: EditMeetingProps) {
        super(props);
        const editingMeeting = cloneDeep(props.meeting);
        if (props.newMeeting) {
            editingMeeting.status = props.type;
        }
        this.state = {
            editingMeeting
        };
    }

    updateMeeting = async () => {
        if (!this.props.g.qaClient) return;

        const success = await this.props.g.qaClient.update_meeting(this.state.editingMeeting);
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
            editingMeeting: cloneDeep(this.props.meeting)
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
                        />
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
                        **fett** | *kursiv* | [linkText](https://www.example.com) | \ (Backslash)
                        vor Sonderzeichen damit sie normal angezeigt werden
                        <br />
                        2 Leerzeichen am Ende der Zeile für erzwungene Zeilenumbrüche
                        <br />
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
                        />
                        <br />
                        <b>Beschreibung (Vorschau)</b>
                        <br />
                        <br />
                        <Md plainText={em.description} />
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
                        />
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
                                                $set: (t as unknown as bigint) ?? null
                                            }
                                        }
                                    });
                                });
                            }}
                            onChangeCalendarDate={(v: Date) => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            time: {
                                                $set: (v.getTime() as unknown as bigint) ?? null
                                            }
                                        }
                                    });
                                });
                            }}
                            value={emTime}
                            format="dd.MM.yyyy HH:mm:ss"
                        />
                        <br />
                        <br />
                        <b>
                            Ort (Name und Koordinaten(Latitude/Longitude für Augsburg immer ca.
                            48/10))
                        </b>
                        <br />
                        <p>
                            Rechtsklick/Lange drücken {">"} Adresse Anzeigen {">"} Koordinaten
                            kopieren (Linktext Kopieren)
                        </p>
                        <a
                            target="_blank"
                            rel="noreferrer"
                            href="https://www.openstreetmap.org/#map=14/48.3601/10.8934"
                        >
                            Open Street Map
                        </a>
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
                        />
                        <Input
                            onChange={v => {
                                v = v.replace(",", ".");
                                console.log(v);

                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            location: {
                                                lat: { $set: parseFloat(v) }
                                            }
                                        }
                                    });
                                });
                            }}
                            type="text"
                            value={this.state.editingMeeting.location.lat}
                            style={{ width: "25%", display: "inline" }}
                            placeholder="48.35725"
                        />
                        <Input
                            onChange={v => {
                                v = v.replace(",", ".");
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            location: {
                                                lon: { $set: parseFloat(v) }
                                            }
                                        }
                                    });
                                });
                            }}
                            type="text"
                            value={this.state.editingMeeting.location.lon}
                            style={{ width: "25%", display: "inline" }}
                            placeholder="10.89929"
                        />
                        <br />
                        <br />
                        <b>Barrierefreiheit</b>
                        <br />
                        <Input
                            value={em.accessibility}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            accessibility: { $set: v }
                                        }
                                    });
                                });
                            }}
                            placeholder="Barrierefreiheit"
                        />
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
                        />
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
                        />
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
                                                $set: [
                                                    parseFloat(v.length ? v : "0"),
                                                    ...(state.editingMeeting.price[1] === undefined
                                                        ? []
                                                        : [state.editingMeeting.price[1]])
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            type="number"
                            style={{ width: "50%", display: "inline" }}
                            placeholder="0"
                        />
                        <Input
                            value={em.price[1]}
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            price: {
                                                $set: [
                                                    state.editingMeeting.price[0],
                                                    ...(v === "" ? [] : [parseFloat(v)])
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            type="number"
                            style={{ width: "50%", display: "inline" }}
                            placeholder="0"
                        />
                        <br />
                        <br />
                        <b>Altersbeschränkungen (Von - Bis)</b>
                        <br />
                        Bis bitte leer lassen wenn es kein Maximalalter gibt
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
                                                    parseInt(v.length ? v : "0"),
                                                    ...(state.editingMeeting.age_restriction[1] ===
                                                    undefined
                                                        ? []
                                                        : [state.editingMeeting.age_restriction[1]])
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="18"
                        />
                        <Input
                            value={em.age_restriction[1]}
                            type="number"
                            onChange={v => {
                                this.setState(state => {
                                    return update(state, {
                                        editingMeeting: {
                                            age_restriction: {
                                                $set: [
                                                    state.editingMeeting.age_restriction[0],
                                                    ...(v === "" ? [] : [parseInt(v)])
                                                ]
                                            }
                                        }
                                    });
                                });
                            }}
                            style={{ width: "50%", display: "inline" }}
                            placeholder="31"
                        />
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
                        />
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
                        />
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
                        />
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
                        />
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
