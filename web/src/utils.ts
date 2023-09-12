import { Meeting } from "./apiTypes/Meeting";

const getNewMeetingTemplate = () => {
    const meeting: Meeting = {
        _id: "abcd",
        title: "Queer Augsburg goes Into Space",
        time: BigInt(1694194347722),
        authority: "Kübra",
        age_restriction: [0, 18],
        location: {
            name: "Planetarium Augsburg",
            lat: 48.366,
            lon: 10.898
        },
        description: `Wolltet ihr schon immer Mal unsere Erde verlassen und die Unendlichkeit des Universums erkunden, auf weit entfernten Planeten landen und die Sterne aus einer anderen Perspektive beobachten? 🔭 💫🪐🛰️
    
        Dann zieht euren bunten Weltraumanzug an und seid Teil unserer Expedition ins Sonnensystem im Planetarium Augsburg.
        👨‍🚀🏳️‍🌈👩‍🚀
        Wir treffen uns am Samstag, 09.09.2023 um 17:30 Uhr vor dem Planetarium. Reserviere bitte einen eigenen Platz für die Vorstellung um 18 Uhr. Wir können nicht garantieren, dass einer unserer 11 reservierten Plätze noch frei sein wird. Du kannst die Karte vor Ort bezahlen, auch mit Karte.
        
        Ich (Kübra) freue mich auf alle Kosmonaut*innen auf unserer Reise zu den Planeten unseres Sonnensystems.
        👽🏳‍🌈👽`,
        price: [5],
        trigger_warning: "",
        attendance: 0,
        rating: 0,
        tags: {
            freeform: [],
            common: ["Kultur", "Education", "Meet", "Open"],
            queer: ["Everyone"]
        }
    };
    return meeting;
};
