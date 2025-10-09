import { Component } from "preact";
import Address from "../components/Address";

interface KontaktProps {}
interface KontaktState {}
export default class Kontakt extends Component<KontaktProps, KontaktState> {
    render = () => {
        return (
            <div className="Kontakt Pad">
                <div>
                    <h1>Kontakt</h1>
                    <p>
                        Du erreichst uns per Mail (
                        <a href="mailto:mail@queer-augsburg.de">mail@queer-augsburg.de</a>) oder
                        Direktnachricht auf{" "}
                        <a href="https://www.instagram.com/queer_augsburg/">Instagram</a>
                        . Unser E-Mail-Postfach bearbeiten wir zuverlässiger als Instagram. Wir
                        bekommen viele Anfragen. Queer Augsburg e.V. ist aber rein ehrenamtlich
                        organisiert. Einzelne Anfragen werden unbeantwortet bleiben. Wir bitten um
                        Nachsicht und um Erinnerungen mittels erneuter Nachricht. <br />
                        <br />
                        Fragen zu unseren Treffen, Verein und Engagement beantworten wir zuverlässig
                        und priorisiert. Nachrichten zu Studien, Werbung und Wohnungen beantworten
                        und bearbeiten wir fast nie. Wir können keine professionelle Hilfe anbieten.
                        Insbesondere wollen wir auf folgende Angebote hinweisen:
                        <ul>
                            <li>Aidshilfe Augsburg</li>
                            <li>ZAS Schwaben</li>
                            <li>lebis</li>
                            <li>schwubis</li>
                            <li>Diakonie</li>
                            <li>Queer Refugees</li>
                            <li>Augsburger Antidiskriminierungsstelle</li>
                            <li>STRONG!</li>
                        </ul>
                        Bitte wende dich vorrangig an diese Stellen. Sie können dir professionell
                        weiterhelfen.
                        <br />
                        <br />
                        Du kannst uns auch einen Brief per Post schicken an:
                        <Address />
                        Wir werden dir anonym antworten. Von außen wird es unmöglich zu erkennen
                        sein, dass der Brief von Queer Augsburg kommt.
                    </p>
                </div>
            </div>
        );
    };
}
