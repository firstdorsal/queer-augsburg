import type { QaClient } from "./api";
import type { CommonMeetingTag } from "./apiTypes/CommonMeetingTag";
import type { QueerMeetingTag } from "./apiTypes/QueerMeetingTag";
import type { User } from "./apiTypes/User";

export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    qaServerAddress: string;
    qaWebAddress: string;
    skipInterossea: boolean;
}

export interface G {
    uiConfig: UiConfig | null;
    qaClient: QaClient | null;
    loggedIn: boolean | null;
    account: User | null;
    ref: string | null;
    meetingId: string | null;
}

// Records instead of arrays: a tag added to the Rust enum (and thus to the ts-rs union)
// but missing here is a compile error, so the editor and the bulk-import prompt stay complete.
const commonTagRecord: Record<CommonMeetingTag, true> = {
    Kultur: true,
    Party: true,
    Orga: true,
    Sport: true,
    Education: true,
    Meet: true,
    Students: true,
    Marketing: true,
    Cinema: true,
    Talks: true,
    Open: true,
    Explores: true,
    Connect: true,
    Ostqueer: true,
    Queermas: true
};
export const commonTags = Object.keys(commonTagRecord) as CommonMeetingTag[];

const queerTagRecord: Record<QueerMeetingTag, true> = {
    Everyone: true,
    Queer: true,
    Gay: true,
    Lesbian: true,
    Trans: true,
    Bi: true,
    Asexual: true,
    Aromantic: true,
    Inter: true,
    Poly: true,
    Pan: true
};
export const queerTags = Object.keys(queerTagRecord) as QueerMeetingTag[];

export const memberShipStatuses = ["Pending", "Approved", "Rejected", "Left", "Expelled"];
