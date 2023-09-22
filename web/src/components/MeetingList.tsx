import { Component, createRef } from "preact";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";
import { FixedSizeList } from "react-window";
import { Meeting } from "../apiTypes/Meeting";
import { QaClient } from "../api";
import SingleMeeting from "./SingleMeeting";
import { CSSProperties, Ref } from "preact/compat";
import { G } from "../types";
import { MeetingTypeQuery } from "../apiTypes/MeetingTypeQuery";
import { Button } from "rsuite";
import EditMeeting from "./EditMeeting";
import { defaultMeeting } from "../utils";

interface MeetingListProps {
    readonly type: MeetingTypeQuery;
    readonly g: G;
    readonly qaClient: QaClient;
}
interface MeetingListState {
    readonly meetings: Meeting[];
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
            newMeeting: false
        };
    }

    componentDidMount = async () => {
        await this.loadData();
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

            this.setState({ meetings, meetingCount: res.selected_total_count }, () => {
                //@ts-ignore
                this.listRef?.current?._listRef?.scrollToItem(meetingIndex ?? 0, "center");
            });
            return;
        }

        const res = await this.props.qaClient.get_meetings(0, 10, this.props.type);
        this.setState({ meetings: res.meetings, meetingCount: res.selected_total_count });
    };

    loadMoreMeetings = async (startIndex: number, limit: number) => {
        if (this.moreLoading === false) {
            this.moreLoading = true;

            const res = await this.props.qaClient.get_meetings(startIndex, limit, this.props.type);
            const newMeetings = res.meetings;
            this.moreLoading = false;

            this.setState(({ meetings }) => {
                for (let i = 0; i < newMeetings.length; i++) {
                    meetings[startIndex + i] = newMeetings[i];
                }
                return { meetings };
            });
        }
    };

    reloadMeetingList = async () => {
        const res = await this.props.qaClient.get_meetings(0, null, this.props.type);
        this.setState({ meetings: res.meetings, meetingCount: res.selected_total_count });
    };

    render = () => {
        return (
            <div className="MeetingList">
                {this.props.g.admin && (
                    <div className={"NewMeeting"}>
                        <Button
                            appearance="primary"
                            onClick={() => {
                                this.setState({ newMeeting: true });
                            }}
                        >
                            Neues Treffen
                        </Button>
                        <EditMeeting
                            g={this.props.g}
                            reloadMeetingList={this.reloadMeetingList}
                            changEditing={(editing: boolean) => {
                                this.setState({ newMeeting: editing });
                            }}
                            editing={this.state.newMeeting}
                            meeting={defaultMeeting}
                            newMeeting={true}
                        />
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
                                    <FixedSizeList
                                        itemSize={420}
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
                                                <div style={style}>
                                                    <SingleMeeting
                                                        g={this.props.g}
                                                        meeting={currentItem}
                                                        reloadMeetingList={this.reloadMeetingList}
                                                    />
                                                </div>
                                            );
                                        }}
                                    </FixedSizeList>
                                );
                            }}
                        </InfiniteLoader>
                    )}
                </AutoSizer>
            </div>
        );
    };
}
