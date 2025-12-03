import { Component } from "preact";
import AdminCreateMember from "../components/AdminCreateMember";
import AdminSendEmail from "../components/AdminSendEmail";
import UserList from "../components/UserList";
import { G } from "../types";

interface AdminProps {
    readonly g: G;
}
interface AdminState {
    activeTab?: string;
}
export default class Admin extends Component<AdminProps, AdminState> {
    constructor(props: AdminProps) {
        super(props);

        this.state = {
            activeTab: ""
        };
    }

    componentDidMount = () => {
        this.setTab();
    };

    setTab = () => {
        const hasGetUsers = this.props.g.account?.capabilities?.includes("GetUsers");
        const hasCreateMember = this.props.g.account?.capabilities?.includes("CreateMember");
        const hasSendMassEmail = this.props.g.account?.capabilities?.includes("SendMassEmail");

        // Set default tab based on capabilities
        if (hasGetUsers) {
            this.setState({ activeTab: "users" });
        } else if (hasCreateMember) {
            this.setState({ activeTab: "create" });
        } else if (hasSendMassEmail) {
            this.setState({ activeTab: "email" });
        } else {
            this.setState({ activeTab: "" });
        }
    };

    componentDidUpdate(
        previousProps: Readonly<AdminProps>,
        _previousState: Readonly<AdminState>,
        _snapshot: any
    ): void {
        if (previousProps.g.account !== this.props.g.account) {
            this.setTab();
        }
    }

    handleTabChange = (tab: string) => {
        this.setState({ activeTab: tab });
    };

    render = () => {
        if (this.props.g.qaClient === null) {
            return <div></div>;
        }

        const hasGetUsers = this.props.g.account?.capabilities?.includes("GetUsers");
        const hasCreateMember = this.props.g.account?.capabilities?.includes("CreateMember");
        const hasSendMassEmail = this.props.g.account?.capabilities?.includes("SendMassEmail");

        // Don't show anything if user has no admin capabilities
        if (!hasGetUsers && !hasCreateMember && !hasSendMassEmail) {
            return (
                <div className="p-4 text-center text-gray-500">
                    Keine Berechtigung für Admin-Funktionen
                </div>
            );
        }

        return (
            <div className="Admin flex h-full flex-col">
                {/* Sub Navigation */}
                <div className="border-b">
                    <nav className="flex space-x-2 px-2 py-1">
                        {hasGetUsers && (
                            <button
                                onClick={() => this.handleTabChange("users")}
                                className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                                    this.state.activeTab === "users"
                                        ? "border-blue-500 text-blue-400"
                                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                }`}
                            >
                                Mitglieder verwalten
                            </button>
                        )}
                        {hasCreateMember && (
                            <button
                                onClick={() => this.handleTabChange("create")}
                                className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                                    this.state.activeTab === "create"
                                        ? "text-blue-00 border-blue-400"
                                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                }`}
                            >
                                Mitglied erstellen
                            </button>
                        )}
                        {hasSendMassEmail && (
                            <button
                                onClick={() => this.handleTabChange("email")}
                                className={`border-b-2 px-1 py-2 text-sm font-medium transition-colors ${
                                    this.state.activeTab === "email"
                                        ? "border-blue-500 text-blue-400"
                                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                }`}
                            >
                                E-Mail senden
                            </button>
                        )}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {this.state.activeTab === "users" && hasGetUsers && (
                        <>
                            <div className="h-full">
                                <UserList g={this.props.g} qaClient={this.props.g.qaClient} />
                            </div>
                        </>
                    )}
                    {this.state.activeTab === "create" && hasCreateMember && (
                        <div className="p-2">
                            <AdminCreateMember g={this.props.g} />
                        </div>
                    )}
                    {this.state.activeTab === "email" && hasSendMassEmail && (
                        <div className="h-full overflow-auto">
                            <AdminSendEmail g={this.props.g} />
                        </div>
                    )}
                </div>
            </div>
        );
    };
}
