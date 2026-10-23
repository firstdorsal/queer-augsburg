import { Component, createRef } from "preact";
import AutoSizer from "react-virtualized-auto-sizer";
import InfiniteLoader from "react-window-infinite-loader";
import { VariableSizeList } from "react-window";
import { Meeting } from "../apiTypes/Meeting";
import { QaClient } from "../api";
import SingleMeeting from "./SingleMeeting";
import { CSSProperties, JSX, Ref, forwardRef } from "preact/compat";
import { G } from "../types";
import { MeetingTypeQuery } from "../apiTypes/MeetingTypeQuery";
import { Button, SelectPicker } from "rsuite";
import BulkImportMeetings from "./BulkImportMeetings";
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
    /** Editors switch between active and planned meetings; bulk-created meetings switch to
     * the planned ones, where they are reviewed. */
    readonly onTypeChange: (type: MeetingTypeQuery) => void;
}

const MEETING_TYPES: { label: string; value: MeetingTypeQuery }[] = [
    { label: "Aktive Treffen", value: "Active" },
    { label: "Geplante Treffen", value: "Planned" }
];

/** The scrolled content of the list, with room after the last meeting for the editors'
 * toolbar (`--toolbar-clearance`, see index.scss). */
const ListContent = forwardRef<HTMLDivElement, JSX.HTMLAttributes<HTMLDivElement>>(
    (props, ref) => <div ref={ref} {...props} className="MeetingListContent" />
);
interface MeetingListState {
    readonly meetings: Meeting[];
    readonly meetingsStyle: MeetingStyle[];
    readonly meetingCount: number;
    readonly newMeeting: boolean;
    readonly bulkImport: boolean;
    /** Height of the editors' toolbar plus its distance to the bottom edge, in px. */
    readonly toolbarClearance: number;
}
export default class MeetingList extends Component<MeetingListProps, MeetingListState> {
    moreLoading = false;
    listRef: Ref<InfiniteLoader> | null = createRef();
    toolbarObserver: ResizeObserver | null = null;

    constructor(props: MeetingListProps) {
        super(props);
        this.state = {
            meetings: [],
            meetingCount: 0,
            newMeeting: false,
            bulkImport: false,
            meetingsStyle: [],
            toolbarClearance: 0
        };
    }

    componentDidMount = async () => {
        await this.loadData();
    };

    componentWillUnmount = () => {
        this.toolbarObserver?.disconnect();
    };

    /** Keeps `toolbarClearance` up to date while the toolbar is shown (it grows when its
     * buttons wrap or the text is zoomed). */
    observeToolbar = (toolbar: HTMLDivElement | null) => {
        this.toolbarObserver?.disconnect();
        this.toolbarObserver = null;
        if (!toolbar) {
            this.setState({ toolbarClearance: 0 });
            return;
        }
        const measure = () => {
            const clearance = Math.ceil(
                toolbar.offsetHeight + parseFloat(getComputedStyle(toolbar).bottom)
            );
            if (clearance !== this.state.toolbarClearance) {
                this.setState({ toolbarClearance: clearance });
            }
        };
        this.toolbarObserver = new ResizeObserver(measure);
        this.toolbarObserver.observe(toolbar);
    };

    componentDidUpdate = async (prevProps: MeetingListProps) => {
        if (
            prevProps.g.meetingId !== this.props.g.meetingId ||
            prevProps.type !== this.props.type
        ) {
            try {
                await this.loadData();
            } catch (error) {
                // The list keeps its previous content; nothing else can be done here.
                console.error("Loading the meeting list failed:", error);
            }
        }
    };

    /** Bulk-created meetings are planned: show that list, where they are reviewed. */
    onBulkCreated = async () => {
        if (this.props.type !== "Planned") {
            this.props.onTypeChange("Planned");
            return;
        }
        await this.reloadMeetingList();
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
        if (this.moreLoading) return;
        this.moreLoading = true;

        try {
            const res = await this.props.qaClient.get_meetings(startIndex, limit, this.props.type);
            const newMeetings = res.meetings;

            this.setState(
                ({ meetings, meetingsStyle }) => {
                    const updatedMeetings = [...meetings];
                    const updatedMeetingsStyle = [...meetingsStyle];
                    for (let i = 0; i < newMeetings.length; i++) {
                        updatedMeetings[startIndex + i] = newMeetings[i];
                        updatedMeetingsStyle[startIndex + i] = {
                            expanded: false
                        };
                    }
                    return { meetings: updatedMeetings, meetingsStyle: updatedMeetingsStyle };
                },
                () => {
                    this.moreLoading = false;
                }
            );
        } catch (e) {
            console.error("Failed to load more meetings:", e);
            this.moreLoading = false;
        }
    };

    reloadMeetingList = async (updatedMeeting?: Meeting, deleted?: boolean) => {
        if (updatedMeeting) {
            // Update or remove a single meeting in place
            this.setState(state => {
                if (deleted) {
                    // Remove the deleted meeting
                    const meetings = state.meetings.filter(m => m._id !== updatedMeeting._id);
                    return { meetings, meetingCount: state.meetingCount - 1 };
                } else {
                    // Update the meeting in place
                    const meetings = state.meetings.map(m =>
                        m._id === updatedMeeting._id ? updatedMeeting : m
                    );
                    return { meetings };
                }
            });
        } else {
            // Full refresh (fallback)
            const res = await this.props.qaClient.get_meetings(0, null, this.props.type);
            this.setState({ meetings: res.meetings, meetingCount: res.selected_total_count });
        }
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
            <div
                className="MeetingList"
                style={{ "--toolbar-clearance": `${this.state.toolbarClearance}px` }}
            >
                {this.props.g.account?.capabilities?.includes(`UpdateMeetings`) && (
                    <>
                    <div className="MeetingToolbar" ref={this.observeToolbar}>
                        <SelectPicker
                            data={MEETING_TYPES}
                            searchable={false}
                            cleanable={false}
                            value={this.props.type}
                            onChange={type => {
                                if (type !== null) this.props.onTypeChange(type);
                            }}
                            // Upwards unless the toolbar is too high up for the menu.
                            placement="autoVerticalEnd"
                        />
                        <div className="MeetingToolbarButtons">
                            <Button
                                appearance="primary"
                                onClick={() => {
                                    this.setState({ newMeeting: true });
                                }}
                            >
                                Neues Treffen
                            </Button>
                            <Button
                                appearance="primary"
                                onClick={() => {
                                    this.setState({ bulkImport: true });
                                }}
                            >
                                Mehrere Treffen (JSON)
                            </Button>
                        </div>
                    </div>
                        {this.state.bulkImport && (
                            <BulkImportMeetings
                                g={this.props.g}
                                onClose={() => {
                                    this.setState({ bulkImport: false });
                                }}
                                onCreated={this.onBulkCreated}
                            />
                        )}
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
                    </>
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
                                        innerElementType={ListContent}
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
