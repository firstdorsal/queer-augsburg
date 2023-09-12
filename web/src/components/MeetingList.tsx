import { Component } from "preact";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";
import { FixedSizeList } from "react-window";
import { Meeting } from "../apiTypes/Meeting";
import { QaClient } from "../api";
import SingleMeeting from "./SingleMeeting";
import { CSSProperties } from "preact/compat";

interface MeetingListProps {
    readonly qaClient: QaClient;
}
interface MeetingListState {
    readonly meetings: Meeting[];
    readonly meetingCount: number;
}
export default class MeetingList extends Component<MeetingListProps, MeetingListState> {
    moreLoading = false;

    constructor(props: MeetingListProps) {
        super(props);
        this.state = {
            meetings: [],
            meetingCount: 0
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    loadData = async () => {
        const res = await this.props.qaClient.get_meetings();
        this.setState({ meetings: res.meetings, meetingCount: res.all_meetings_count });
    };

    loadMoreMeetings = async (startIndex: number, limit: number) => {
        if (this.moreLoading === false) {
            this.moreLoading = true;

            const res = await this.props.qaClient.get_meetings(startIndex, limit);
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

    render = () => {
        return (
            <div className="MeetingList">
                <AutoSizer>
                    {({ height, width }) => (
                        <InfiniteLoader
                            isItemLoaded={index => this.state.meetings[index] !== undefined}
                            itemCount={this.state.meetingCount}
                            loadMoreItems={this.loadMoreMeetings}
                            threshold={20}
                            minimumBatchSize={10}
                        >
                            {({ onItemsRendered, ref }) => (
                                <FixedSizeList
                                    itemSize={400}
                                    height={height}
                                    itemCount={this.state.meetingCount}
                                    width={width}
                                    onItemsRendered={onItemsRendered}
                                    ref={ref}
                                    // without this the context menu cannot be positioned fixed
                                    // https://stackoverflow.com/questions/2637058/position-fixed-doesnt-work-when-using-webkit-transform
                                    style={{ willChange: "none" }}
                                >
                                    {({ index, style }: { index: any; style: CSSProperties }) => {
                                        const currentItem = this.state.meetings[index];
                                        if (!currentItem) {
                                            return <div style={style}>Loading...</div>;
                                        }

                                        return (
                                            <SingleMeeting
                                                style={style}
                                                meeting={currentItem}
                                            ></SingleMeeting>
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
