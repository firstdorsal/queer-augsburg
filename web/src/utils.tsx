import { useToaster } from "rsuite";
import { Meeting } from "./apiTypes/Meeting";

export const withToasterHook = (Component: any) => {
    return (props: any) => {
        const toaster = useToaster();

        return <Component toaster={toaster} {...props} />;
    };
};

export const getUtcTimeStampNow = () => {
    return new Date(Date.now()).getTime();
};

export const defaultMeeting: Meeting = {
    _id: "",
    title: "",
    description: "",
    time: getUtcTimeStampNow() as unknown as bigint,
    attendance: null,
    authority: "Queer Augsburg",
    age_restriction: [],
    location: { name: "Augsburg", lat: 48.36876, lon: 10.89929 },
    price: [],
    trigger_warning: null,
    rating: null,
    tags: { freeform: [], common: [], queer: ["Everyone"] },
    status: "Active"
};

export const prefersDarkMode = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return true;
    } else {
        return false;
    }
};
