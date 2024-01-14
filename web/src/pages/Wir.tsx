import { Component } from "preact";
import { G } from "../types";
//@ts-ignore
import weihnachtsbild from "../assets/weihnachten.jpg?w=1000&format=jpg&as=metadata";
//@ts-ignore
import vorstandBild from "../assets/vorstand.jpg?w=1000&format=jpg&as=metadata";
//@ts-ignore
import senatBild from "../assets/senat.jpg?w=1000&format=jpg&as=metadata";
import Image from "../components/Image";

interface WirProps {
    readonly g: G;
}
interface WirState {}
export default class Wir extends Component<WirProps, WirState> {
    render = () => {
        return (
            <div className="Wir Pad">
                <h1>Wir</h1>
                <p>
                    Queer Augsburg ein gemeinnütziger eingetragener Verein, der sich für lesbische,
                    schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere
                    Augsburger*innen sowie ihre Freund*innen und Unterstützer*innen in der Stadt und
                    im Herzen einsetzt. Wir sind offen für alle und veranstalten Treffen für queeres
                    Leben und Lernen im Geiste der Vielfalt, Transparenz und Teilhabe. Du bist bei
                    uns willkommen, unabhängig von geschlechtlicher Identität, sexueller und
                    romantischer Orientierung, Alter, Behinderung, parteipolitischer Zugehörigkeit,
                    Religion, (Wieder-) Einwanderungsgeschichte, Ethnie, Abstammung, Heimat,
                    Aussehen und Sprache. Bei Queer Augsburg finden alle eine Heimat, die unsere
                    Werte Akzeptanz, Freiheit, Respekt und Zusammenhalt teilen. Gemeinsam setzen wir
                    uns tagtäglich dafür ein, ein buntes, friedliches und vielfältiges Augsburg für
                    alle zu erschaffen.
                </p>
                <h1>Komm vorbei!</h1>
                <Image
                    image={weihnachtsbild}
                    alt="Große Gruppe von Menschen die Lächeln, aufgenommen bei der Weihnachtsfeier 2023"
                />

                <p>
                    Triff bei Queer Augsburg lesbische, schwule, trans*, bi+, a_sexuelle,
                    a_romantische, inter* und queere Menschen aus Augsburg und Umgebung. Lerne neue
                    Leute kennen und lerne etwas dazu bei unseren Veranstaltungen. Normalerweise
                    warten wir eine bunte Viertelstunde bevor wir mit dem Treffen beginnen. (Du
                    kannst auch nachkommen, wenn es mal später wird.) In dieser Zeit fertigen sich
                    die meisten mit unserem mitgebrachten Kreppband und Filzstift ein Namensschild
                    mitsamt Pronomen an. Anschließend stellt sich die Veranstaltungsleitung sowie
                    alle, die wollen, vor. Dann geht es mit dem Treffen los: Es wird geredet,
                    gespielt, zugehört und mitgemacht. Während des Treffens kannst du dich mit
                    Fragen und all deinen Belangen an die Veranstaltungsleitung wenden. Alles ist
                    freiwillig. Bei uns muss kein Mensch müssen. Du kannst dich jederzeit
                    zurückziehen und auch gehen. In der Regel werden die Veranstaltungen nach circa
                    zwei Stunden offiziell beendet. Du kannst meist noch bleiben, aber es ist auch
                    eine gute Gelegenheit, um zu gehen und allen ein &quot;Bis zum nächsten
                    Mal!&quot; zu wünschen.
                </p>
                <h1>Du</h1>
                <p>
                    Du kannst queere Menschen in Augsburg unterstützen, indem du Mitglied wirst,
                    spendest und mitmachst.
                </p>
                <h1>Gratis Mitglied werden</h1>
                <p>
                    Werde Mitglied bei Queer Augsburg! Die Mitgliedschaft ist kostenlos und kann
                    jederzeit beendet werden. Du musst lediglich mindestens 18 Jahre alt sein und
                    dich mit unseren Werten Offenheit, Akzeptanz, Respekt, Vielfalt, Freiheit,
                    Teilhabe, Transparenz und Zusammenhalt identifizieren. Bei uns gibt es keinen
                    Spam: Pro Jahr wirst du voraussichtlich fünf E-Mails von uns bekommen. Als
                    aktives Mitglied hast du Stimm- und Mitgestaltungsrechte bei der
                    Mitgliederversammlung. Fördernde MItglieder haben kein Stimmrecht. Sie helfen
                    genauso wie aktive Mitglieder, die Sichtbarkeit der queeren Community in
                    Augsburg zu stärken und unterstützen uns dabei, Augsburg zu einem bunten,
                    friedlichen und vielfältigen Ort für alle zu machen. Juristische Personen wie
                    andere Vereine oder Unternehmen können auch förderndes Mitglied von Queer
                    Augsburg werden. Sobald wir genug Spenden gesammelt haben, bekommen Mitglieder
                    Vergünstigungen bei Eintritten und ein erstes alkoholfreies Getränk bei unseren
                    Meets umsonst.
                </p>
                <p>
                    Wir müssen aus rechtlichen Gründen deinen Passnamen speichern. Da es aber sehr
                    unwahrscheinlich ist, dass wir die Passnamen je brauchen, wird dieser nicht mal
                    dem Vorstand ohne besonders guten Grund angezeigt. Um zum Formular zu gelangen,
                    kannst du <a href="/ich">hier</a> klicken, um per Mail einen Anmeldelink zu
                    erhalten. Nachdem du den Link in der Mail innerhalb von 10 Minuten angeklickt
                    hast, kommst du in deinen eigenen Bereich auf unserer Seite. Dort kannst du
                    deine Daten für den Antrag eintragen. Sollten sich deine Daten künftig ändern
                    kannst du diese im selben Formular anpassen und speichern. Nach dem Absenden des
                    Antrags bestätigen wir dir die Annahme per Mail. Der Vorstand entscheidet über
                    deinen Antrag. Dies kann mitunter länger dauern, da wir einen Safe Space bei
                    Queer Augsburg wahren wollen. Wir wollen daher sichergehen, dass es sich um
                    echte Personen handelt, die uns nicht schaden wollen. Dein Mitgliedsantrag wird
                    daher schneller bearbeitet, wenn du bei einem unserer Treffen beitrittst. Wenn
                    du bereits bei einem unserer Treffen warst und in unseren internen WhatsApp-
                    oder Signal-Gruppen bist, gib bitte deine Handynummer an, mit der du in der
                    Gruppe bist, und trage unter &quot;Woher kennst du uns?&quot; den jeweiligen
                    Messaging-Dienst ein: &quot;WhatsApp&quot; oder &quot;Signal&quot;. Anträge auf
                    fördernde Mitgliedschaft nehmen wir in der Regel schneller an.
                </p>
                <p>
                    Unsere Satzung findest du{" "}
                    <a
                        href="/static/Queer-Augsburg_Satzung.pdf"
                        data-native
                        target={"_blank"}
                        rel={"noopener noreferrer"}
                    >
                        hier
                    </a>
                    .
                </p>

                <h1>Spenden</h1>
                <p>
                    Mit deiner steuerlich absetzbaren Spende unterstützt du direkt queere Menschen
                    in Augsburg! Wir planen viele Projekte. In naher Zukunft wollen wir mit deiner
                    Spende zB einen Zoom-Account für digitale Events, neue Werbemittel, attraktivere
                    Events sowie Infomaterialien zu queeren Themen ermöglichen.
                </p>
                <p>
                    Am einfachsten ist eine Überweisung an:
                    <br />
                    Kontoinhaber: Queer Augsburg e.V.
                    <br />
                    IBAN: DE30 8306 5408 0005 3703 96
                    <br />
                    BIC: GENODEF1SLR
                </p>
                <p>
                    Bargeld sowie sonstige Sachspenden kannst du bei einem Treffen in Präsenz
                    spenden.
                </p>
                <p>An weiteren Spendemöglichkeiten arbeiten wir gerade. :)</p>
                <p>
                    Wir stellen dir auf Anfrage an{" "}
                    <a href="mailto:finanzen@queer-augsburg.de">finanzen@queer-augsburg.de</a> eine
                    offizielle Spendenbescheinigung aus. Bis zu einer Spendenhöhe von 300 €
                    akzeptiert das Finanzamt aber auch einen Kontoauszug als Nachweis.
                </p>

                <h1>Mitmachen</h1>
                <p>
                    Entfalte dich selbst, gib etwas zurück und gestalte die Stadt, die Gesellschaft
                    und den Verein mit deinem Beitrag zu einem bunten Augsburg! Wir brauchen jede
                    helfende Hand, denn es gibt viel zu tun.
                </p>
                <p>
                    Du kannst gut...
                    <br />
                    ...mit Menschen umgehen? - Leite ein Queer Augsburg Meet treffen!
                    <br />
                    ...erklären? - Halte einen Themenabend!
                    <br />
                    ...organisieren? - Realisiere ein Kennenlerntreffen oder eine
                    Mitgliederversammlung!
                    <br />
                    ...zeichnen? - Gestalte unsere Social Media Posts, Plakate, Sticker und
                    Infomaterialien!
                    <br />
                    ...programmieren? - Baue unsere Website und internen Systeme aus!
                    <br />
                    ...juristische Sachverhalte erfassen? - Reformiere unsere Satzung und internen
                    Abläufe!
                    <br />
                    ...netzwerken? - Vernetze dich mit Akteur*innen aus Politik und Gesellschaft!
                    <br />
                    ...mit Zahlen? - Prüfe unsere Konten und Kassen!
                    <br />
                    ...fundraisen? - Sammle Spenden für einen bunten Zweck!
                    <br />
                    ...planen? - Koordiniere unseren Terminkalender!
                    <br />
                    ...schreiben? - Schreib an unseren Texten auf der Website, auf Social Media und
                    unseren Infomaterialien!
                </p>
                <p>
                    Wir stellen dir für dein Engagment aussagekräftige Ehrenamtsbestätigungen für
                    Bewerbungen und Stipendien aus.
                </p>
                <h1>Senat</h1>
                <Image
                    image={senatBild}
                    alt="Gruppe von Menschen die in bunte Flaggen gehüllt ein Banner mit der Aufschrift Queer Augsburg Halten"
                />
                <p>
                    Der Senat ist das Arbeitsorgan des Vereins. All unsere Beauftragten koordinieren
                    hier die Vereinsarbeit.
                </p>
                <p>
                    Unser Senat besteht zurzeit aus elf Personen, von links nach rechts mitsamt
                    Fachbereich(en):
                </p>
                <ul>
                    <li> Aiden Lane Ziegler (er/ihm) - trans*, Kultur, Disability</li>
                    <li> Emmanuel Fleischer (er/ihm) - Aro_Ace</li>
                    <li> Aurora Schupp (it/its) - trans*, Aro_Ace</li>
                    <li> Annabel W. (sie/ihr) - Vereinsverwaltung</li>
                    <li> Helena Kosch (sie/ihr) - Öffentlichkeitsarbeit und Vernetzung</li>
                    <li> Jerome Petrov (er/ihm) - Recht</li>
                    <li> Kübra Karakuzu (sie/ihr) - Studierende</li>
                    <li> Paul Kunstmann (er/ihm) - Recht</li>
                    <li> Paul Hennig (er/ihm) - Digitales, Datenschutz, Party</li>
                    <li> Anna Görlitz (sie/ihr) - Finanzen</li>
                    <li> Julia Stöckner (sie/ihr) - Transparenz</li>
                </ul>
                <p>Nach der Vereinsgründung wurde beauftragt:</p>
                <ul>
                    <li>Leon Tokan (er/ihm) - Studierende</li>
                </ul>

                <p>
                    Eine besondere Rolle nimmt bei Queer Augsburg die Transparenzperson ein. Sie ist
                    die unabhängige und freie Hüterin des Vereins. Im Auftrag der
                    Mitgliederversammlung wahrt sie die Integrität des Vereins und des Vorstandes
                    sowie den friedlichen Umgang miteinander. Unsere derzeitige Transparenzperson
                    ist Julia Stöckner (sie/ihr). Julia studiert Lehramt und arbeitet im
                    Verlagswesen. Sie liebt die Allgäuer Bergwelt und italienisches Essen und
                    interessiert sich für intersektionalen Feminismus.
                </p>
                <p>
                    Du kannst sie unter ihrer eigenen Mailadresse, auf die der Vorstand keinen
                    Zugriff hat, erreichen:{" "}
                    <a href="mailto:transparenz@queer-augsburg.de">transparenz@queer-augsburg.de</a>
                </p>
                <p>
                    Die transparenz- sowie die finanzbeazftragte(n) Person(en) werden direkt von der
                    Mitgliederversammlung gewählt. Alle weiteren Beauftragten werden vom Vorstand
                    ernannt und können zusätzlich von der Mitgliederversamlung bestätigt werden.
                </p>

                <h1>Vorstand</h1>
                <Image
                    image={vorstandBild}
                    alt="Drei Personen die Lächeln, eine hält die Satzung in der Hand. Aufgenommen bei der Gründungsversammlung 2023."
                />
                <p>
                    Der Vorstand ist das Leitungsorgan des Vereins. Er vertritt den Verein rechtlich
                    nach außen und legt nach innen die Leitlinien der Vereinsarbeit fest. Der
                    Vorstand wird jedes Jahr von der Mitgliederversammlung neu gewählt.
                </p>
                <p>Unser Vorstand besteht zurzeit aus drei Personen, von links nach rechts:</p>

                <ul>
                    <li>
                        Aiden Lane Ziegler (er/ihm) ist intersectional Activist, Dramenautor und
                        Künstler mit Schwerpunkt Film, Theater und bildender Kunst mit den
                        wissenschaftlichen Disziplinen Ethik der Textkulturen, Kunst, Philosophie
                        und Rechtswissenschaften. Seine Hobbys sind Krimidinner, good Food and
                        lovely company.
                    </li>
                    <li>
                        Helena Kosch (sie/ihr) studiert soziale Arbeit und arbeitet in der
                        Jugendhilfe. Sie liebt Pflanzen, networking und ist bei Kreativem (fast)
                        immer gern dabei.
                    </li>
                    <li>
                        Paul Kunstmann (er/ihm) studiert Jura mit dem Schwerpunkt Geistiges
                        Eigentum. Er liebt es Fahrrad zu fahren, Sprachen zu lernen und in der
                        Augsburger Altstadt spazieren zu gehen. Für eine Runde Ga(y)ming ist Paul
                        immer zu haben.
                    </li>
                </ul>
            </div>
        );
    };
}
