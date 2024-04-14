import { Component, createRef } from "preact";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";
import { VariableSizeList } from "react-window";
import { Meeting } from "../apiTypes/Meeting";
import { QaClient } from "../api";
import SingleMeeting from "./SingleMeeting";
import { CSSProperties, Ref } from "preact/compat";
import { G } from "../types";
import { MeetingTypeQuery } from "../apiTypes/MeetingTypeQuery";
import { Button } from "rsuite";
import EditMeeting from "./EditMeeting";
import { defaultMeeting } from "../utils";
import update from "immutability-helper";
interface MeetingStyle {
    expanded: boolean;
}

interface MeetingListProps {
    readonly type: MeetingTypeQuery;
    readonly g: G;
    readonly qaClient: QaClient;
}
interface MeetingListState {
    readonly meetings: Meeting[];
    readonly meetingsStyle: MeetingStyle[];
    readonly meetingCount: number;
    readonly newMeeting: boolean;
}
export default class MeetingList extends Component<MeetingListProps, MeetingListState> {
    moreLoading = false;
    listRef: Ref<InfiniteLoader> | null = createRef();

    constructor(props: MeetingListProps) {
        super(props);
        this.state = {
            meetings: [],
            meetingCount: 0,
            newMeeting: false,
            meetingsStyle: []
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    componentDidUpdate = async (prevProps: MeetingListProps) => {
        if (
            prevProps.g.meetingId !== this.props.g.meetingId ||
            prevProps.type !== this.props.type
        ) {
            await this.loadData();
        }
    };

    loadData = async () => {
        if (this.props.g.meetingId) {
            const res = await this.props.qaClient.get_meetings(0, null, this.props.type);
            const meetings = res.meetings;

            const meetingIndex = (() => {
                let i = 0;
                while (i < meetings.length) {
                    if (meetings[i]._id === this.props.g.meetingId) {
                        return i;
                    }
                    i++;
                }
            })();

            this.setState(
                {
                    meetings,
                    meetingCount: res.selected_total_count,
                    meetingsStyle: meetings.map(() => {
                        return {
                            expanded: false
                        };
                    })
                },
                () => {
                    //@ts-ignore
                    this.listRef?.current?._listRef?.scrollToItem(meetingIndex ?? 0, "center");
                }
            );

            return;
        }

        const res = await this.props.qaClient.get_meetings(0, 10, this.props.type);
        this.setState({
            meetings: res.meetings,
            meetingCount: res.selected_total_count,
            meetingsStyle: res.meetings.map(() => {
                return {
                    expanded: false
                };
            })
        });
    };

    loadMoreMeetings = async (startIndex: number, limit: number) => {
        if (this.moreLoading === false) {
            this.moreLoading = true;

            const res = await this.props.qaClient.get_meetings(startIndex, limit, this.props.type);
            const newMeetings = res.meetings;
            this.moreLoading = false;

            this.setState(({ meetings, meetingsStyle }) => {
                for (let i = 0; i < newMeetings.length; i++) {
                    meetings[startIndex + i] = newMeetings[i];
                    meetingsStyle[startIndex + i] = {
                        expanded: false
                    };
                }
                return { meetings, meetingsStyle };
            });
        }
    };

    reloadMeetingList = async () => {
        const res = await this.props.qaClient.get_meetings(0, null, this.props.type);
        this.setState({ meetings: res.meetings, meetingCount: res.selected_total_count });
    };

    getItemHeight = (index: number) => {
        if (this.state.meetingsStyle[index]?.expanded) {
            return 750;
        } else {
            return 390;
        }
    };

    switchExpand = (index: number) => {
        this.setState(
            state => {
                return update(state, {
                    meetingsStyle: {
                        [index]: {
                            expanded: {
                                $set: !state.meetingsStyle[index]?.expanded
                            }
                        }
                    }
                });
            },
            () => {
                //@ts-ignore
                this.listRef?.current?._listRef?.resetAfterIndex(index);
            }
        );
    };

    render = () => {
        return (
            <div className="MeetingList">
                {this.props.g.account?.capabilities?.includes(`UpdateMeetings`) && (
                    <div className={"NewMeeting"}>
                        <Button
                            appearance="primary"
                            onClick={() => {
                                this.setState({ newMeeting: true });
                            }}
                        >
                            Neues Treffen
                        </Button>
                        {this.state.newMeeting && (
                            <EditMeeting
                                g={this.props.g}
                                reloadMeetingList={this.reloadMeetingList}
                                changEditing={(editing: boolean) => {
                                    this.setState({ newMeeting: editing });
                                }}
                                editing={this.state.newMeeting}
                                meeting={defaultMeeting}
                                type={this.props.type}
                                newMeeting={true}
                            />
                        )}
                    </div>
                )}
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            ref={this.listRef}
                            isItemLoaded={index => this.state.meetings[index] !== undefined}
                            itemCount={this.state.meetingCount}
                            loadMoreItems={this.loadMoreMeetings}
                            threshold={20}
                            minimumBatchSize={10}
                        >
                            {({ onItemsRendered, ref }) => {
                                return (
                                    <VariableSizeList
                                        itemSize={this.getItemHeight}
                                        height={height}
                                        itemCount={this.state.meetingCount}
                                        width={width}
                                        onItemsRendered={onItemsRendered}
                                        ref={ref}
                                        // without this the context menu cannot be positioned fixed
                                        // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                        style={{ willChange: "none" }}
                                    >
                                        {({
                                            index,
                                            style
                                        }: {
                                            index: any;
                                            style: CSSProperties;
                                        }) => {
                                            const currentItem = this.state.meetings[index];
                                            if (!currentItem) {
                                                return <div style={style}></div>;
                                            }

                                            return (
                                                <div
                                                    style={{
                                                        ...style,
                                                        //@ts-ignore
                                                        top: `${parseFloat(style.top) + 50}px`
                                                    }}
                                                >
                                                    <SingleMeeting
                                                        switchExpand={this.switchExpand}
                                                        index={index}
                                                        expanded={
                                                            this.state.meetingsStyle[index]
                                                                ?.expanded
                                                        }
                                                        g={this.props.g}
                                                        meeting={currentItem}
                                                        reloadMeetingList={this.reloadMeetingList}
                                                    />
                                                </div>
                                            );
                                        }}
                                    </VariableSizeList>
                                );
                            }}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
