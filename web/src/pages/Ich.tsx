import { Component } from "preact";
import { G } from "../types";

interface IchProps {
    readonly g: G;
}
interface IchState {}
export default class Ich extends Component<IchProps, IchState> {
    render = () => {
        return <div className="Ich">Ich</div>;
    };
}
