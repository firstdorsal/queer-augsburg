import update from "immutability-helper";
import { Component } from "preact";
import {
    Button,
    Checkbox,
    DatePicker,
    Input,
    Message,
    Modal,
    Radio,
    RadioGroup,
    SelectPicker,
    TagInput,
    TagPicker,
    useToaster
} from "rsuite";
import { Meeting } from "../apiTypes/Meeting";
import { OnlineMeeting } from "../apiTypes/OnlineMeeting";
import { Place } from "../apiTypes/Place";
import {
    FormatState,
    MEETING_FORMATS,
    MEETING_FORMAT_LABELS,
    MeetingFormat,
    PLACE_TO_BE_ANNOUNCED_TEXT,
    chooseFormat,
    initialFormatState,
    isMeetingFormat,
    keepsHiddenLink,
    venueProblem
} from "../places";
import { G, commonTags, queerTags } from "../types";
import { withToasterHook } from "../utils";
import Md from "./Md";
import MeetingList from "./MeetingList";
import PlaceField from "./PlaceField";

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
    readonly formatState: FormatState;
    readonly loadingLink: boolean;
}

const editorState = (editingMeeting: Meeting) => ({
    editingMeeting,
    formatState: initialFormatState(editingMeeting)
});

class EditMeeting extends Component<EditMeetingProps, EditMeetingState> {
    constructor(props: EditMeetingProps) {
        super(props);
        const editingMeeting = structuredClone(props.meeting);
        if (props.newMeeting) {
            editingMeeting.status = props.type;
        }
        this.state = { ...editorState(editingMeeting), loadingLink: false };
    }

    changeFormat = (format: MeetingFormat) => {
        this.setState(({ editingMeeting, formatState }) => {
            const chosen = chooseFormat(editingMeeting, formatState, format);
            return { editingMeeting: chosen.meeting, formatState: chosen.state };
        });
    };

    setPlace = (place: Place) => {
        this.setState((state) =>
            update(state, {
                editingMeeting: {
                    place_id: { $set: place._id },
                    // Only for display until saved; the server copies it from the place.
                    location: { $set: { name: place.name, lat: place.lat, lon: place.lon } }
                }
            })
        );
    };

    updateOnline = (change: Partial<OnlineMeeting>) => {
        this.setState((state) =>
            state.editingMeeting.online == null
                ? state
                : update(state, { editingMeeting: { online: { $merge: change } } })
        );
    };

    loadStoredLink = async () => {
        if (!this.props.g.qaClient || this.state.loadingLink) return;
        this.setState({ loadingLink: true });
        const result = await this.props.g.qaClient.get_meeting_link(this.state.editingMeeting._id);
        this.setState({ loadingLink: false });
        if (!result.ok) {
            this.showError(
                result.status === 0
                    ? "Link konnte nicht geladen werden: keine Antwort vom Server."
                    : `Link konnte nicht geladen werden (Fehler ${result.status}).`
            );
            return;
        }
        // From now on the field holds the real link: clearing it removes the link.
        this.updateOnline({ url: result.url ?? "", url_hidden: false });
    };

    showError = (message: string) => {
        this.props.toaster.push(
            <Message showIcon type={"error"} closable>
                {message}
            </Message>,
            {
                placement: "bottomCenter",
                duration: 8000
            }
        );
    };

    updateMeeting = async () => {
        if (!this.props.g.qaClient) return;

        const problem = venueProblem(this.state.editingMeeting, this.state.formatState.format);
        if (problem) {
            this.showError(problem);
            return;
        }

        const result = await this.props.g.qaClient.update_meeting(this.state.editingMeeting);
        if (result.ok) {
            await this.props.reloadMeetingList(result.meeting);
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
            this.showError(`Treffen konnte nicht gespeichert werden: ${result.message}`);
        }
    };

