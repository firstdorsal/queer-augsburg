import { useToaster } from "rsuite";
import { Meeting } from "./apiTypes/Meeting";
import { defaultMeetingContent } from "./meetingDefaults";

export const withToasterHook = (Component: any) => {
    return (props: any) => {
        const toaster = useToaster();

        return <Component toaster={toaster} {...props} />;
    };
};

export const getUtcTimeStampNow = () => {
    // Tomorrow at 19:00 local time, as a UTC timestamp in milliseconds.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    return tomorrow.getTime();
};

export const defaultMeeting: Meeting = {
    ...defaultMeetingContent(),
    _id: "",
    title: "",
    time: getUtcTimeStampNow(),
    attendance: null,
    location: null,
    place_id: null,
    online: null,
    place_to_be_announced: false,
    rating: null,
    status: "Active",
    cancelled: false,
    changed: null,
    deleted_at: null
};

export const prefersDarkMode = () => {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return true;
    } else {
        return false;
    }
};
