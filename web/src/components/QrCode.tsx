import { Component } from "preact";
import ReactQrCode from "react-qr-code";

interface QrCodeProps {
    readonly url: string;
}
interface QrCodeState {}
export default class QrCode extends Component<QrCodeProps, QrCodeState> {
    componentDidMount = () => {};

    render = () => {
        return (
            <div className="QrCode">
                <ReactQrCode value={this.props.url} size={256} />
            </div>
        );
    };
}
