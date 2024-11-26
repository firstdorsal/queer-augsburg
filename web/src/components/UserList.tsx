import { Component } from "preact";
import { CSSProperties } from "preact/compat";
import AutoSizer from "react-virtualized-auto-sizer";
import { FixedSizeList } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
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
}
export default class UserList extends Component<UserListProps, UserListState> {
    moreLoading = false;
    constructor(props: UserListProps) {
        super(props);
        this.state = {
            users: [],
            userCount: 0,
            meetings: []
        };
    }
    componentDidMount = async () => {
        await this.loadData();
    };

    loadData = async () => {
        const res = await this.props.qaClient.get_users(0, null);
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
        const res = await this.props.qaClient.get_users(0, null);
        this.setState({ users: res.users, userCount: res.total_count });
    };

    render = () => {
        return (
            <div className="UserList" style={this.props.style}>
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
                                    height={height}
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
