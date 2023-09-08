export interface Event {
    id: string;
    authority: string;
    ageRestriction: number;
    name: string;
    time: number;
    location: EventLocation;
    description: string;
    price: EventPrice;
    triggerWarning: string;
    attendance: number;
    rating: number;
    tags: EventTags;
}

export interface EventTags {
    freeform: string[];
    common: EventTag[];
    queer: QueerEventTag[];
}

export enum QueerEventTag {
    Everyone = "Everyone",
    Queer = "Queer",
    Gay = "Gay",
    Lesbian = "Lesbian",
    Trans = "Trans",
    Bi = "Bi",
    Asexual = "Asexual",
    Aromantic = "Aromantic",
    Inter = "Inter",
    Poly = "Poly"
}

export enum EventTag {
    Kultur = "Kultur",
    Party = "Party",
    Orga = "Orga",
    Sport = "Sport",
    Education = "Education",
    Meet = "Meet",
    Students = "Students",
    Marketing = "Marketing",
    Cinema = "Cinema",
    Talks = "Talks",
    Open = "Open",
    Explores = "Explores",
    Connect = "Connect",
    Ostqueer = "Ostqueer"
}

export interface EventLocation {
    name: string;
    lat: number;
    long: number;
}

export interface EventPrice {
    type: "free" | "fixed";
    range: [number, number];
}
