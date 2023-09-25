import { Component } from "preact";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";

interface MdProps {
    readonly plainText: string;
}
interface MdState {}
export default class Md extends Component<MdProps, MdState> {
    render = () => {
        return (
            <div className="Md">
                <ReactMarkdown
                    components={{ h1: "h6", h2: "b", h3: "b", h4: "b", h5: "b", h6: "b" }}
                >
                    {this.props.plainText}
                </ReactMarkdown>
            </div>
        );
    };
}
