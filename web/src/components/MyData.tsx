import update from "immutability-helper";
import { Component, type ComponentChildren } from "preact";
import { BsInfoCircle } from "react-icons/bs";
import { MembershipStatus } from "../apiTypes/MembershipStatus";
import { SubmittedMember } from "../apiTypes/SubmittedMember";
import { type FieldRule, emailRule, requiredRule } from "../fieldRules";
import { G } from "../types";
import {
    Button,
    Checkbox,
    CheckboxGroup,
    EyeIcon,
    EyeSlashIcon,
    FormField,
    Input,
    InputGroup,
    InputGroupButton,
    Message,
    Radio,
    RadioGroup,
    Toggletip,
    toaster
} from "./ui";

const PERSON_RULES: readonly (readonly [string, FieldRule])[] = [
    ["passport", requiredRule],
    ["first_name", requiredRule],
    ["last_name", requiredRule]
];

const SHARED_RULES: readonly (readonly [string, FieldRule])[] = [
    ["email", emailRule],
    ["street", requiredRule],
    ["number", requiredRule],
    ["zip", requiredRule],
    ["city", requiredRule],
    ["country", requiredRule]
];

const visibleRules = (naturalPerson: boolean) => [
    ...(naturalPerson ? PERSON_RULES : [["institution", requiredRule] as const]),
    ...SHARED_RULES
];

interface TextFieldProps {
    readonly name: string;
    readonly values: Record<string, string | null | undefined>;
    readonly errors: Record<string, string | null>;
    readonly onChange: (name: string, value: string, rule?: FieldRule) => void;
    readonly label: ComponentChildren;
    readonly help?: ComponentChildren;
    readonly rule?: FieldRule;
    readonly placeholder?: string;
    readonly type?: string;
}

const TextField = ({
    name,
    values,
    errors,
    onChange,
    label,
    help,
    rule,
    placeholder,
    type
}: TextFieldProps) => (
    <FormField label={label} help={help} error={errors[name]}>
        <Input
            name={name}
            type={type}
            value={values[name] ?? ""}
            placeholder={placeholder}
            onValueChange={(value) => onChange(name, value, rule)}
        />
    </FormField>
);

interface MyDataProps {
    readonly g: G;
}
interface MyDataState {
    readonly formData: any;
    readonly formErrors: Record<string, string | null>;
    readonly loadedUserData: boolean;
    readonly responseMessage: string;
    readonly responseMessageType: "success" | "error" | null;
    readonly status: MembershipStatus | null;
    readonly passNameVisible: boolean;
}
class MyData extends Component<MyDataProps, MyDataState> {
    constructor(props: MyDataProps) {
        super(props);

        const newFormData = structuredClone(defaultFormData);
        newFormData.reference = props.g.ref ?? "";
        this.state = {
            formData: newFormData,
            formErrors: {},
            loadedUserData: false,
            responseMessage: "",
            responseMessageType: null,
            status: null,
            passNameVisible: false
        };
    }

