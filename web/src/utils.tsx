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
    // get the next day at 19:00 in utc seconds
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(19, 0, 0, 0);
    return tomorrow.getTime();
};

export const defaultMeeting: Meeting = {
    ...defaultMeetingContent(),
    _id: "",
    title: "",
    time: getUtcTimeStampNow() as unknown as bigint,
    attendance: null,
    location: null,
    place_id: null,
    online: null,
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
