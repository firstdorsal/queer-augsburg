import { Component } from "preact";

interface LogoProps {}
interface LogoState {}
export default class Logo extends Component<LogoProps, LogoState> {
    render = () => {
        return (
            <div className="Logo">
                <span style={{ float: "left" }}>
                    <img draggable={false} src={selectLogo()} alt="Logo" />
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

/*
Immer vom 13.11. bis 19.11. und dann machen wir 20.11. auch noch wegen Transremembrance.

Also immer vom 13.11. bis zum 20.11. trans Logo :)

*/
export const selectLogo = () => {
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();
    console.log(currentMonth, currentDay);

    // dates also start from 0!
    const logos = [
        {
            dateFrom: new Date(0, 10, 13),
            dateTo: new Date(0, 10, 20),
            logoPath: "logos/trans.png"
        }
    ];

    const logo = logos.find(logo => {
        return (
            logo.dateFrom.getMonth() === currentMonth &&
            logo.dateFrom.getDate() <= currentDay &&
            logo.dateTo.getMonth() === currentMonth &&
            logo.dateTo.getDate() >= currentDay
        );
    });

    if (logo) {
        return logo.logoPath;
    } else {
        return "icon.png";
    }
};
