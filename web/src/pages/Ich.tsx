import { Component } from "preact";
import { G } from "../types";
import MyData from "../components/MyData";

interface IchProps {
    readonly g: G;
}
interface IchState {}
export default class Ich extends Component<IchProps, IchState> {
    render = () => {
        if (this.props.g.qaClient === null) {
            return <div className="Ich"></div>;
        }
        return (
            <div className="Ich">
                <MyData g={this.props.g} />
            </div>
        );
    };
}