    componentDidMount = async () => {
        const user = await this.props.g.qaClient?.get_own_user();

        if (!user) return;
        const memberData = user.member;

        if (memberData) {
            this.setState((state) => {
                return update(state, {
                    loadedUserData: { $set: true },
                    status: { $set: memberData.status },
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
            this.setState((state) => {
                return update(state, {
                    loadedUserData: { $set: true }
                });
            });
        }
    };

    handleFieldChange = (name: string, value: string, rule?: FieldRule) => {
        this.setState((state) => {
            return update(state, {
                formData: { [name]: { $set: value } },
                formErrors: { [name]: { $set: rule ? rule(value) : null } }
            });
        });
    };

    /** Shows the hints of all fields on the page, also of those nobody has touched yet. */
    checkAllFields = () => {
        const values = this.state.formData;
        const formErrors = Object.fromEntries(
            visibleRules(values.natural_person).map(([name, rule]) => [
                name,
                rule(values[name] ?? "")
            ])
        );
        this.setState({ formErrors });
    };

    saveData = () => {
        this.checkAllFields();
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
            .then(async (v) => {
                if (v.status === 200) {
                    this.setState({
                        status: "Pending"
                    });
                    toaster.push(
                        <Message showIcon type={"success"} closable>
                            Daten gespeichert
                        </Message>,
                        {
                            placement: "bottomCenter",
                            duration: 5000
                        }
                    );
                } else {
                    const text = await v.text();
                    console.log(text);

                    toaster.push(
                        <Message showIcon type={"error"} closable>
                            Fehler beim speichern der Daten: {text}
                        </Message>,
                        {
                            placement: "bottomCenter",
                            duration: 0
                        }
                    );
                }
            })
            .catch((e) => {
                toaster.push(
                    <Message showIcon type={"error"} closable>
                        Fehler beim speichern der Daten: {e.message}
                    </Message>,
                    {
                        placement: "bottomCenter",
                        duration: 0
                    }
                );
            });
    };

    render = () => {
        const form = {
            values: this.state.formData,
            errors: this.state.formErrors,
            onChange: this.handleFieldChange
        };
        if (!this.state.loadedUserData) {
            return <div className="MyData"></div>;
        }
        return (
            <div className="MyData">
                <h1>Mitgliedschaft</h1>
                <p>
                    Hier kannst du unseren Mitgliedsantrag ausfüllen oder deine Daten abändern. Nach
                    der Annahme deines Antrags erhältst du eine Mail zur Bestätigung. Die
                    Mitgliedschaft ist kostenlos und kann jederzeit beendet werden.
                </p>
                <h2>Status</h2>
                {(() => {
                    if (this.state.status === "Approved") {
                        return <p>Du bist Mitglied von Queer Augsburg!</p>;
                    } else if (this.state.status === "Pending") {
                        return (
                            <p>
                                Dein Mitgliedsantrag ist eingegangen wurde aber noch nicht
                                bestätigt.
                            </p>
                        );
                    } else if (this.state.status === "Rejected") {
                        return <p>Dein Mitgliedsantrag wurde abgelehnt.</p>;
                    } else if (this.state.status === "Left") {
                        return <p>Du hast Queer Augsburg verlassen.</p>;
                    } else if (this.state.status === "Expelled") {
                        return <p>Du wurdest von Queer Augsburg ausgeschlossen.</p>;
                    } else {
                        return <p>Du hast noch keinen Mitgliedsantrag gestellt.</p>;
                    }
                })()}
                <div>
                    <h2>Meine Daten</h2>
                    <div>
                        <RadioGroup
                            inline
                            tabs
                            value={this.state.formData.natural_person ? "true" : "false"}
                            onChange={(v) => {
                                this.setState((state) =>
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
                    <form onSubmit={(event) => event.preventDefault()}>
                        <div>
                            {this.state.formData.natural_person ? (
                                <div>
                                    <h3>Persönliches</h3>
                                    <RadioGroup
                                        inline
                                        value={this.state.formData.type ?? ""}
                                        onChange={(v) => {
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
                                        <Toggletip
                                            aria-label="Unterschied der Mitgliedschaften"
                                            className="mt-[11px] self-start"
                                            content="Aktive Mitglieder haben ein Stimmrecht in der Mitgliederversammlung. Fördermitglieder haben kein Stimmrecht."
                                        >
                                            <BsInfoCircle />
                                        </Toggletip>
                                    </RadioGroup>

                                    <FormField
                                        label="Ganzer Vor- und Nachname auf dem Personalausweis *"
                                        error={this.state.formErrors.passport}
                                        help={
                                            <>
                                                Wird aus rechtlichen Gründen benötigt. <br />
                                                Dieser Name wird nicht mal dem Vorstand angezeigt.
                                            </>
                                        }
                                    >
                                        <InputGroup inside>
                                            <Input
                                                name="passport"
                                                type={
                                                    this.state.passNameVisible ? "text" : "password"
                                                }
                                                value={this.state.formData.passport ?? ""}
                                                placeholder="Anna Mustermensch"
                                                autoComplete="off"
                                                onValueChange={(value) =>
                                                    this.handleFieldChange(
                                                        "passport",
                                                        value,
                                                        requiredRule
                                                    )
                                                }
                                            />
                                            <InputGroupButton
                                                inside
                                                aria-label="Namen anzeigen oder verbergen"
                                                onClick={() => {
                                                    this.setState((state) => {
                                                        return update(state, {
                                                            passNameVisible: {
                                                                $set: !state.passNameVisible
                                                            }
                                                        });
                                                    });
                                                }}
                                            >
                                                {this.state.passNameVisible ? (
                                                    <EyeIcon />
                                                ) : (
                                                    <EyeSlashIcon />
                                                )}
                                            </InputGroupButton>
                                        </InputGroup>
                                    </FormField>
                                    <TextField
                                        {...form}
                                        label="Vorname *"
                                        rule={requiredRule}
                                        name="first_name"
                                        placeholder="Milan"
                                        help={
                                            <>
                                                Dein Vorname mit dem du angesprochen werden
                                                möchtest.
                                            </>
                                        }
                                    />
                                    <TextField
                                        {...form}
                                        label="Nachname *"
                                        rule={requiredRule}
                                        placeholder="Mustermensch"
                                        name="last_name"
                                        help={
                                            <>
                                                Dein Nachname mit dem du angesprochen werden
                                                möchtest.
                                            </>
                                        }
                                    />
                                    <TextField
                                        {...form}
                                        label="Pronomen"
                                        name="pronouns"
                                        placeholder="er/ihm/seine"
                                    />
                                </div>
                            ) : (
                                <div>
                                    <h3>Name</h3>
                                    <TextField
                                        {...form}
                                        label="Name der Institution *"
                                        rule={requiredRule}
                                        name="institution"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <h3>Kontakt</h3>
                            <div>
                                <TextField
                                    {...form}
                                    label="E-Mail *"
                                    rule={emailRule}
                                    type="email"
                                    name="email"
                                    placeholder="mail@example.com"
                                />

                                <TextField
                                    {...form}
                                    label="Telefonnummer (Mit internationaler Vorwahl)"
                                    name="phone"
                                    placeholder="+49176..."
                                />
                            </div>
                        </div>

                        <div>
                            <h3>Adresse</h3>
                            <div>
                                <TextField
                                    {...form}
                                    label="Straße *"
                                    rule={requiredRule}
                                    name="street"
                                    placeholder="Regenbogenstraße"
                                />
                                <TextField
                                    {...form}
                                    label="Hausnummer *"
                                    rule={requiredRule}
                                    name="number"
                                    placeholder="69"
                                />
                                <TextField
                                    {...form}
                                    label="Adresszusatz"
                                    name="addition"
                                    placeholder="Apartment 1999"
                                />

                                <TextField
                                    {...form}
                                    label="PLZ *"
                                    rule={requiredRule}
                                    name="zip"
                                    placeholder="86150"
                                />
                                <TextField
                                    {...form}
                                    label="Stadt *"
                                    rule={requiredRule}
                                    name="city"
                                    placeholder="Augsburg"
                                />
                                <TextField
                                    {...form}
                                    label="Land *"
                                    rule={requiredRule}
                                    name="country"
                                    placeholder="Deutschland"
                                />
                            </div>

                            <div>
                                <h3>Sonstiges</h3>
                                <TextField
                                    {...form}
                                    label="Zusätzliche Informationen"
                                    name="user_notes"
                                    help={
                                        <>
                                            Hier kannst du uns noch etwas mitteilen, was du uns
                                            sonst noch sagen möchtest.
                                        </>
                                    }
                                />
                                <TextField
                                    {...form}
                                    label="Woher kennst du uns?"
                                    name="reference"
                                    help={
                                        <>
                                            Wenn du einen QR-Code gescannt hast, wird automatisch{" "}
                                            <br /> die ID des Treffens eingetragen. Ansonsten gib
                                            bitte an, woher du uns kennst.
                                        </>
                                    }
                                />
                            </div>

                            <div>
                                <h3>Zustimmung</h3>
                                <CheckboxGroup
                                    value={this.state.formData.zustimmung ?? []}
                                    onChange={(zustimmung) =>
                                        this.setState((state) =>
                                            update(state, {
                                                formData: { zustimmung: { $set: zustimmung } }
                                            })
                                        )
                                    }
                                >
                                    <Checkbox name="above_18" value="above_18">
                                        Ich bin über 18 Jahre alt.
                                    </Checkbox>
                                    <Checkbox name="approved_charter" value="approved_charter">
                                        Ich habe die{" "}
                                        <a
                                            data-native
                                            target={"_blank"}
                                            rel={"noopener noreferrer"}
                                            href="/static/Queer-Augsburg_Satzung.pdf"
                                        >
                                            Satzung
                                        </a>{" "}
                                        gelesen und stimme ihr zu.
                                    </Checkbox>
                                    <Checkbox name="approved_privacy" value="approved_privacy">
                                        Ich habe die{" "}
                                        <a target={"_blank"} href="/impressum">
                                            Datenschutzerklärung
                                        </a>{" "}
                                        gelesen und stimme ihr zu.
                                    </Checkbox>
                                </CheckboxGroup>
                            </div>
                            <div>
                                <Button
                                    onClick={this.saveData}
                                    variant="primary"
                                    type="submit"
                                    disabled={
                                        this.state.formData.zustimmung?.filter(Boolean).length !== 3
                                    }
                                >
                                    Speichern
                                </Button>
                            </div>
                            {this.state.responseMessageType !== null && (
                                <Message type={this.state.responseMessageType}>
                                    {this.state.responseMessage}
                                </Message>
                            )}
                        </div>
                    </form>
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

export default MyData;