    deleteMeeting = async () => {
        if (!this.props.g.qaClient) return;
        const success = await this.props.g.qaClient.delete_meeting(this.state.editingMeeting);
        if (success) {
            await this.props.reloadMeetingList(this.state.editingMeeting, true);
            this.props.changEditing(false);
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
        this.setState(editorState(structuredClone(this.props.meeting)));
        this.props.changEditing(false);
    };

    render = () => {
        const em = this.state.editingMeeting;
        const { format } = this.state.formatState;
        const emTime = em.time === null ? null : new Date(em.time);
        return (
            <div className="EditMeeting">
                <Modal open={this.props.editing}>
                    <Modal.Body>
                        Titel
                        <Input
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
                                    return update(state, {
                                        editingMeeting: {
                                            status: { $set: v as "Planned" | "Active" }
                                        }
                                    });
                                });
                            }}
                            searchable={false}
                        />
                        <br />
                        <br />
                        <b>Zeit</b>
                        <br />
                        <DatePicker
                            onChange={(v) => {
                                const t = v?.getTime();

                                this.setState((state) => {
                                    return update(state, {
                                        editingMeeting: {
                                            time: {
                                                $set: t ?? null
                                            }
                                        }
                                    });
                                });
                            }}
                            onChangeCalendarDate={(v: Date) => {
                                this.setState((state) => {
                                    return update(state, {
                                        editingMeeting: {
                                            time: {
                                                $set: v.getTime()
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
                        <b>Ort</b>
                        <br />
                        <RadioGroup
                            name="meeting-format"
                            inline
                            // Narrow screens: whole options per line instead of squeezed labels.
                            className="flex-wrap"
                            value={format}
                            onChange={(value) => {
                                if (isMeetingFormat(value)) this.changeFormat(value);
                            }}
                        >
                            {MEETING_FORMATS.map((option) => (
                                <Radio key={option} value={option}>
                                    {MEETING_FORMAT_LABELS[option]}
                                </Radio>
                            ))}
                        </RadioGroup>
                        {format !== "online" && (
                            <Checkbox
                                checked={em.place_to_be_announced}
                                onChange={(_value, checked) =>
                                    this.setState((state) =>
                                        update(state, {
                                            editingMeeting: {
                                                place_to_be_announced: { $set: checked }
                                            }
                                        })
                                    )
                                }
                            >
                                {PLACE_TO_BE_ANNOUNCED_TEXT}
                            </Checkbox>
                        )}
                        {this.props.g.qaClient && (
                            // Stays mounted while there is no place to choose so the place list
                            // is not reloaded on every toggle.
                            <div
                                className={
                                    format === "online" || em.place_to_be_announced
                                        ? "hidden"
                                        : undefined
                                }
                            >
                                <PlaceField
                                    qaClient={this.props.g.qaClient}
                                    placeId={em.place_id}
                                    legacyName={em.place_id ? null : (em.location?.name ?? null)}
                                    onChange={this.setPlace}
                                />
                            </div>
                        )}
                        {em.online != null && (
                            <div className="mt-3 flex flex-col gap-2">
                                <label htmlFor="edit-meeting-platform">Plattform</label>
                                <Input
                                    id="edit-meeting-platform"
                                    value={em.online.platform}
                                    onChange={(value: string) =>
                                        this.updateOnline({ platform: value })
                                    }
                                    placeholder="z. B. Zoom"
                                />
                                <label htmlFor="edit-meeting-link">Link zum Teilnehmen</label>
                                <Input
                                    id="edit-meeting-link"
                                    value={em.online.url ?? ""}
                                    // Typing (also clearing) replaces the withheld link.
                                    onChange={(value: string) =>
                                        this.updateOnline({ url: value, url_hidden: false })
                                    }
                                    placeholder={
                                        keepsHiddenLink(em.online)
                                            ? "Gespeicherter Link bleibt erhalten"
                                            : "https://…"
                                    }
                                />
                                {keepsHiddenLink(em.online) && (
                                    <span className="text-sm opacity-80">
                                        Ein Link ist gespeichert.{" "}
                                        <Button
                                            appearance="link"
                                            size="sm"
                                            className="p-0 align-baseline"
                                            onClick={this.loadStoredLink}
                                            loading={this.state.loadingLink}
                                        >
                                            Link anzeigen und bearbeiten
                                        </Button>
                                    </span>
                                )}
                                <span className="text-sm opacity-80">
                                    Den Link bitte nicht in die Beschreibung schreiben, dort ist er
                                    für alle sichtbar.
                                </span>
                                <Checkbox
                                    checked={!em.online.members_only}
                                    disabled={keepsHiddenLink(em.online)}
                                    onChange={(_value, checked) =>
                                        this.updateOnline({ members_only: !checked })
                                    }
                                >
                                    Link öffentlich anzeigen
                                </Checkbox>
                                <span className="text-sm opacity-80">
                                    {keepsHiddenLink(em.online)
                                        ? "Um den gespeicherten Link öffentlich zu machen, ihn zuerst anzeigen."
                                        : em.online.members_only
                                          ? "Der Link ist nur für angemeldete, verifizierte Mitglieder sichtbar."
                                          : "Der Link ist für alle sichtbar, auch ohne Anmeldung."}
                                </span>
                            </div>
                        )}
                        <br />
                        <br />
                        <b>Barrierefreiheit</b>
                        <br />
                        <Input
                            //@ts-ignore
                            value={em.accessibility}
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            //@ts-ignore
                            value={em.trigger_warning}
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            onChange={(v) => {
                                this.setState((state) => {
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
                            data={commonTags.map((item) => ({ label: item, value: item }))}
                        />
                        <br />
                        <b>Für welche Gruppen</b>
                        <TagPicker
                            value={em.tags.queer}
                            onChange={(v) => {
                                this.setState((state) => {
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
                            data={queerTags.map((item) => ({ label: item, value: item }))}
                        />
                        <br />
                        <b>Eigene Tags</b>
                        <TagInput
                            value={em.tags.freeform}
                            onChange={(v) => {
                                const newTags = structuredClone(v) as string[];
                                this.setState((state) => {
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
                        <br />
                        <b>Wie viele Menschen waren da?</b>
                        <Input
                            //@ts-ignore
                            value={em.attendance}
                            onChange={(v) => {
                                this.setState((state) => {
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
                        <br />
                        <b>Ist das Treffen abgesagt?</b>
                        <br />
                        <Checkbox
                            checked={em.cancelled === null ? false : em.cancelled}
                            onChange={(_v, checked) => {
                                this.setState((state) => {
                                    return update(state, {
                                        editingMeeting: {
                                            cancelled: { $set: checked }
                                        }
                                    });
                                });
                            }}
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
