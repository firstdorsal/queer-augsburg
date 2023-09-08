import { Component } from "preact";

interface EventProps {}
interface EventState {}
export default class Event extends Component<EventProps, EventState> {
    render = () => {
        return <div className="Event"></div>;
    };
}
