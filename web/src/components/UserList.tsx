import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import AutoSizer from "react-virtualized-auto-sizer";
//@ts-ignore
import SearchIcon from "@rsuite/icons/Search";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { Button, Input, InputGroup, SelectPicker } from "rsuite";
import { QaClient } from "../api";
import { Meeting } from "../apiTypes/Meeting";
import { User } from "../apiTypes/User";
import { G } from "../types";
import SingleUser from "./SingleUser";

interface UserListProps {
    readonly g: G;
    readonly qaClient: QaClient;
    readonly style?: CSSProperties;
}
interface UserListState {
    readonly users: User[];
    readonly userCount: number;
    readonly meetings: Meeting[];
    readonly searchTerm: string;
    readonly sortBy: string;
    readonly sortOrder: string;
}
export default class UserList extends Component<UserListProps, UserListState> {
    moreLoading = false;
    constructor(props: UserListProps) {
        super(props);
        this.state = {
            users: [],
            userCount: 0,
            meetings: [],
            searchTerm: "",
            sortBy: "start_time_ms",
            sortOrder: "desc"
        };
    }
    componentDidMount = async () => {
        await this.loadData();
    };

    loadData = async () => {
        const res = await this.props.qaClient.get_users(
            0,
            null,
            this.state.searchTerm || null,
            this.state.sortBy,
            this.state.sortOrder
        );
        const { meetings } = await this.props.qaClient.get_meetings(0, null);
        this.setState({ users: res.users, userCount: res.total_count, meetings });
    };

    loadMoreUsers = async (_startIndex: number, _limit: number) => {
        /*
        if (this.moreLoading === false) {
            this.moreLoading = true;

            const res = await this.props.qaClient.get_users(startIndex, limit);
            const newUsers = res.users;
            this.moreLoading = false;

            this.setState(({ users }) => {
                for (let i = 0; i < newUsers.length; i++) {
                    users[startIndex + i] = newUsers[i];
                }
                return { users };
            });
        }*/
    };

    reloadUserList = async () => {
        const res = await this.props.qaClient.get_users(
            0,
            null,
            this.state.searchTerm || null,
            this.state.sortBy,
            this.state.sortOrder
        );
        this.setState({ users: res.users, userCount: res.total_count });
    };

    handleSearchSubmit = async () => {
        await this.loadData();
    };

    handleSortChange = async (sortBy: string, sortOrder: string) => {
        this.setState({ sortBy, sortOrder }, async () => {
            await this.loadData();
        });
    };

    render = () => {
        return (
            <div className="UserList" style={this.props.style}>
                <div className="p-4 border-b border-gray-200 space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                            <InputGroup inside>
                                <Input
                                    placeholder="Suche nach Name, E-Mail oder Institution..."
                                    value={this.state.searchTerm}
                                    onChange={(value) => this.setState({ searchTerm: value })}
                                    onPressEnter={this.handleSearchSubmit}
                                />
                                <InputGroup.Addon>
                                    <SearchIcon />
                                </InputGroup.Addon>
                            </InputGroup>
                        </div>
                        <div className="w-24">
                            <Button
                                appearance="primary"
                                onClick={this.handleSearchSubmit}
                                className="w-full"
                            >
                                Suchen
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <SelectPicker
                                label="Sortieren nach"
                                data={[
                                    { label: "Startdatum", value: "start_time_ms" },
                                    { label: "Vorname", value: "name.first_name" },
                                    { label: "Nachname", value: "name.last_name" },
                                    { label: "E-Mail", value: "email" },
                                    { label: "Institution", value: "institution" },
                                    { label: "Status", value: "status" }
                                ]}
                                value={this.state.sortBy}
                                onChange={(value) =>
                                    this.handleSortChange(
                                        value || "start_time_ms",
                                        this.state.sortOrder
                                    )
                                }
                                cleanable={false}
                                searchable={false}
                                className="w-full"
                            />
                        </div>
                        <div className="flex-1">
                            <SelectPicker
                                label="Reihenfolge"
                                data={[
                                    { label: "Absteigend", value: "desc" },
                                    { label: "Aufsteigend", value: "asc" }
                                ]}
                                value={this.state.sortOrder}
                                onChange={(value) =>
                                    this.handleSortChange(this.state.sortBy, value || "desc")
                                }
                                cleanable={false}
                                searchable={false}
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            isItemLoaded={(index) => this.state.users[index] !== undefined}
                            itemCount={this.state.userCount}
                            loadMoreItems={this.loadMoreUsers}
                            threshold={20}
                            minimumBatchSize={10}
                        >
                            {({ onItemsRendered, ref }) => (
                                <FixedSizeList
                                    itemSize={270}
                                    height={height - 120}
                                    itemCount={this.state.userCount}
                                    width={width}
                                    onItemsRendered={onItemsRendered}
                                    ref={ref}
                                    // without this the context menu cannot be positioned fixed
                                    // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                    style={{ willChange: "none" }}
                                >
                                    {({ index, style }: { index: any; style: CSSProperties }) => {
                                        const currentItem = this.state.users[index];
                                        if (!currentItem) {
                                            return <div style={style}>Loading...</div>;
                                        }

                                        return (
                                            <div style={style}>
                                                <SingleUser
                                                    reloadUserList={this.reloadUserList}
                                                    g={this.props.g}
                                                    user={currentItem}
                                                    meetings={this.state.meetings}
                                                />
                                            </div>
                                        );
                                    }}
                                </FixedSizeList>
                            )}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
