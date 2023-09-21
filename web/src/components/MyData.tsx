import { Component } from "preact";
import { Button, Checkbox, CheckboxGroup, Form, Radio, RadioGroup, Schema } from "rsuite";
import { G } from "../types";
import update from "immutability-helper";
import cloneDeep from "lodash/cloneDeep";
import { SubmittedMember } from "../apiTypes/SubmittedMember";

const nameRule = Schema.Types.StringType().isRequired("Diese Information ist nicht optional.");
const emailRule = Schema.Types.StringType()
    .isRequired("Diese Information ist nicht optional.")
    .isEmail("Bitte gib eine gültige E-Mail Adresse an.");

interface MyDataProps {
    readonly g: G;
}
interface MyDataState {
    readonly formData: any;
    readonly loadedUserData: boolean;
}
export default class MyData extends Component<MyDataProps, MyDataState> {
    constructor(props: MyDataProps) {
        super(props);
        this.state = {
            formData: cloneDeep(defaultFormData),
            loadedUserData: false
        };
    }

    componentDidMount = async () => {
        const user = await this.props.g.qaClient?.get_own_user();

        if (!user) return;
        const memberData = user.member;

        if (memberData) {
            this.setState(state => {
                return update(state, {
                    loadedUserData: { $set: true },
                    formData: {
                        $set: {
                            type: memberData.type,
                            passport: memberData.name ? memberData.name.passport : null,
                            first_name: memberData.name ? memberData.name.first_name : null,
                            last_name: memberData.name ? memberData.name.last_name : null,
                            email: memberData.email,
                            phone: memberData.phone,
                            addition: memberData.address.addition,
                            street: memberData.address.street,
                            number: memberData.address.number,
                            zip: memberData.address.zip,
                            city: memberData.address.city,
                            country: memberData.address.country,
                            zustimmung: [
                                memberData.above_18 ? "above_18" : null,
                                memberData.approved_charter ? "approved_charter" : null,
                                memberData.approved_privacy ? "approved_privacy" : null
                            ],
                            institution: memberData.institution,
                            natural_person: memberData.natural_person,

                            pronouns: memberData.pronouns,
                            reference: memberData.reference,
                            user_notes: memberData.user_notes
                        }
                    }
                });
            });
        } else {
            this.setState(state => {
                return update(state, {
                    loadedUserData: { $set: true }
                });
            });
        }
    };

    handleFormChange = (value: any) => {
        console.log(value);

        this.setState(state => {
            return update(state, {
                formData: {
                    $set: value
                }
            });
        });
    };

    saveData = () => {
        const value = this.state.formData;

        const m: SubmittedMember = {
            above_18: value?.zustimmung?.includes("above_18") ?? false,
            approved_charter: value?.zustimmung?.includes("approved_charter") ?? false,
            approved_privacy: value?.zustimmung?.includes("approved_privacy") ?? false,
            institution:
                value.institution && value.institution.length > 0 ? value.institution : null,
            natural_person: value.natural_person,
            type: value.natural_person ? value.type : "Supporting",
            name: value?.natural_person
                ? {
                      passport: value?.passport,
                      first_name: value?.first_name,
                      last_name: value?.last_name
                  }
                : null,
            email: value.email,
            phone: value.phone?.length > 0 ? value.phone : null,
            address: {
                addition: value.addition && value.addition.length > 0 ? value.addition : null,
                street: value.street,
                number: value.number,
                zip: value.zip,
                city: value.city,
                country: value.country
            },

            pronouns: value.pronouns && value.pronouns.length > 0 ? value.pronouns : null,
            reference: value.reference && value.reference.length > 0 ? value.reference : null,
            user_notes: value.user_notes && value.user_notes.length > 0 ? value.user_notes : null
        };

        this.props.g.qaClient
            ?.update_own_member_data(m)
            .then(() => {
                alert("Daten gespeichert");
            })
            .catch(() => {
                alert("Fehler beim Speichern");
            });
    };

