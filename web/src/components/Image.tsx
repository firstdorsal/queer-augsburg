import { Component } from "preact";
import { CSSProperties } from "preact/compat";

interface ImageProps {
    image: {
        src: string;
        width: number;
        height: number;
    };
    alt: string;
    readonly style?: CSSProperties;
}
interface ImageState {}
export default class Image extends Component<ImageProps, ImageState> {
    render = () => {
        const i = this.props.image;

        return (
            <img
                style={{
                    ...this.props.style,
                    marginBottom: "10px",
                    display: "block",
                    maxWidth: "800px",
                    height: "auto",
                    width: "100%"
                }}
                src={i.src}
                alt={this.props.alt}
                width={i.width}
                height={i.height}
            />
        );
    };
}
