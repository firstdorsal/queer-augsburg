import { InterosseaClient } from "@firstdorsal/interossea-client";
import { Meeting } from "./apiTypes/Meeting";
import { GetMeetingsResponseBody } from "./apiTypes/GetMeetingsResponseBody";
import { User } from "./apiTypes/User";
import { MeetingTypeQuery } from "./apiTypes/MeetingTypeQuery";
import { SubmittedMember } from "./apiTypes/SubmittedMember";
import { GetUsersResponseBody } from "./apiTypes/GetUsersResponseBody";

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

    get_meetings = async (
        from_index: number,
        limit: number | null,
        meeting_type: MeetingTypeQuery = "All"
    ) => {
        const url = `${this.qaEndpoint}/api/get_meetings/?i=${from_index}${
            limit === null ? "" : "&l=" + limit
        }&t=${meeting_type}`;

        const res = await fetch(url, {
            credentials: "include"
        });
        const meetings: GetMeetingsResponseBody = await res.json();
        return meetings;
    };

    get_users = async (from_index = 0, limit = 10) => {
        const res = await fetch(`${this.qaEndpoint}/api/get_users/?i=${from_index}&l=${limit}`, {
            credentials: "include"
        });
        const users: GetUsersResponseBody = await res.json();
        return users;
    };

    update_meeting = async (meeting: Meeting) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_meeting/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ meeting })
        });
        const updated_meeting: Meeting = await res.json();
        return updated_meeting;
    };

    delete_meeting = async (meeting: Meeting) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_meeting/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ meeting, delete: true })
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

    update_own_member_data = async (submitted_member: SubmittedMember) => {
        const res = await fetch(`${this.qaEndpoint}/api/update_own_member_data/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ member: submitted_member })
        });
        const success = res.status === 200;
        return success;
    };

    accept_member_application = async (user_id: string) => {
        const res = await fetch(`${this.qaEndpoint}/api/accept_member_application/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({ user_id })
        });
        const success = res.status === 200;
        return success;
    };
}
