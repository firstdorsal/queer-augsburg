import { QaClient } from "./api";

export interface UiConfig {
    interosseaServerAddress: string;
    interosseaWebAddress: string;
    qaServerAddress: string;
    skipInterossea: boolean;
}

export interface G {
    uiConfig: UiConfig | null;
    qaClient: QaClient | null;
    loggedIn: boolean;
    admin: boolean;
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