    render = () => {
        if (!this.state.loadedUserData) {
            return <div className="MyData">Lade...</div>;
        }
        return (
            <div className="MyData">
                <h1>Mitgliedschaft</h1>
                <div>
                    <h2>Meine Daten</h2>
                    <div>
                        <RadioGroup
                            inline
                            appearance="picker"
                            value={this.state.formData.natural_person ? "true" : "false"}
                            onChange={v => {
                                this.setState(state =>
                                    update(state, {
                                        formData: {
                                            natural_person: {
                                                $set: v === "true" ? true : false
                                            }
                                        }
                                    })
                                );
                            }}
                        >
                            <Radio value="true">Mensch</Radio>
                            <Radio value="false">Institution</Radio>
                        </RadioGroup>
                    </div>
                    <Form formValue={this.state.formData} onChange={this.handleFormChange}>
                        <div>
                            {this.state.formData.natural_person ? (
                                <div>
                                    <h3>Persönliches</h3>
                                    <RadioGroup
                                        inline
                                        value={this.state.formData.type}
                                        onChange={v => {
                                            this.setState(
                                                update(this.state, {
                                                    formData: {
                                                        type: {
                                                            $set: v
                                                        }
                                                    }
                                                })
                                            );
                                        }}
                                    >
                                        <Radio value="Active">Aktives Mitglied</Radio>
                                        <Radio value="Supporting">Fördermitglied</Radio>
                                    </RadioGroup>
                                    <Form.Group>
                                        <Form.ControlLabel>
                                            Ganzer Name auf dem Personalausweis *
                                        </Form.ControlLabel>
                                        <Form.Control rule={nameRule} name="passport" />
                                        <Form.HelpText>
                                            Aus rechtlichen Gründen benötigt.
                                        </Form.HelpText>
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.ControlLabel>Vorname *</Form.ControlLabel>
                                        <Form.Control rule={nameRule} name="first_name" />
                                        <Form.HelpText>
                                            Dein Vorname mit dem du angesprochen werden möchtest.
                                        </Form.HelpText>
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.ControlLabel>Nachname *</Form.ControlLabel>
                                        <Form.Control rule={nameRule} name="last_name" />
                                        <Form.HelpText>
                                            Dein Nachname mit dem du angesprochen werden möchtest.
                                        </Form.HelpText>
                                    </Form.Group>
                                    <Form.Group>
                                        <Form.ControlLabel>Pronomen</Form.ControlLabel>
                                        <Form.Control name="pronouns" />
                                    </Form.Group>
                                </div>
                            ) : (
                                <div>
                                    <h3>Name</h3>
                                    <Form.Group>
                                        <Form.ControlLabel>
                                            Name der Institution *
                                        </Form.ControlLabel>
                                        <Form.Control rule={nameRule} name="institution" />
                                    </Form.Group>
                                </div>
                            )}
                        </div>
                        <div>
                            <h3>Kontakt</h3>
                            <div>
                                <Form.Group>
                                    <Form.ControlLabel>E-Mail *</Form.ControlLabel>
                                    <Form.Control rule={emailRule} type="email" name="email" />
                                </Form.Group>
                            </div>
                            <div>
                                <Form.Group>
                                    <Form.ControlLabel>Telefonnummer</Form.ControlLabel>
                                    <Form.Control name="phone" />
                                </Form.Group>
                            </div>
                        </div>
                        <div>
                            <h3>Adresse</h3>
                            <div>
                                <Form.Group name="address">
                                    <Form.ControlLabel>Straße *</Form.ControlLabel>
                                    <Form.Control rule={nameRule} name="street" />
                                </Form.Group>
                                <Form.Group>
                                    <Form.ControlLabel>Hausnummer *</Form.ControlLabel>
                                    <Form.Control rule={nameRule} name="number" />
                                </Form.Group>
                                <Form.Group>
                                    <Form.ControlLabel>Adresszusatz</Form.ControlLabel>
                                    <Form.Control name="addition" />
                                </Form.Group>

                                <Form.Group>
                                    <Form.ControlLabel>PLZ *</Form.ControlLabel>
                                    <Form.Control rule={nameRule} name="zip" />
                                </Form.Group>
                                <Form.Group>
                                    <Form.ControlLabel>Stadt *</Form.ControlLabel>
                                    <Form.Control rule={nameRule} name="city" />
                                </Form.Group>
                                <Form.Group>
                                    <Form.ControlLabel>Land *</Form.ControlLabel>
                                    <Form.Control rule={nameRule} name="country" />
                                </Form.Group>
                            </div>

                            <div>
                                <h3>Sonstiges</h3>
                                <Form.Group>
                                    <Form.ControlLabel>Zusätzliche Informationen</Form.ControlLabel>
                                    <Form.Control name="user_notes" />
                                </Form.Group>
                                <Form.Group>
                                    <Form.ControlLabel>Woher kennst du uns?</Form.ControlLabel>
                                    <Form.Control name="reference" />
                                    <Form.HelpText>
                                        Wenn du einen QR-Code gescannt hast automatisch <br />{" "}
                                        eingetragene ID des Treffens, ansonsten bitte eintragen.
                                    </Form.HelpText>
                                </Form.Group>
                            </div>

                            <div>
                                <h3>Zustimmung</h3>
                                <Form.Group>
                                    <Form.Control accepter={CheckboxGroup} name="zustimmung">
                                        <Checkbox
                                            checked={this.state.formData.above_18}
                                            name="above_18"
                                            value="above_18"
                                        >
                                            Ich bin über 18 Jahre alt.
                                        </Checkbox>
                                        <Checkbox name="approved_charter" value="approved_charter">
                                            Ich habe die <a href="/satzung.pdf">Satzung</a> gelesen
                                            und stimme ihr zu.
                                        </Checkbox>
                                        <Checkbox name="approved_privacy" value="approved_privacy">
                                            Ich habe die{" "}
                                            <a href="/impressum">Datenschutzerklärung</a> gelesen
                                            und stimme ihr zu.
                                        </Checkbox>
                                    </Form.Control>
                                </Form.Group>
                            </div>
                            <div>
                                <Button
                                    onClick={this.saveData}
                                    appearance="primary"
                                    type="submit"
                                    disabled={this.state.formData.zustimmung.length !== 3}
                                >
                                    Speichern
                                </Button>
                            </div>
                        </div>
                    </Form>
                </div>
            </div>
        );
    };
}

const defaultFormData = {
    type: "Active",
    passport: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    addition: "",
    street: "",
    number: "",
    zip: "",
    city: "",
    country: "",
    above_18: false,
    approved_charter: false,
    approved_privacy: false,
    institution: "",
    natural_person: true,
    instagram: "",
    website: "",
    pronouns: "",
    reference: "",
    user_notes: ""
};
