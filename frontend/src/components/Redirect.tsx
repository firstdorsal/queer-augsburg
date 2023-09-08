import { Component } from "preact";
import { route } from "preact-router";
interface RedirectProps {
    to: string;
}
interface RedirectState {}
export default class Redirect extends Component<RedirectProps, RedirectState> {
    componentWillMount() {
        route(this.props.to, true);
    }

    render() {
        return null;
    }
}
