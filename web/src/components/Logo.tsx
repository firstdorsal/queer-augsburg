import { Component } from "preact";

interface LogoProps {}
interface LogoState {}
export default class Logo extends Component<LogoProps, LogoState> {
    render = () => {
        return (
            <div className="Logo">
                <span style={{ float: "left" }}>
                    <img draggable={false} src="/icon.png" alt="Logo" />
                </span>
                <span style={{ float: "left", marginLeft: "10px" }}>
                    <div className="bold big" style={{ lineHeight: "34px" }}>
                        Queer Augsburg
                    </div>
                    <div style={{ lineHeight: "12px" }}>Offen für Alle.</div>
                </span>
            </div>
        );
    };
}
