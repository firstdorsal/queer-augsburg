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
    location: { name: "Elias Holl Platz", lat: 48.36876, lon: 10.89929 },
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
