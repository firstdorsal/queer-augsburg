import { Component } from "preact";
import { IoGlobeOutline } from "react-icons/io5";
import { Button } from "rsuite";
import { Meeting } from "../apiTypes/Meeting";
import { OnlineMeeting } from "../apiTypes/OnlineMeeting";
import {
    MEMBERS_ONLY_LINK_TEXT,
    maySeeMembersOnlyLinks,
    onlineLabel,
    safeHttpUrl
} from "../places";
import { G } from "../types";

interface OnlineMeetingInfoProps {
    readonly meeting: Meeting;
    readonly online: OnlineMeeting;
    readonly g: G;
}

interface OnlineMeetingInfoState {
    /** Members-only link fetched on demand; never cached with the meeting list. */
    readonly fetchedUrl: string | null;
    readonly loading: boolean;
    /** Why the last request did not yield a link, shown instead of the button. */
    readonly problem: string | null;
}

const problemText = (status: number): string =>
    status === 401
        ? "Bitte anmelden, um den Link zu sehen."
        : status === 403
          ? "Nur verifizierte Mitglieder dürfen diesen Link sehen."
          : status === 404
            ? "Link nicht mehr verfügbar"
            : "Link konnte nicht geladen werden.";

/** "Online · Zoom" plus the link as far as the viewer may see it; below the place for hybrid
 * meetings.
 * Render with `key={meeting._id}` so a fetched link never sticks to another meeting. */
export default class OnlineMeetingInfo extends Component<
    OnlineMeetingInfoProps,
    OnlineMeetingInfoState
> {
    private unmounted = false;

    constructor(props: OnlineMeetingInfoProps) {
        super(props);
        this.state = { fetchedUrl: null, loading: false, problem: null };
    }

    componentDidUpdate = (previous: OnlineMeetingInfoProps) => {
        // Edited meeting or another account: the fetched link may no longer apply.
        if (previous.online !== this.props.online || previous.g.account !== this.props.g.account) {
            this.setState({ fetchedUrl: null, problem: null });
        }
    };

    componentWillUnmount = () => {
        this.unmounted = true;
    };

    showLink = async (event: Event) => {
        // The surrounding meeting card reacts to clicks.
        event.stopPropagation();
        const qaClient = this.props.g.qaClient;
        if (!qaClient || this.state.loading) return;
        this.setState({ loading: true, problem: null });
        const result = await qaClient.get_meeting_link(this.props.meeting._id);
        if (this.unmounted) return;
        if (!result.ok) {
            this.setState({ loading: false, problem: problemText(result.status) });
            return;
        }
        const url = safeHttpUrl(result.url);
        this.setState({
            loading: false,
            fetchedUrl: url,
            problem: url ? null : "Noch kein Link hinterlegt."
        });
    };

    renderLink = (url: string) => (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => event.stopPropagation()}
        >
            Link öffnen
        </a>
    );

    renderLinkPart = () => {
        const { online, g } = this.props;
        const publicUrl = safeHttpUrl(online.url);
        if (publicUrl) return this.renderLink(publicUrl);
        if (!online.url_hidden) return null;
        if (this.state.fetchedUrl) return this.renderLink(this.state.fetchedUrl);
        if (!maySeeMembersOnlyLinks(g.account)) {
            return <span className="opacity-80">{MEMBERS_ONLY_LINK_TEXT}</span>;
        }
        return (
            <>
                <Button
                    appearance="link"
                    size="xs"
                    className="p-0 align-baseline"
                    onClick={this.showLink}
                    loading={this.state.loading}
                >
                    {this.state.problem ? "Erneut versuchen" : "Link anzeigen"}
                </Button>
                {this.state.problem && <span className="opacity-80"> ({this.state.problem})</span>}
            </>
        );
    };

    render = () => {
        const linkPart = this.renderLinkPart();
        return (
            <div className="flex items-center" title="Online">
                <IoGlobeOutline />
                <span className="InfoText">
                    {onlineLabel(this.props.online)}
                    {linkPart && <> · {linkPart}</>}
                </span>
            </div>
        );
    };
}
