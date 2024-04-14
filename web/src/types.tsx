import { QaClient } from "./api";
import { CommonMeetingTag } from "./apiTypes/CommonMeetingTag";
import { QueerMeetingTag } from "./apiTypes/QueerMeetingTag";
import { User } from "./apiTypes/User";

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

export const commonTags: CommonMeetingTag[] = [
    "Kultur",
    "Party",
    "Orga",
    "Sport",
    "Education",
    "Meet",
    "Students",
    "Marketing",
    "Cinema",
    "Talks",
    "Open",
    "Explores",
    "Connect",
    "Ostqueer",
    "Queermas"
];

export const queerTags: QueerMeetingTag[] = [
    "Everyone",
    "Queer",
    "Gay",
    "Lesbian",
    "Trans",
    "Bi",
    "Asexual",
    "Aromantic",
    "Inter",
    "Poly",
    "Pan"
];

export const memberShipStatuses = ["Pending", "Approved", "Rejected", "Left", "Expelled"];
