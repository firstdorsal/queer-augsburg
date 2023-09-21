import { Component } from "preact";
import MyData from "../components/MyData";
import { G } from "../types";

interface WirProps {
    readonly g: G;
}
interface WirState {}
export default class Wir extends Component<WirProps, WirState> {
    render = () => {
        return <div className="Wir"></div>;
    };
}
