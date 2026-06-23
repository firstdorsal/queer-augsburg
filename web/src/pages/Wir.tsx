import { Component } from "preact";
import { G } from "../types";
//@ts-ignore
import weihnachtsbild from "../assets/weihnachten.jpg?w=1000&format=jpg&as=metadata";
//@ts-ignore
import vorstandBild from "../assets/vorstand.jpg?w=1000&format=jpg&as=metadata";
//@ts-ignore
import senatBild from "../assets/senat.jpg?w=1000&format=jpg&as=metadata";

interface WirProps {
    readonly g: G;
}
interface WirState {}
export default class Wir extends Component<WirProps, WirState> {
    render = () => {
        return (
            <div className="Wir Pad pb-16 text-base leading-[1.7] [&>h1:first-child]:mt-0 [&>h1]:mt-16 [&>h2]:mb-2 [&>h2]:mt-8 [&>h2]:max-w-[560px] [&>p]:mb-4 [&>p]:max-w-[560px] [&_a]:underline [&_a]:underline-offset-2">
                <h1>Wir</h1>
                <p>
                    Queer Augsburg ist ein gemeinnütziger eingetragener Verein, der sich für
                    lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere
                    Augsburger*innen sowie ihre Freund*innen und Unterstützer*innen in der Stadt und
                    im Herzen einsetzt. Wir sind offen für alle und veranstalten Treffen für queeres
                    Leben und Lernen im Geiste der Vielfalt, Transparenz und Teilhabe. Du bist bei
                    uns willkommen, unabhängig von geschlechtlicher Identität, sexueller und
                    romantischer Orientierung, Alter, Behinderung, parteipolitischer Zugehörigkeit,
                    Religion, (Wieder-) Einwanderungsgeschichte, Ethnie, Abstammung, Heimat,
                    Aussehen und Sprache. Bei Queer Augsburg finden alle ein Zuhause, die unsere
                    Werte Akzeptanz, Freiheit, Respekt und Zusammenhalt teilen. Gemeinsam setzen wir
                    uns tagtäglich dafür ein, ein buntes, friedliches und vielfältiges Augsburg für
                    alle zu erschaffen.
                </p>

                <h1>Komm vorbei!</h1>
                <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
                    <div className="w-full overflow-hidden rounded-2xl lg:w-[460px] lg:shrink-0 lg:self-stretch">
                        <img
                            src={weihnachtsbild.src}
                            width={weihnachtsbild.width}
                            height={weihnachtsbild.height}
                            loading="lazy"
                            alt="Große Gruppe von Menschen die Lächeln, aufgenommen bei der Weihnachtsfeier 2024"
                            className="block h-auto w-full object-cover object-center lg:h-full"
                        />
                    </div>
                    <p className="max-w-[640px] lg:flex-1">
                        Triff bei Queer Augsburg lesbische, schwule, trans*, bi+, a_sexuelle,
                        a_romantische, inter* und queere Menschen aus Augsburg und Umgebung. Lerne
                        neue Leute kennen und lerne etwas dazu bei unseren Veranstaltungen.
                        Normalerweise warten wir eine bunte Viertelstunde bevor wir mit dem Treffen
                        beginnen. (Du kannst auch nachkommen, wenn es mal später wird.) In dieser
                        Zeit fertigen sich die meisten mit unserem mitgebrachten Kreppband und
                        Filzstift ein Namensschild mitsamt Pronomen an. Anschließend stellt sich die
                        Veranstaltungsleitung sowie alle, die wollen, vor. Dann geht es mit dem
                        Treffen los: Es wird geredet, gespielt, zugehört und mitgemacht. Während des
                        Treffens kannst du dich mit Fragen und all deinen Belangen an die
                        Veranstaltungsleitung wenden. Alles ist freiwillig. Bei uns muss kein Mensch
                        müssen. Du kannst dich jederzeit zurückziehen und auch gehen. In der Regel
                        werden die Veranstaltungen nach circa zwei Stunden offiziell beendet. Du
                        kannst meist noch bleiben, aber es ist auch eine gute Gelegenheit, um sich zu
                        verabschieden und allen ein &quot;Bis zum nächsten Mal!&quot; zu wünschen.
                    </p>
                </div>

                <div className="mt-16 flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-12">
                    <div className="lg:flex-1">
                        <h1 className="mt-0">Du</h1>
                        <p className="mb-4 max-w-[640px]">
                            Du kannst queere Menschen in Augsburg unterstützen, indem du Mitglied
                            wirst, spendest und mitmachst.
                        </p>

                        <h1 className="mb-2 mt-10">Gratis Mitglied werden</h1>
                        <p className="mb-4 max-w-[640px]">
                            Werde Mitglied bei Queer Augsburg! Die Mitgliedschaft ist kostenlos und
                            kann jederzeit beendet werden. Du musst dich lediglich mit unseren
                            Werten Offenheit, Akzeptanz, Respekt, Vielfalt, Freiheit, Teilhabe,
                            Transparenz und Zusammenhalt identifizieren. Vereinsmitglieder müssen
                            außerdem mindestens 18 Jahre alt sein. An unseren Treffen kannst du aber
                            meist schon davor teilnehmen. Beachte dazu die angegebenen
                            Altersgrenzen. Bei uns gibt es keinen Spam: Pro Jahr wirst du
                            voraussichtlich fünf E-Mails von uns bekommen. Als aktives Mitglied hast
                            du Stimm- und Mitgestaltungsrechte bei der Mitgliederversammlung.
                            Fördernde Mitglieder haben kein Stimmrecht. Sie helfen genauso wie
                            aktive Mitglieder, die Sichtbarkeit der queeren Community in Augsburg zu
                            stärken und unterstützen uns dabei, Augsburg zu einem bunten,
                            friedlichen und vielfältigen Ort für alle zu machen. Juristische
                            Personen wie andere Vereine oder Unternehmen können auch förderndes
                            Mitglied von Queer Augsburg werden. Sobald wir genug Spenden gesammelt
                            haben, bekommen Mitglieder Vergünstigungen bei Eintritten und ein erstes
                            alkoholfreies Getränk bei unseren Meets umsonst.
                        </p>
                        <p className="mb-4 max-w-[640px]">
                            Wir müssen aus rechtlichen Gründen deinen Passnamen speichern. Da es
                            aber sehr unwahrscheinlich ist, dass wir die Passnamen je brauchen, wird
                            dieser nicht mal dem Vorstand ohne besonders guten Grund angezeigt. Um
                            zum Formular zu gelangen, kannst du <a href="/ich">hier</a> klicken, um
                            per Mail einen Anmeldelink zu erhalten. Nachdem du den Link in der Mail
                            innerhalb von 10 Minuten angeklickt hast, kommst du in deinen eigenen
                            Bereich auf unserer Seite. Dort kannst du deine Daten für den Antrag
                            eintragen. Sollten sich deine Daten künftig ändern kannst du diese im
                            selben Formular anpassen und speichern. Nach dem Absenden des Antrags
                            bestätigen wir dir die Annahme per Mail. Der Vorstand entscheidet über
                            deinen Antrag. Dies kann mitunter länger dauern, da wir einen Safe Space
                            bei Queer Augsburg wahren wollen. Wir wollen daher sichergehen, dass es
                            sich um echte Personen handelt, die uns nicht schaden wollen. Dein
                            Mitgliedsantrag wird daher schneller bearbeitet, wenn du bei einem
                            unserer Treffen beitrittst. Wenn du bereits bei einem unserer Treffen
                            warst und in unseren internen WhatsApp- oder Signal-Gruppen bist, gib
                            bitte deine Handynummer an, mit der du in der Gruppe bist, und trage
                            unter &quot;Woher kennst du uns?&quot; den jeweiligen Messaging-Dienst
                            ein: &quot;WhatsApp&quot; oder &quot;Signal&quot;. Anträge auf fördernde
                            Mitgliedschaft nehmen wir in der Regel schneller an.
                        </p>
                        <p className="max-w-[640px]">
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
                    </div>

                    <aside className="rounded-2xl bg-[var(--background-color-2)] p-6 lg:sticky lg:top-4 lg:w-[380px] lg:shrink-0 [&_p]:mb-3">
                        <h2 className="mb-3 mt-0">Spenden</h2>
                        <p>
                            Mit deiner steuerlich absetzbaren Spende unterstützt du direkt queere
                            Menschen in Augsburg! Wir planen viele Projekte. In naher Zukunft wollen
                            wir mit deiner Spende zB einen Zoom-Account für digitale Events, neue
                            Werbemittel, attraktivere Events sowie Infomaterialien zu queeren Themen
                            ermöglichen.
                        </p>
                        <p>Am einfachsten ist eine Überweisung an:</p>
                        <dl className="mb-3 rounded-xl bg-[var(--background-color)] px-4">
                            <div className="py-2.5">
                                <dt className="text-sm opacity-60">Kontoinhaber</dt>
                                <dd className="m-0">Queer Augsburg e.V.</dd>
                            </div>
                            <div className="border-t border-[rgba(128,128,128,0.25)] py-2.5">
                                <dt className="text-sm opacity-60">IBAN</dt>
                                <dd className="m-0 tabular-nums tracking-wide">
                                    DE30 8306 5408 0005 3703 96
                                </dd>
                            </div>
                            <div className="border-t border-[rgba(128,128,128,0.25)] py-2.5">
                                <dt className="text-sm opacity-60">BIC</dt>
                                <dd className="m-0 tabular-nums tracking-wide">GENODEF1SLR</dd>
                            </div>
                        </dl>
                        <p>
                            Bargeld sowie sonstige Sachspenden kannst du bei einem Treffen in
                            Präsenz spenden.
                        </p>
                        <h3 className="mb-1 mt-4">Online Spenden</h3>
                        <p>
                            Jetzt kostenpflichtig an Queer Augsburg e.V. Spenden:{" "}
                            <a rel={"noopener noreferrer"} href="https://pay.sumup.com/b2c/QD5HHAKK">
                                SumUp
                            </a>
                        </p>
                        <p>An weiteren Spendemöglichkeiten arbeiten wir gerade. :)</p>
                        <p className="mb-0">
                            Wir stellen dir auf Anfrage an{" "}
                            <a href="mailto:finanzen@queer-augsburg.de">
                                finanzen@queer-augsburg.de
                            </a>{" "}
                            eine offizielle Spendenbescheinigung aus. Bis zu einer Spendenhöhe von
                            300 € akzeptiert das Finanzamt aber auch einen Kontoauszug als Nachweis.
                        </p>
                    </aside>
                </div>

                <h1>Mitmachen</h1>
                <p>
                    Entfalte dich selbst, gib etwas zurück und gestalte die Stadt, die Gesellschaft
                    und den Verein mit deinem Beitrag zu einem bunten Augsburg! Wir brauchen jede
                    helfende Hand, denn es gibt viel zu tun.
                </p>
                <p>Du kannst gut …</p>
                <ul className="my-4 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… mit Menschen umgehen?</strong>
                        <span className="opacity-80">Leite ein Queer Augsburg Meet treffen!</span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… erklären?</strong>
                        <span className="opacity-80">Halte einen Themenabend!</span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… organisieren?</strong>
                        <span className="opacity-80">
                            Realisiere ein Kennenlerntreffen oder eine Mitgliederversammlung!
                        </span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… zeichnen?</strong>
                        <span className="opacity-80">
                            Gestalte unsere Social Media Posts, Plakate, Sticker und
                            Infomaterialien!
                        </span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… programmieren?</strong>
                        <span className="opacity-80">
                            Baue unsere Website und internen Systeme aus!
                        </span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… juristische Sachverhalte erfassen?</strong>
                        <span className="opacity-80">
                            Reformiere unsere Satzung und internen Abläufe!
                        </span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… netzwerken?</strong>
                        <span className="opacity-80">
                            Vernetze dich mit Akteur*innen aus Politik und Gesellschaft!
                        </span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… mit Zahlen?</strong>
                        <span className="opacity-80">Prüfe unsere Konten und Kassen!</span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… fundraisen?</strong>
                        <span className="opacity-80">Sammle Spenden für einen bunten Zweck!</span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… planen?</strong>
                        <span className="opacity-80">Koordiniere unseren Terminkalender!</span>
                    </li>
                    <li className="border-l-2 border-[var(--background-color-2)] py-1 pl-4">
                        <strong className="block">… schreiben?</strong>
                        <span className="opacity-80">
                            Schreib an unseren Texten auf der Website, auf Social Media und unseren
                            Infomaterialien!
                        </span>
                    </li>
                </ul>
                <p>
                    Wir stellen dir für dein Engagement aussagekräftige Ehrenamtsbestätigungen für
                    Bewerbungen und Stipendien aus.
                </p>

                <h1>Senat</h1>
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <img
                        src={senatBild.src}
                        width={senatBild.width}
                        height={senatBild.height}
                        loading="lazy"
                        alt="Gruppe von Menschen die in bunte Flaggen gehüllt ein Banner mit der Aufschrift Queer Augsburg Halten"
                        className="h-auto w-full rounded-2xl md:w-2/5"
                    />
                    <div className="md:flex-1">
                        <p className="mb-4 max-w-[600px]">
                            Der Senat ist das Arbeitsorgan des Vereins. All unsere Beauftragten
                            koordinieren hier die Vereinsarbeit.
                        </p>
                        <p className="max-w-[600px]">
                            Unser Senat besteht zurzeit aus elf Personen, Beauftragte von links nach
                            rechts mitsamt Fachbereich(en):
                        </p>
                    </div>
                </div>
                <ul className="my-4 grid list-none grid-cols-1 gap-x-10 p-0 sm:grid-cols-2">
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Leon Tokan</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">Studierende</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Aurora Schupp</strong>
                        <span className="text-sm opacity-60">it/its</span>
                        <span className="ml-auto text-right text-sm opacity-80">
                            trans*, Aro_Ace
                        </span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Benji Kalide</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">Marketing</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5 italic opacity-70">
                        <strong>Julia Stöckner</strong>
                        <span className="text-sm opacity-60">sie/ihr</span>
                        <span className="ml-auto text-right text-sm opacity-80">Ehrenmitglied</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Helena Kosch</strong>
                        <span className="text-sm opacity-60">sie/ihr</span>
                        <span className="ml-auto text-right text-sm opacity-80">Vernetzung</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Annabel</strong>
                        <span className="text-sm opacity-60">sie/ihr</span>
                        <span className="ml-auto text-right text-sm opacity-80">Transparenz</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Paul Kunstmann</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">Recht</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Aiden Lane Ziegler</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">
                            trans*, Kultur, Disability
                        </span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Jerome Petrov</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">
                            Transparenz, Finanzen, Recht
                        </span>
                    </li>
                </ul>
                <h3 className="mb-1 mt-7 text-sm uppercase tracking-[0.08em] opacity-60">
                    Nicht auf dem Bild
                </h3>
                <ul className="my-4 grid list-none grid-cols-1 gap-x-10 p-0 sm:grid-cols-2">
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Paul Hennig</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">
                            Digitales, Datenschutz, Party
                        </span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Emmanuel Fleischer</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">Aro_Ace</span>
                    </li>
                    <li className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 border-b border-[var(--background-color-2)] py-2.5">
                        <strong>Gabriel Dehner</strong>
                        <span className="text-sm opacity-60">er/ihm</span>
                        <span className="ml-auto text-right text-sm opacity-80">Transparenz</span>
                    </li>
                </ul>

                <h1>Transparenz</h1>
                <p className="mb-4 max-w-[560px]">
                    Eine besondere Rolle nimmt bei Queer Augsburg die Transparenzperson ein. Sie ist
                    die unabhängige und freie Hüterin des Vereins. Im Auftrag der
                    Mitgliederversammlung wahrt sie die Integrität des Vereins und des Vorstandes
                    sowie den friedlichen Umgang miteinander.
                </p>
                <p className="mb-4 max-w-[560px]">
                    Die Rolle der Transparenzperson wird zurzeit durch das Transparenztrio bestehend
                    aus Annabel, Gabriel und Jerome ausgeübt:
                </p>
                <div className="my-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Annabel</strong>{" "}
                            <span className="text-sm opacity-60">sie/ihr</span> ist ein Bücherwurm,
                            geht gerne auf Reisen und hat in Augsburg ihre Wahlheimat gefunden.
                        </p>
                    </article>
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Gabriel Dehner</strong>{" "}
                            <span className="text-sm opacity-60">er/ihm</span> macht gerne Musik auf
                            der Que(e)rflöte, Okarina oder Hulusi. Auch bei Handarbeiten oder
                            Diskussionen über Geschichte oder Filme ist er gern dabei.
                        </p>
                    </article>
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Jerome</strong>{" "}
                            <span className="text-sm opacity-60">er/ihm</span> ist Informatiker und
                            studiert derzeit im Master. Er liebt es zu singen, zu kochen und mit
                            begrenztem Erfolg Französisch zu lernen.
                        </p>
                    </article>
                </div>
                <p className="mb-4 max-w-[560px]">
                    Du kannst die drei unter ihrer eigenen Mailadresse, auf die der Vorstand keinen
                    Zugriff hat, erreichen:{" "}
                    <a href="mailto:transparenz@queer-augsburg.de">transparenz@queer-augsburg.de</a>
                </p>
                <p className="mb-4 max-w-[560px]">
                    Die transparenz- sowie die finanzbeauftragte(n) Person(en) werden direkt von
                    der Mitgliederversammlung gewählt. Alle weiteren Beauftragten werden vom
                    Vorstand ernannt und können zusätzlich von der Mitgliederversammlung bestätigt
                    werden.
                </p>

                <h1>Vorstand</h1>
                <div className="flex flex-col gap-6 md:flex-row md:items-center">
                    <img
                        src={vorstandBild.src}
                        loading="lazy"
                        alt="Drei Personen die Lächeln, eine hält die Satzung von Queer Augsburg in der Hand. Aufgenommen bei der Gründungsversammlung 2023."
                        className="aspect-square w-full rounded-2xl object-cover object-center md:w-1/3 md:max-w-[360px]"
                    />
                    <div className="md:flex-1">
                        <p className="mb-4 max-w-[600px]">
                            Der Vorstand ist das Leitungsorgan des Vereins. Er vertritt den Verein
                            rechtlich nach außen und legt nach innen die Leitlinien der
                            Vereinsarbeit fest. Der Vorstand wird jedes Jahr von der
                            Mitgliederversammlung neu gewählt.
                        </p>
                        <p className="max-w-[600px]">
                            Unser Vorstand besteht zurzeit aus drei Personen, von links nach rechts:
                        </p>
                    </div>
                </div>
                <div className="my-5 grid grid-cols-1 gap-5 md:grid-cols-3">
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Paul Kunstmann</strong>{" "}
                            <span className="text-sm opacity-60">er/ihm</span> ist Jurist mit dem
                            Schwerpunkt Geistiges Eigentum auf dem Weg Anwalt zu werden. Er liebt es
                            Fahrrad zu fahren, Sprachen zu lernen und in der Augsburger Altstadt
                            spazieren zu gehen. Für eine Runde Ga(y)ming ist Paul immer zu haben.
                        </p>
                    </article>
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Aiden Lane Ziegler</strong>{" "}
                            <span className="text-sm opacity-60">er/ihm</span> ist intersectional
                            Activist, Dramenautor und Künstler mit Schwerpunkt Film, Theater und
                            bildender Kunst mit den wissenschaftlichen Disziplinen Ethik der
                            Textkulturen, Kunst, Philosophie und Rechtswissenschaften. Seine Hobbys
                            sind Krimidinner, good Food and lovely company.
                        </p>
                    </article>
                    <article className="rounded-2xl bg-[var(--background-color-2)] p-5">
                        <p className="m-0">
                            <strong>Helena Kosch</strong>{" "}
                            <span className="text-sm opacity-60">sie/ihr</span> studiert soziale
                            Arbeit und arbeitet in der Jugendhilfe. Sie liebt Pflanzen, networking
                            und ist bei Kreativem (fast) immer gern dabei.
                        </p>
                    </article>
                </div>
            </div>
        );
    };
}
