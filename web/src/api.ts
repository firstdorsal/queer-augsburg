import { InterosseaClient } from "@firstdorsal/interossea-client";
import { Meeting } from "./apiTypes/Meeting";
import { GetMeetingsResponseBody } from "./apiTypes/GetMeetingsResponseBody";
import { User } from "./apiTypes/User";
import { MeetingTypeQuery } from "./apiTypes/MeetingTypeQuery";

export class QaClient {
    interosseaClient: InterosseaClient;
    qaEndpoint: string;

    constructor(
        qaEndpoint: string,
        interosseaServerEndpoint: string,
        interosseaWebEndpoint: string,
        applicationName: string,
        skipInterossea: boolean = false
    ) {
        this.qaEndpoint = qaEndpoint;

        this.interosseaClient = new InterosseaClient(
            interosseaServerEndpoint,
            interosseaWebEndpoint,
            this.qaEndpoint,
            applicationName,
            skipInterossea
        );
    }

    init = async () => {
        await this.interosseaClient.init();
    };

    get_meetings = async (from_index = 0, limit = 10, meeting_type: MeetingTypeQuery = "All") => {
        const res = await fetch(
            `${this.qaEndpoint}/api/get_meetings/?i=${from_index}&l=${limit}&t=${meeting_type}`,
            {
                credentials: "include"
            }
        );
        const meetings: GetMeetingsResponseBody = await res.json();
        return meetings;
    };

    update_meeting = async (meeting: Meeting, remove?: boolean) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_meeting/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ meeting, ...(remove && { delete: true }) })
        });
        const success = res.status === 200;
        return success;
    };

    create_own_user = async () => {
        const res = await fetch(`${this.qaEndpoint}/api/create_own_user/`, {
            method: "POST",
            credentials: "include"
        });
        const success = res.status === 200;
        return success;
    };

    get_own_user = async () => {
        const res = await fetch(`${this.qaEndpoint}/api/get_own_user/`, {
            credentials: "include"
        });
        const user: User = await res.json();
        return user;
    };
}
