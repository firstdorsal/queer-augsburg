import { Component } from "preact";

interface KontaktProps {}
interface KontaktState {}
export default class Kontakt extends Component<KontaktProps, KontaktState> {
    render = () => {
        return (
            <div className="Kontakt Pad">
                <div>
                    <h1>Kontakt</h1>
                    <p>
                        Wir helfen euch bei all euren Anliegen weiter. Meldet euch über einen Kanal
                        eurer Wahl. Über die Mail erreicht ihr uns <b>zuverlässig.</b>
                    </p>
                    <a class="selectable" href="mailto:mail@queer-augsburg.de">
                        mail@queer-augsburg.de
                    </a>
                    <br />
                    <br />
                    <a rel="noreferrer" href="https://instagram.com/queer_augsburg">
                        Instagram
                    </a>
                    <br />
                    <br />
                    <a rel="noreferrer" href="https://twitter.com/QueerAugsburg">
                        Twitter
                    </a>
                    <br />
                    <br />
                    <a rel="noreferrer" href="https://dbna.com/profile/gTrOOElOxl">
                        DBNA
                    </a>
                    <br />
                    <br />
                    <a rel="noreferrer" href="https://facebook.com/QueerAugsburg">
                        Facebook
                    </a>
                </div>
            </div>
        );
    };
}
