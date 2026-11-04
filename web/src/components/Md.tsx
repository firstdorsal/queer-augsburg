import { Component } from "preact";
import { ReactMarkdown } from "react-markdown/lib/react-markdown";

/** Headings inside a meeting card must not outrank the card's title. */
const CARD_HEADINGS = { h1: "h6", h2: "b", h3: "b", h4: "b", h5: "b", h6: "b" } as const;

/** Links to this site stay in the tab, so that documents can link each other. `//host` is
 * another site. */
const isOwnLink = (href: string) => href.startsWith("/") && !href.startsWith("//");

const PAGE_COMPONENTS = {
    a: ({ node: _node, ...props }: { node?: unknown; href?: string }) => (
        <a
            {...props}
            {...(props.href && isOwnLink(props.href)
                ? {}
                : { target: "_blank", rel: "noopener noreferrer" })}
        />
    )
};

interface MdProps {
    readonly plainText: string;
    /** The text is a page of its own: real headings, outside links open in a new tab. */
    readonly page?: boolean;
}
interface MdState {}
export default class Md extends Component<MdProps, MdState> {
    render = () => {
        return (
            <div className="Md">
                <ReactMarkdown
                    components={this.props.page ? PAGE_COMPONENTS : CARD_HEADINGS}
                    disallowedElements={this.props.page ? ["img"] : undefined}
                >
                    {this.props.plainText}
                </ReactMarkdown>
            </div>
        );
    };
}
