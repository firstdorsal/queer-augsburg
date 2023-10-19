import { Component } from "preact";
import { route } from "preact-router";
interface RedirectProps {
    readonly to: string;
    readonly external?: boolean;
}
interface RedirectState {}
export default class Redirect extends Component<RedirectProps, RedirectState> {
    constructor(props: RedirectProps) {
        super(props);
    }

    componentWillMount = () => {
        if (this.props.external) {
            window.location.href = this.props.to;
            return;
        }

        route(this.props.to, true);
    };

    render = () => {
        return null;
    };
}
