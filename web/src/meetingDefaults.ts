import type { NewMeeting } from "./apiTypes/NewMeeting";

type MeetingContentDefaults = Pick<
    NewMeeting,
    | "authority"
    | "age_restriction"
    | "description"
    | "price"
    | "trigger_warning"
    | "accessibility"
    | "tags"
>;

/** Defaults shared by the meeting editor and the bulk import; a fresh object on every call. */
export const defaultMeetingContent = (): MeetingContentDefaults => ({
    authority: "",
    age_restriction: [0],
    description: "",
    price: [0],
    trigger_warning: null,
    accessibility: null,
    tags: { freeform: [], common: [], queer: ["Everyone"] }
});
