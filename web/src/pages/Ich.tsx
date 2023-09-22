import { Component } from "preact";
import { G } from "../types";
import MyData from "../components/MyData";

interface IchProps {
    readonly g: G;
}
interface IchState {}
export default class Ich extends Component<IchProps, IchState> {
    componentDidMount = () => {
        this.redirectIfNotLoggedIn();
    };

    componentDidUpdate = () => {
        this.redirectIfNotLoggedIn();
    };

    redirectIfNotLoggedIn = () => {
        if (this.props.g.uiConfig && this.props.g.loggedIn === false) {
            window.location.href = this.props.g.uiConfig.interosseaWebAddress + "/login?rid=qa_ich";
        }
    };

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
