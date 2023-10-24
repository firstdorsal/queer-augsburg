import { InterosseaClient } from "@firstdorsal/interossea-client";
import { Meeting } from "./apiTypes/Meeting";
import { GetMeetingsResponseBody } from "./apiTypes/GetMeetingsResponseBody";
import { User } from "./apiTypes/User";
import { MeetingTypeQuery } from "./apiTypes/MeetingTypeQuery";
import { SubmittedMember } from "./apiTypes/SubmittedMember";
import { GetUsersResponseBody } from "./apiTypes/GetUsersResponseBody";
import { MembershipStatus } from "./apiTypes/MembershipStatus";

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
        meeting_type: MeetingTypeQuery = "Active"
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

    get_users = async (from_index: number, limit: number | null) => {
        const url = `${this.qaEndpoint}/api/get_users/?i=${from_index}${
            limit === null ? "" : "&l=" + limit
        }`;

        const res = await fetch(url, {
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

    update_member_status = async (
        user_id: string,
        new_status: MembershipStatus,
        send_mail: boolean,
        update_reason?: string
    ) => {
        return fetch(`${this.qaEndpoint}/api/update_member_status/`, {
            method: "POST",
            credentials: "include",
            body: JSON.stringify({
                user_id,
                new_status,
                send_mail,
                update_reason: update_reason?.length ? update_reason : null
            })
        });
    };
}
