import { QaClient } from "./api";

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
    admin: boolean | null;
    ref: string | null;
    meetingId: string | null;
}

export const commonTags = [
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
    "Ostqueer"
];

export const queerTags = [
    "Everyone",
    "Queer",
    "Gay",
    "Lesbian",
    "Trans",
    "Bi",
    "Asexual",
    "Aromantic",
    "Inter",
    "Poly"
];

export const memberShipStatuses = ["Pending", "Approved", "Rejected", "Left", "Expelled"];
