import { useToaster } from "rsuite";
import { Meeting } from "./apiTypes/Meeting";

export const withToasterHook = (Component: any) => {
    return (props: any) => {
        const toaster = useToaster();

        return <Component toaster={toaster} {...props} />;
    };
};

export const getUtcTimeStampNow = () => {
    // get the next day at 19:00 in utc seconds
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    return tomorrow.getTime();
};

export const defaultMeeting: Meeting = {
    _id: "",
    title: "",
    description: "",
    time: getUtcTimeStampNow() as unknown as bigint,
    attendance: null,
    authority: "",
    age_restriction: [0],
    location: { name: "", lat: 0, lon: 0 },
    price: [0],
    trigger_warning: null,
    rating: null,
    tags: { freeform: [], common: [], queer: ["Everyone"] },
    status: "Active",
    accessibility: null
};

export const prefersDarkMode = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return true;
    } else {
        return false;
    }
};

export interface Place {
    name: string;
    lat: number;
    lon: number;
}

export const commonPlaces: Place[] = [
    {
        name: "Thing",
        lat: 48.3653543,
        lon: 10.9017375
    },
    {
        name: "Elias Holl Platz",
        lat: 48.36875,
        lon: 10.89923
    },
    {
        name: "Ulrichseck",
        lat: 48.36235,
        lon: 10.90062
    },
    {
        name: "Café Viktor",
        lat: 48.3558453,
        lon: 10.8946921
    },
    {
        name: "ESG Cafete",
        lat: 48.3337832,
        lon: 10.9018916
    },
    {
        name: "Rockfabrik",
        lat: 48.34101,
        lon: 10.89741
    },
    {
        name: "Kantine",
        lat: 48.3647874,
        lon: 10.8934258
    },
    {
        name: "Annapam",
        lat: 48.362661,
        lon: 10.902919
    },
    {
        name: "Il Porcino",
        lat: 48.333542,
        lon: 10.900689
    },
    {
        name: "Flannigan's Post",
        lat: 48.367388,
        lon: 10.89346
    },
    {
        name: "Beim Weissen Lamm",
        lat: 48.370772,
        lon: 10.893002
    },
    {
        name: "Haifischbar",
        lat: 48.361225,
        lon: 10.902929
    },
    {
        name: "Botanischer Garten",
        lat: 48.34957,
        lon: 10.91476
    },
    {
        name: "Murdock's Irish Pub",
        lat: 48.36002,
        lon: 10.90264
    }
];
