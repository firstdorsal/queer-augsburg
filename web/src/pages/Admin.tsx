import { Component } from "preact";
import AdminCreateMember from "../components/AdminCreateMember";
import UserList from "../components/UserList";
import UserStats from "../components/UserStats";
import { G } from "../types";

interface AdminProps {
    readonly g: G;
}
interface AdminState {
    activeTab: string;
}
export default class Admin extends Component<AdminProps, AdminState> {
    constructor(props: AdminProps) {
        super(props);

        // Determine default tab based on user capabilities
        let defaultTab = "";
        if (this.props.g.account?.capabilities?.includes("GetUsers")) {
            defaultTab = "users";
        } else if (this.props.g.account?.capabilities?.includes("CreateMember")) {
            defaultTab = "create";
        }

        this.state = {
            activeTab: defaultTab
        };
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

        // Don't show anything if user has no admin capabilities
        if (!hasGetUsers && !hasCreateMember) {
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
                                        ? "border-blue-500 text-blue-600"
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
                                        ? "border-blue-500 text-blue-600"
                                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                                }`}
                            >
                                Mitglied erstellen
                            </button>
                        )}
                    </nav>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-hidden">
                    {this.state.activeTab === "users" && hasGetUsers && (
                        <>
                            <div className="border-b">
                                <h1 className="mb-4 text-2xl font-bold">Mitglieder</h1>
                                <UserStats g={this.props.g} />
                            </div>
                            <div className="h-full">
                                <UserList
                                    style={{ height: "calc(100% - 120px)" }}
                                    g={this.props.g}
                                    qaClient={this.props.g.qaClient}
                                />
                            </div>
                        </>
                    )}
                    {this.state.activeTab === "create" && hasCreateMember && (
                        <div className="p-2">
                            <AdminCreateMember g={this.props.g} />
                        </div>
                    )}
                </div>
            </div>
        );
    };
}
