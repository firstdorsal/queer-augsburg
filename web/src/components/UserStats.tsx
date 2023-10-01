import { Component } from "preact";
import { G } from "../types";

interface UserStatsProps {
    readonly g: G;
}

interface UserStatsState {
    readonly total: number;
    readonly active: number;
    readonly support: number;
    readonly institutions: number;
    readonly natural_persons: number;
}

export default class UserStats extends Component<UserStatsProps, UserStatsState> {
    constructor(props: UserStatsProps) {
        super(props);
        this.state = {
            total: 0,
            active: 0,
            support: 0,
            institutions: 0,
            natural_persons: 0
        };
    }

    componentDidMount = async () => {
        if (this.props.g.qaClient === null) {
            return;
        }
        const all_users = await this.props.g.qaClient.get_users(0, null);

        let total = 0;
        let active = 0;
        let support = 0;
        let institutions = 0;
        let natural_persons = 0;

        for (const user of all_users.users) {
            const member = user.member;
            if (member) {
                total++;
                if (member.type === "Active") {
                    active++;
                }
                if (member.type === "Supporting") {
                    support++;
                }

                if (member.natural_person) {
                    natural_persons++;
                } else {
                    institutions++;
                }
            }
        }
        this.setState({
            total,
            active,
            support,
            institutions,
            natural_persons
        });
    };

    render = () => {
        return (
            <div className="UserStats">
                <div>Alle Mitglieder: {this.state?.total}</div>
                <div>Aktive Mitglieder: {this.state?.active}</div>
                <div>Fördermitglieder: {this.state?.support}</div>
                <div>Einrichtungen: {this.state?.institutions}</div>
                <div>Natürliche Personen: {this.state?.natural_persons}</div>
            </div>
        );
    };
}
