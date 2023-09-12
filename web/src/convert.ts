const convertOld = () => {
    const old = [
        {
            _id: {
                $oid: "5df2db76d1f666d78bfff6d5"
            },
            id: "1",
            head: "<br>Eröffnungstreffen<br>Mittwoch<br>08.05.2019",
            body: "Es gibt eine neue, dynamische und aktive queere Gruppe in Augsburg!<br>Queer Augsburg setzt sich für queere Menschen in Augsburg und Umgebung ein und veranstaltet regelmäßige Treffen.<br>Alle sind willkommen! Bis dann um 17:30 vor der Uni-Mensa. <br><br>❤️🧡💛💚💙💜",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1557329400000"
            },
            planned: false,
            attendance: 6
        },
        {
            _id: {
                $oid: "5df2e3bcd1f666d78bffffd0"
            },
            id: "2",
            head: "CSD München<br>13.07.2019",
            body: "Queer Augsburg goes Munich! ‍<br>Wollt ihr bei der Parade des Jubiläums-Pride in München mitlaufen? Mit anderen Studierenden aus eurer Uni? Und keine Fahrtkosten bezahlen? Dann meldet euch jetzt hier (Link entfernt) an!<br><br>Treffpunkt ist am 13.Juli 2019 um 9:30 Uhr am Augsburger Hauptbahnhof.<br>Die bezahlten Plätze sind auf 25 begrenzt, meldet euch also an bevor die Plätze weg sind!<br>Bringt auf jeden Fall eure Campus Card mit! (Ohne können wir nicht abrechnen.)<br><br>🚅🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1563003000000"
            },
            attendance: 8
        },
        {
            _id: {
                $oid: "5df2e42ad1f666d78b00004e"
            },
            id: "3",
            head: "Kennenlernen<br>22.10.2019",
            body: "Am 22.Oktober 2019 veranstaltet Queer Augsburg ein Willkommens- und Kennenlerntreffen für alle interessierten Menschen und Einhörner. Egal welches Alter, Geschlecht oder Sexualität - wir sind offen für alle. Treffpunkt ist im AStA um 17:30 Uhr.<br>Es gibt Kekse!<br>Wir freuen uns auf euch. :) <br><br>🐯🦙🍪",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1571758200000"
            },
            attendance: 52
        },
        {
            _id: {
                $oid: "5df2e487d1f666d78b0000b0"
            },
            id: "4",
            head: "Billard and Chill 05.11.2019",
            body: "Wir hoffen euch hat das erste Treffen so gut gefallen wie uns und ihr kommt auch dieses mal vorbei!<br><br>Wir treffen uns um 18:30 Uhr vor der swa am Königsplatz und gehen dann gemeinsam ins Pool City Billard in der Hermannstraße. Alternativ könnt ihr natürlich auch direkt dorthin kommen. Dort gibt es Billardtische und Kicker sowie etwas zum Essen.<br><br>Zutritt ist ab 18 Jahren oder mit Muttizettel. Bitte bringt auf jedenfall eure Ausweise mit. Keine Sorge, wir sind auch Billard Noobs. ;D Wir freuen uns auf euch! ‍<br><br>🎱",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1572975000000"
            },
            attendance: 17
        },
        {
            _id: {
                $oid: "5df2e502d1f666d78b000136"
            },
            id: "5",
            head: "Spontan: ESG Abend 07.11.2019",
            body: 'Morgen veranstaltet die Evangelische Studentengemeinde (ESG) einen Pizza- und Filmabend, bei dem Anhänger (Zettel) für deren "Christkind gesucht" - Aktion gebastelt werden.<br>Ihr seid auch herzlich eingeladen zu kommen. 🤗<br>Treffpunkt ist um 19 Uhr in der ESG-Cafete. 😊<br><br>🍕🎥',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1573149600000"
            }
        },
        {
            _id: {
                $oid: "5df2e57fd1f666d78b0001c1"
            },
            id: "6",
            head: "Mono, Poly and What? 19.11.19",
            body: "Mono, Poly and What? - Alternative Beziehungsformen<br><br>Komm vorbei auf eine Runde Kaffee und Kuchen und lerne dabei in ruhiger Atmosphäre Menschen in alternativen Beziehungsformen kennen! Stelle deine unbeantworteten Fragen oder lausche einfach nur der Diskussion der anderen. <br>Du kannst kommen und gehen wann du möchtest. <br>Ab 18:00 im Raum D1087a.<br><br>👭👫👬",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1574182800000"
            },
            attendance: 25
        },
        {
            _id: {
                $oid: "5df2e65fd1f666d78b0002ad"
            },
            id: "7",
            head: "Christkindlesmarkt<br>03.12.2019",
            body: "Ho ho ho! Es weihnachtet in der Augsburger Innenstadt! Das zieht natürlich auch ein queeres Einhornrudel wie uns an... Lasst uns Regenbogen, Glitzer und Weihnachtsstimmung verteilen! 🦄✨<br>Treffpunkt ist um 19 Uhr direkt vor dem Rathaus. Nach einer Runde Glühwein und Punsch setzen wir uns dann in einer gemütlichen Runde ab 20:00 Uhr zusammen ins Henry's Coffee.<br>Wir freuen uns auf euch!<br><br>🎄🎅🦌",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1575396000000"
            },
            attendance: 12
        },
        {
            _id: {
                $oid: "5df2e6cdd1f666d78b000325"
            },
            id: "8",
            head: "Christkind gesucht<br>05.12.2019",
            body: 'Am Donnerstag den 5. Dezember 2019 um 14:00 Uhr helfen wir der ESG beim Transportieren von Paketen für ihre "Christkind gesucht" Aktion.<br><br>Treffpunkt ist in der Mensa, die Pakete werden die Straße runter zur KHG gebracht. Taschen sollten mitgenommen werden!<br><br>🎅🎁🎄',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1575568800000"
            }
        },
        {
            _id: {
                $oid: "5df2e78ad1f666d78b0003ec"
            },
            id: "9",
            head: "Plakataktion<br>11.12.2019",
            body: "Die Uni wird wieder zuplakatiert! 🏳‍🌈<br>Am <b>Dienstag den 11.12. </b>wollen wir den Uni-Campus pink machen! 🎈<br>Treffpunkt ist ab <b> 16:45 im AStA</b>, losgehen wird es gegen 17:00 Uhr.<br>Sehr gerne könnt ihr auch Plakate mitnehmen, um sie in euren Wohnheimen, in der Hochschule oder wo auch immer aufzuhängen. 🦄<br>Für ein großes queeres Weihnachtsfest! ☃✨<br><br>📌",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1576080000000"
            },
            attendance: 7
        },
        {
            _id: {
                $oid: "5df2e7e4d1f666d78b000452"
            },
            id: "10",
            head: "Weihnachtstreffen<br>17.12.2019",
            body: "Weihnachtsbäume werden aufgestellt, Plätzchen gebacken, Geschenke vorbereitet - Weihnachten steht vor der Tür! 🎄<br>Lasst uns gemeinsam Plätzchen essen, Weihnachtslieder singen und Liebe verbreiten. 🌠<br>Wer Lust auf Wichteln hat, sollte selbst ein Geschenk mitbringen.🎁<br>Bis zum 17.12. ab 18:30 Uhr in der ESG-Cafete im ersten Stock! 🦄<br><br>🌠",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1576603800000"
            },
            attendance: 27
        },
        {
            _id: {
                $oid: "5df7fed5bf07414da0f9eeef"
            },
            id: "11",
            head: "Welt Aids Tag<br>02.12.2019",
            body: "Am 1.12.2019 ist Welt-AIDS-Tag. Zu diesem Anlass wollen wir am 2.12.2019 ab 11 Uhr unten vor der Mensa informieren, Päckchen verteilen und Schleife zeigen!<br>Kommt vorbei!<br><br>❤️🎀🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1575280800000"
            },
            attendance: 5,
            planned: false,
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e0d3db1ac882118b305ecb7"
            },
            id: "12",
            head: "Queerfilmabend<br>16.1.2020",
            body: "Popcorn, Filme, queere Menschen, was will man mehr?<br>Reiche deine gewünschten YouTube-Kurzfilme unter<br><a href=\"\">diesem Formular</a> ein.<br><br>📽️🍿🏳️‍🌈<br><br>Treffpunkt ist um 19 Uhr im Raum C1.23 in der Hochschule hinter der alten Mensa.<br><br><a href='https://goo.gl/maps/uhSFVAAP3bM38XmP8' rel='noreferrer'>Maps</a>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1579197600000"
            },
            attendance: 13
        },
        {
            _id: {
                $oid: "5e129484ac882118b305ecb9"
            },
            id: "13",
            head: "1. Planungstreffen<br>19.8.2019",
            body: 'Queer Augsburg trifft sich am Montag, den 19.8.2019, um 17 Uhr beim Kiosk an der Haltestelle "Rotes Tor", um anschließend das nächste Semester zu planen, sich gegenseitig kennenzulernen und eine schöne Zeit zu haben.<br>Kommst du mit? :)<br><br>💝',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1566165600000"
            },
            attendance: 9
        },
        {
            _id: {
                $oid: "5e129588ac882118b305ecba"
            },
            id: "14",
            head: "2. Planungstreffen<br>1.10.2019",
            body: "Queer Augsburg trifft sich am 1.Oktober 2019 um 18 Uhr am Kö.<br>Thema wird das Kennenlerntreffen am 22.10.2019 sein. Also die Inhalte, das Plakatieren und die O-Phasen.<br>Weiterhin wollen wir Aktionen für den Rest des Semesters planen und das Schulprojekt voranbringen.<br><br>Wir würden uns über deine Teilnahme freuen! :)<br><br>🦄",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1569880800000"
            },
            attendance: 12,
            planned: false,
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e129712ac882118b305ecbb"
            },
            id: "15",
            head: "Erstes Keksebacken<br>6.10.2019",
            body: "Die Vorratskammer ist voll! Wir backen gemeinsam Kekse für die vielen hungrigen Erstsemester.<br>Wer zu Hause etwas über hat, ist eingeladen etwas mitzunehmen.<br>Morgen ab 16 Uhr, (Adresse entfernt).<br><br>Wer nicht früher kann, kann gerne auch nachkommen.<br><br>🍪🍪🍪",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1570312800000"
            },
            attendance: 6
        },
        {
            _id: {
                $oid: "5e1297f1ac882118b305ecbc"
            },
            id: "16",
            head: "Plakatieraktion<br>7.10.2019",
            body: "Die Uni wird bunt gemacht! Ab 16.45 Uhr im AStA.<br><br>(Wie immer gilt die schwule Viertelstunde.)<br><br>🗺️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1570399200000"
            },
            attendance: 4
        },
        {
            _id: {
                $oid: "5e129955ac882118b305ecbd"
            },
            id: "17",
            head: "O-Phase Jura und WiWi<br>9.10.2019",
            body: "Wir zeigen den Erstsemestern der Jura- und Wirtschaftsfakultät wie bunt die Uni ist!<br>Es gibt Kekse und Kondome.<br><br>Von 11:30 Uhr bis 13:30 Uhr im Jura-Foyer, von 13:30 bis 15 Uhr im WiWi-Foyer.<br>Wir freuen uns auf euch!<br><br>🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1570572000000"
            },
            attendance: 7
        },
        {
            _id: {
                $oid: "5e129a70ac882118b305ecbe"
            },
            id: "18",
            head: "O-Phase PhilHist<br>10.10.2019",
            body: "Nicht nur auf dem Gucci-Hügel, auch im Tal der Verzweiflung verbreiten wir unter den Erstsemestern Feenstaub.<br>Von 14 bis 15 Uhr im D-Gebäude an der roten Säule.<br>(Den Gang mit dem queeren Brett runtergehen.)<br><br>Es gibt Sticker und Kondome!<br><br>🧚✨",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1570658400000"
            },
            attendance: 3,
            planned: false,
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e129ca4ac882118b305ecbf"
            },
            id: "19",
            head: "Zweites Keksebacken<br>20.10.2019",
            body: "Unsere Erstsemester werden festlich begrüßt.<br>Nicht nur mit Brezen und Trunk wird ihr Abend versüßt.<br>Denn nach alter Tradition,<br>bedarf es einer Keksration.<br><br>Um 17:40 Uhr ist das Treffen,<br>lasset uns backen etwas zu essen.<br><br>🍪",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1571522400000"
            },
            planned: false,
            attendance: "4",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e129da6ac882118b305ecc0"
            },
            id: "20",
            head: "Planungstreffen<br>26.11.2019",
            body: "Wir planen wie wir die Weltherrschaft bis 2050 übernehmen.<br>Themen werden das Schulprojekt, der CSD 2020 und der Dragball sein.<br>Das Treffen ist am 26.11.2019 ab 18:30 Uhr in Raum C1.23 hinter der alten Mensa in der Hochschule.<br><br>Wir freuen uns auf euer Kommen!<br><br>(Wer nicht kommt, kriegt kein Herrschaftsgebiet zugeteilt.)<br><br><br>🌍🌎🌏",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1574722800000"
            },
            attendance: "10",
            planned: false,
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e138d7eac882118b305ecc1"
            },
            id: "21",
            head: "Planungstreffen<br>16.1.2020",
            body: "<br>Am 16.Januar ist unser Queerfilmabend!<br>Direkt davor veranstalten wir ab 17 Uhr ein Planungstreffen im AStA, zu dem ihr alle herzlich eingeladen seid! 😊<br>Thema werden Europatag, Dragball, CSD, das Abschlusstreffen und die Weltherrschaft sein. 🦄<br><br>🏳️‍🌈🇪🇺",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1579215300000"
            }
        },
        {
            _id: {
                $oid: "5e1895bfac882118b305ecc2"
            },
            id: "22",
            head: "Bunter Abend<br>29.1.2020",
            body: 'Bunt, bunter, Queer Augsburg!<br>Lasst uns das letzte Semester ausklingen. Nutzt das Prokrastinieren dazu, Beiträge für unseren Abend vorzubereiten.<br>Power-Point, Fotos, Tanzeinlagen, ein Musikstück vorspielen, ganz egal.<br>Wir sind offen für alles.<br><br>Reiche deinen Beitrag <a href="https://docs.google.com/document/d/12nFMt2Lhm4nlNyDKmaM6pLVUj7ZmfP8UzrZNRDtuzK4/edit?usp=sharing">hier</a> bis zum 26.1.2020 ein<br><br>Treffpunkt ist um 19 Uhr am 29.1.2020 in der ESG-Cafete.<br><br>💃🌈🦄',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1580320800000"
            },
            attendance: 13
        },
        {
            _id: {
                $oid: "5e2b60ff346f2506963818b3"
            },
            id: "23",
            head: "Planungstreffen: Schulprojekt<br>21.02.2020",
            body: 'Wir planen das Schulprojekt. Wir legen den Ablauf fest, einigen uns auf Leitlinien und vergeben Aufgaben. 💪<br><br>Wir treffen uns am Freitag, den 21. Februar, um 19 Uhr an der Tramhaltestelle "Kongress am Park" (Linie 1). 🚈<br><br>Bitte seid pünktlich oder meldet euch, wenn ihr zu spät kommt, per Mail oder Whatsapp bei uns.<br><br>Kommt vorbei, wenn ihr mitmachen wollt!<br>Meldet euch bei uns unter:<br>schulprojekt@queer-augsburg.de',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1582135200000"
            },
            attendance: 6
        },
        {
            _id: {
                $oid: "5e2b61ad346f2506963818b4"
            },
            id: "24",
            head: "Schulprojekt:<br>Erster Workshop<br><br>26.03.2020",
            body: '<br>[Der Workshop ist coronabedingt ausgefallen.]<br>Wir nehmen am Workshop "Liebe, Sex und Partnerschaft" an der Albert-Einstein-Mittelschule in Haunstetten teil.<br><br>Meldet euch vorher, wenn ihr mitmachen wollt. Kommt am besten auch zum vorherigen Planungstreffen!<br><br>Der Workshop geht von 8:00 Uhr bis 12:00 Uhr.<br>Es werden zwei 90-minütige Workshop-Einheiten gegeben. Dazwischen gibt es eine Kaffe, Tee und Brezen-Pause.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1585206000000"
            },
            attendance: "",
            planned: false,
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e34e0d80098a9532ff50d60"
            },
            id: "25",
            head: "<br>Queerer Stammtisch<br>5.2.2020",
            body: "Einmal tief einatmen. Und ausatmen. In der Klausurenphase kann jeder mal eine Verschnaufpause gebrauchen. Zum Beispiel bei unserem queeren Stammtisch! 🦄<br><br><br>Es gibt gutes und preiswertes Essen.<br>Bringt gerne Freunde und Bekannte mit! 🏳️‍🌈<br><br>Am 5.2.2020 ab 19 Uhr im Oki's.<br>(Georgenstraße 2)<br><br>🍽️🏳️‍🌈🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1580929200000"
            },
            attendance: 4
        },
        {
            _id: {
                $oid: "5e5d4bdc5536c305a217a9ee"
            },
            id: "26",
            head: "Planungstreffen:<br>Semesterprogramm<br>17.03.2020",
            body: "<br>(Fand online statt.)<br><br>Ein neues Semester steht vor der Tür!<br>Wir haben ein ausführliches Semesterprogramm vorbereitet. Es wird jede Woche ein Treffen geben und jede Woche machen wir etwas Anderes!<br><br>Am 17.03.2020 um 19 Uhr wollen wir euch das Programm vorstellen. Wir hoffen auf Feedback und würden uns freuen, wenn ihr bei einigen Terminen mitmachen würdet. :)<br><br>Wenn ihr nicht dabei sein könnt, aber trotzdem auf dem Laufenden gehalten werden wollt, meldet euch bei uns unter info@queer-augsburg.de.<br><br>Das Treffen findet im AStA statt.<br><br>Wir freuen uns auf euch!<br><br>🐣🦄☀️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1584468000000"
            },
            attendance: 12
        },
        {
            _id: {
                $oid: "5e7de6a7ad172304a78148d0"
            },
            id: "28",
            head: "Queere Stadtführung<br>Mittwoch<br>24.06.2020",
            body: "<br>Endlich ist es soweit: die erste queere Veranstaltung in Augsburg in Persona nach Corona!<br>Wir lernen unsere Stadt bei einer queeren Stadtführung in einem neuen, bunten Licht kennen!<br><br>Wir entdecken die queere Geschichte Augsburgs und versuchen von unseren Vorgängern zu lernen.<br><br>Wir treffen uns am Mittwoch, den 24.06.2020 um 19 Uhr am Rathausplatz. Bitte tragt Masken und haltet zu den anderen Teilnehmenden min. 1,5m Abstand.<br><br>Es handelt sich um eine Privatveranstaltung. Sie wird nicht vom Queerreferat der Universität Augsburg durchgeführt. Es können also maximal 10 Menschen an der Führung teilnehmen.<br>Kommt daher so pünktlich wie möglich und meldet euch vorher per Mail an.<br>(Falls noch Plätze frei sind, könnt ihr auch spontan kommen.)<br>Wir werden euch auch darum bitten, uns eure Kontaktdaten zu hinterlassen.<br><br>Wir freuen uns auf euch!<br><br>⚪🟢🔴<br>🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            planned: false,
            date: {
                $numberLong: "1593018000000"
            },
            attendance: 6
        },
        {
            _id: {
                $oid: "5e7de7bcad172304a78148d1"
            },
            id: "29",
            head: "Kennenlerntreffen<br>Dienstag<br>28.04.2020",
            body: "Neue Fragen, neue Menschen, neues Treffen! <br>Bei digitalen Brezen, Keksen und Trinken könnt ihr andere queere Menschen aus Augsburg kennenlernen!<br><br>Seid ihr im selben Harry Potter-Haus? Android oder iPhone? Was ist euer Lieblingsmöbelstück?<br><br>All das und viel mehr gibt es am 28.04.2020 ab 19 Uhr bei Queer Augsburg!<br><br><br>Ihr könnte gerne nachkommen!<br><br>🥨🍪☕",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            planned: false,
            date: {
                $numberLong: "1588093200000"
            },
            attendance: "8"
        },
        {
            _id: {
                $oid: "5e7de90cad172304a78148d2"
            },
            id: "30",
            head: "✨🎃 Buntes Abendessen 🎃✨<br>Donnerstag, 29.10.2020",
            body: "<br>Essen ist vielfältig und bunt! So vielfältig und bunt wie wir Menschen. Lasst uns deshalb gemeinsam zu Abend essen und die Vielfalt des Essens genießen. 😋<br><br><br>Kocht, was ihr wollt, und esst dann gemeinsam mit uns ab 19 Uhr über Zoom zu Abend. 🍽️<br><br>Wir freuen uns auf euch! 🤗<br><br>Link zum Zoom-Meeting:<br>[entfernt]<br><br>Falls ihr Inspiration braucht, zwei zur Jahreszeit passende Rezeptideen:<br><br>https://www.chefkoch.de/rezepte/1028921208097866/Kartoffel-Kuerbis-Pfanne.html<br><br>https://utopia.de/ratgeber/gebackener-kuerbis-grundrezept-und-variationsmoeglichkeiten/<br><br><br>🍕🥗🎃<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            planned: false,
            date: {
                $numberLong: "1603994400000"
            },
            attendance: "8",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5e7f314aad172304a78148d4"
            },
            id: "32",
            head: "Videospielabend<br>Donnerstag<br>16.07.2020",
            body: "Eine furiose Fahrt auf einer Regenbogenpiste im All, ein episches Duell in hohen Lüften, weit entfernte Planeten erkunden - Videospiele sind toll!<br>🏳️‍🌈🥊🪐<br><br><br>Noch besser sind sie, wenn man sie zusammen spielt! Lasst uns also gemeinsam Mario Kart 8, Super Smash Bros. Ultimate, Mario Party und mehr spielen!<br><br>(Ich hoffe, wir vertragen uns danach noch... . ;))<br><br>Ihr könnt gerne eigene Spiele und Controller mitnehmen.<br><br>Das Treffen wird privat um 19 Uhr in Augsburg veranstaltet. Die genaue Adresse gibt es nach der Anmeldung per Mail oder per Instagram.<br>Es dürfen nur angemeldete Menschen teilnehmen. Die Teilnehmerzahl ist auf 8 Personen beschränkt. Die Anmeldung ist bis zum 15.Juli um 12 Uhr möglich.<br><br>Möge das bessere Einhorn gewinnen! 🦄<br><br>🎮<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            planned: false,
            date: {
                $numberLong: "1594918800000"
            },
            attendance: 8
        },
        {
            _id: {
                $oid: "5f1b4c50506e4b0019c27bde"
            },
            id: "38",
            head: "Buntes Picknick<br>Mittwoch<br>29.07.2020",
            body: "<br>Sommer, Sonne, Sonnenschein! ☀️<br><br>Lasst uns gemeinsam den Abend im Wittelsbacher Park ausklingen lassen.<br>Wir treffen uns am 29.07.2020 um 19 Uhr vor dem Kongress am Park.<br>Bringt gerne Snacks, Getränke, Spiele und Decken mit!<br>🥜🃏🎴<br><br>Teilnahme nur mit vorheriger Anmeldung möglich, maximal 10 Personen.<br><br>- Paul Kunstmann<br><br>☀️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1596042000000"
            },
            planned: false,
            attendance: 10
        },
        {
            _id: {
                $oid: "5f258a8ffe40e100120c3a5a"
            },
            id: "37ionewvuin",
            head: "Klimacamp<br>4.8.2020",
            body: "Campen mitten in Augsburg - und das schon seit einem Monat! 🏕<br><br>Wir würden gerne gemeinsam mit euch<br>dem Klimacamp neben dem Augsburger Rathaus einen Besuch abstatten. Da sind nette Menschen und es gibt leckeres veganes Essen 🤗🥗<br><br>Treffpunkt ist direkt vor dem Camp<br>am Dienstag (04.08.) um 19 Uhr, aber du kannst auch gerne noch nachkommen.<br>Wir freuen uns schon!<br><br>Gebt uns kurz per Mail Bescheid, wenn ihr kommen wollt... ihr wisst schon, Corona-Regeln und maximal 10 Personen ^^",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1596560400000"
            },
            planned: false,
            attendance: "4",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f29a35b08730d0012044868"
            },
            id: "ogv84",
            head: "<br>Augsburger Hohes Friedensfest<br>Samstag 8.8.2020",
            body: "<br>Seit Jahrhunderten ist es in Augsburg Tradition, sich am 8.8. zusammenzusetzen und gemeinsam zu speisen. Man erinnert daran, dass niemand aus der Gesellschaft ausgeschlossen werden sollte, weil man eine andere Religion, Hautfarbe, sexuelle Orientierung oder geschlechtliche Identität hat. 🏳️‍🌈<br><br>Lasst uns an dieser friedensstiftenden Tradition teilhaben und uns um 16 Uhr am Dom treffen, um dann im Hofgarten ein buntes Friedenspicknick zu veranstalten! 🕊️<br>Bringt Decken, Snacks, Getränke und Spiele mit. Es wird auch Friedenstauben aus der Bäckerei geben. 🥜🎴🧺<br><br>Kommt vorbei und teilt den Frieden!<br><br>Wie immer: maximal 10 Personen und vorherige Anmeldung. :)",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1596895200000"
            },
            planned: false,
            attendance: 7
        },
        {
            _id: {
                $oid: "5f355ec169fa2a00128d367e"
            },
            id: "p8KhB",
            head: "<br>Queere Christ*innen, 14.8.2020",
            body: "<br>Am 14.August um 19 Uhr trifft sich die interkonfessionelle Gruppe Queere Christ*innen im evangelischen Gemeindehaus am Ulrichsplatz 17, Augsburg.<br><br>Die Teilnehmenden sind bi-, trans-, homo- und/oder asexuell jeden Alters und haben Lust, gemeinsam, in ganz unterschiedlicher Nähe und Ferne zur Kirche, ihren Glauben zu erkunden, zu leben und ihren Platz in der Kirche zu gestalten.<br><br>Mehr Infos und Details auf https://qcaux.de/",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1597424400000"
            },
            planned: false
        },
        {
            _id: {
                $oid: "5f355f6869fa2a00128d367f"
            },
            id: "EpBng",
            head: "Spieleabend<br>Montag<br>17.08.2020",
            body: "<br>Mensch ärgere dich nicht, Risiko und Monopoly. ♟️<br>Arschloch, Schafkopf und Durak. 🃏<br><br>Es gibt viele Spiele, lasst sie uns gemeinsam spielen!<br><br>Wir treffen uns um 19 Uhr am Ulrichsplatz 17. Bringt gerne eure eigenen Brett- sowie Kartenspiele, Snacks und Getränke mit, damit wir uns alle einen schönen Abend machen können! Wir freuen uns schon, euch zu sehen! 🤗<br><br>Wie immer mit Anmeldung und maximal 10 Personen! 😇",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1597683600000"
            },
            planned: false,
            attendance: 8
        },
        {
            _id: {
                $oid: "5f3e7c4d74bfd100122ef80b"
            },
            id: "7c2Rw",
            head: "Kneipentour<br>Donnerstag 27.08.2020",
            body: "Am Donnerstag, den 27.08.2020 möchten wir mit euch eine Kneipentour veranstalten. Ob ihr Absinth Liebhaber seid oder doch lieber zur Saftschorle greift, stürzt euch mit uns ins Abenteuer!<br><br>Wir starten den Abend um 19:00 Uhr in der Haifischbar wo es leckere Burger und Getränke aller Art gibt. 🦈🍔<br>Weiter geht es mit gehobener Atmosphäre in der Bar 3M in der Maxstraße. Auf einen Dresscode verzichten wir ausnahmsweise.<br>Anschließend geht es wieder steil bergab, in die schöne Altstadt. Wir werden verschiedene Kultstätten besuchen, die man in Augsburg keinesfalls missen sollte. Es wird für jeden Geschmack etwas dabei sein.<br>Für die hart gesottenen wird es zum Abschluss noch in das wahre Juwel der Stadt gehen, wo wir den Abend ausklingen lassen und die ersten Sonnenstrahlen genießen möchten.<br>Tipp: Die Lokalität trägt den Namen eines beliebten deutschen Laugengebäcks.<br><br>Ride or die!<br>Nina &amp; Paul 0<br>🖤<br><br><br>Maximal 10 Personen und Anmeldung via Mail oder Nachricht an Kai.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1598547600000"
            },
            planned: false,
            attendance: "10"
        },
        {
            _id: {
                $oid: "5f537d3531207a001289a3bb"
            },
            id: "tYbIv",
            head: "Stadtspaziergang<br>10.09.2020",
            body: "Klaviere in der Stadt, ein Kettenkarussell und bunte Rahmen. Es gibt viel zu sehen in der Augsburger Innenstadt!<br>Lasst uns gemeinsam durch die Stadt spazieren und einen schönen Abend haben!<br>🎹🎠🖼️<br><br>Treffpunkt ist 19 Uhr vor dem Rathaus.<br><br>Mit Anmeldung und maximal 10 Personen. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1599757200000"
            },
            planned: false,
            attendance: 8
        },
        {
            _id: {
                $oid: "5f5ba61534ebf75e21b45f1d"
            },
            id: "iofd8",
            head: "Kreatives Schreiben<br>8.5.2020",
            body: '<br>Lasst uns in die Tasten hauen! ⌨️<br><br>Egal ob ihr bereits Hobbyautoren seid oder noch ganz "unbeschrieben" - bei unserer digitalen Schreibwerkstatt könnt ihr all euren Ideen freien Lauf lassen. 💡 🖋️<br><br>Es gibt verschiedene Schreibstationen zum Ausprobieren. Wer Lust hat, kann sich auch mit anderen über das eigene Geschreibsel unterhalten und auch zusammen am Text arbeiten.<br><br>Wäre sehr cool, wenn ihr 8.5.2020 ab 19 Uhr dabei seid!<br>Den Link zu unserem Discord-Server posten wir kurz vor dem Treffen auf der Website.<br>Wer will, kann auch gerne nachkommen 😁<br><br>⌨️✍️✒️',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1588957200000"
            },
            planned: false,
            attendance: "9",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f5ba63134ebf75e21b45f1e"
            },
            id: "Ldfor",
            head: "Programmieren für Anfänger<br>13.05.2020<br><br>",
            body: "Wolltet ihr schon immer richtig coole Hacker sein? Grüne Zahlen auf schwarzem Bildschirm. Einsen und Nullen fliegen hin und her. Ein Knopfdruck und das Geld kommt aus dem Automaten?<br>👨‍💻<br><br>01010001 01110101 01100101 01100101 01110010 00100000 01000001 01110101 01100111 01110011 01100010 01110101 01110010 01100111<br><br><br>Wir helfen euch dabei, den Einstieg in die logisch-strukturierte Welt der Zahlen zu finden. Ohne Vorkenntnisse könnt ihr bei uns einfaches Programmieren lernen.<br><br>Mit Hilfe von Javascript und p5js bauen wir wundervolle bunte Welten. Die Möglichkeiten sind unbegrenzt! Fliegende Einhörner, ein springender Donut und sich drehende Gurken. Baut, was ihr wollt!<br><br>Das Treffen findet am 13.05.2020 um 19 Uhr statt. Ihr könnt gerne nachkommen. Der Einladungslink zur Discord-Gruppe wird kurz vor Beginn des Treffens auf der Seite gepostet.<br><br>Es ist möglich, dem Server nur für das Programmieren für Anfänger zu joinen. Ihr braucht keinen festen Account.<br>🐰<br><br>Alle sind willkommen! 🤗<br><br>🦄🍩🥒<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1589389200000"
            },
            planned: false,
            attendance: "4",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f61e3367183110012a2502a"
            },
            id: "DWPCl",
            head: "Queere Christ*innen<br>Freitag<br>18.September<br>",
            body: "<br>Diese Woche geht es am Freitag um 19 Uhr zu den Queeren Christ*innen ins evangelische Gemeindehaus am Ulrichsplatz 17!<br><br>Dir Teilnehmenden erkunden ihren Glauben, tauschen sich über über das Kirchenleben aus und singen gemeinsam Lieder.<br><br>Kommt vorbei!<br><br>🏳️‍🌈✝️<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1600448400000"
            },
            planned: false,
            attendance: "9"
        },
        {
            _id: {
                $oid: "5f61e3d47183110012a2502b"
            },
            id: "73mQ3",
            head: "Filmabend: KISS ME KOSHER<br>Mittwoch<br>23.September",
            body: '<br>Wir gehen ins Thalia Kino (Obstmarkt 5) und schauen uns die Culture Clash Komödie KISS ME KOSHER an!<br>Es geht um die Liebesgeschichte einer Deutschen und Israelin. Auf humorvolle und liebevolle Art wird das Aufeinanderprallen der beiden unterschiedlichen Kulturen thematisiert.<br>Der Film wurde maßgeblich von queeren Menschen mitproduziert. Außerdem wurde er auch schon beim CSD München und CSD Stuttgart gezeigt und begeistert aufgenommen. 🇮🇱🏳️‍🌈🇩🇪<br><br>Der Film geht um 18:45 Uhr los. Für den Film braucht ihr euch nicht bei uns anmelden. Es reicht aus, wenn ihr euer Ticket selbst online bucht und dann vorbeikommt:<br><a rel="noreferrer" href="https://kinotickets.online/augsburg-thalia/booking/28903">Ticket buchen</a><br><br><br>Nach dem Film gehen wir um circa 21:30 Uhr zusammen ins Oki\'s. Wir tauschen uns über den Film aus, spielen Kartenspiele und lassen den Abend gemütlich ausklingen.<br><br>Für das Oki\'s bitte bei uns anmelden! Dort sind maximal 10 Personen erlaubt. 🤗<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1600879500000"
            },
            planned: false,
            attendance: "15"
        },
        {
            _id: {
                $oid: "5f61e4387183110012a2502c"
            },
            id: "wW3Tb",
            head: "Café Tür an Tür<br>Mittwoch<br>30. September",
            body: "<br>Zum Abschluss des Septembers gehen wir um 19 Uhr zum Café Tür an Tür. (Wertachstraße 29)<br>Das Café ist ein offener kultureller und sozialer Treffpunkt und ein Impuls für Engagement und Vielfalt in der Stadt.<br>Zeit, dass auch etwas queerer Feenstaub im Café verteilt wird! ✨🧚‍♀️🏳️‍🌈<br>Helft mit und kommt vorbei! 🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1601485200000"
            },
            planned: false,
            attendance: "8"
        },
        {
            _id: {
                $oid: "5f61fb617183110012a2502e"
            },
            id: "3qRWY",
            head: "✨🏳️‍🌈 Kennenlerntreffen 🏳️‍🌈✨<br>Donnerstag, 12.11.2020",
            body: 'Lerne andere queere Menschen kennen,<br>knüpfe Kontakte zu anderen Studierenden<br>und werde Teil der queeren Community in Augsburg!<br><br>Wir veranstalten ein digitales Kennenlerntreffen!<br><br><br>Offizieller Beginn ist um 19 Uhr. Wir warten aber ein "Queeres Fünfminütchen" auf alle, die nachkommen. (Ihr könnt gerne auch etwas später nachkommen. ;))<br><br>Dann stellen wir uns kurz vor und spielen einige kleine Spiele. Zunächst in der großen Runde, dann in kleinen Breakoutrooms. Anschließend lernen wir uns in Zweier-Gruppen kennen. Wir finden heraus, ob unser Gegenüber Pizza mit Ananas mag und welchen Artikel sie*er für Nutella bevorzugt. Danach beenden wir die Veranstaltung offiziell, bieten aber noch den Raum, uns weiter kennenzulernen.<br><br>Ihr könnt gerne mit zwei Personen an einem PC teilnehmen. Das lockert die Stimmung auf, man kommt mehr aus sich heraus und alle haben Spaß. :D<br><br>Wir freuen uns auf euch! 🤗🏳️‍🌈<br><br>[Link entfernt]<br><br>Es ist keine Anmeldung erforderlich.<br>Bei Fragen und technischen Problemen bitte eine Mail schreiben.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1605204000000"
            },
            planned: false,
            attendance: "32",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f61fcfa7183110012a2502f"
            },
            id: "F7XIk",
            head: "✨🎄 Weihnachtsfest 🎄✨<br>Donnerstag, 17.12.2020",
            body: "<br>Plätzchen, Glühwein und gemütliches Beisammensein - es ist Weihnachtszeit! 🎄<br><br>Lasst uns dieses besinnliche Fest gemeinsam über Zoom feiern. Es geht am Donnerstag, den 17.12.2020 um 19 Uhr los. Wir blicken auf das vergangene Jahr zurück, hören eine kleine Weihnachtsgeschichte und spielen weihnachtliche Spiele in gemütlicher Atmosphäre. 🦌<br><br>Mit dabei sind auch die Queeren Christ*innen. Wir freuen uns auf ein gemeinsames großes Fest! 🍪<br><br>Der Link zum Treffen:<br>[Entfernt]<br><br>🎅🎄🎁🍪❄️🦌🤶<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1608228000000"
            },
            planned: false,
            attendance: "35",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f6ca81f05270400124f0486"
            },
            id: "BLr1p",
            head: "Ideenwerkstatt<br>Dienstag<br>29.09.2020",
            body: "<br>  Lasset die Ideen sprudeln!<br>⛲<br>Sagt uns, was ihr für Treffen bei Queer Augsburg haben wollt.<br><br>Eislaufen, Museen, Schreibwerkstatt, Workshops, Aufklärung, Debatten, Vorträge, Basteln, und vieles mehr: die Möglichkeiten sind unbegrenzt!<br>⛸️🏛️✍️🔧💬🗣️🎀<br><br>Gestaltet eure lokale queere Gruppe mit und schafft unvergessliche Erinnerungen.<br>🏳️‍🌈<br>Wir freuen uns auf euch!<br><br>Das Treffen findet digital um 19 Uhr auf unserem Discord-Server statt.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1601398800000"
            },
            planned: false,
            attendance: "7"
        },
        {
            _id: {
                $oid: "5f6ca9f205270400124f0487"
            },
            id: "FrqlN",
            head: "Improtheater<br>Donnerstag<br>08.10.2020",
            body: "Wie repariert man mit einem Fisch ein Fahrrad? 🐟🔧🚲<br><br>Beim Improvisationstheater entstehen die witzigsten Geschichten!<br>Wir werden uns erst mit ein paar grundlegenden Übungen einspielen<br>und dann coole Szenen auf die Bühne bringen. 🎉🎭<br><br>Egal ob Vorerfahrung oder nicht, jeder kann dabei sein!<br><br>Ab 19 Uhr im Projektraum, Wolfgangstraße 2!<br>Bitte mit vorheriger Anmeldung per Mail.<br>Maximal 10 Personen. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1602176400000"
            },
            planned: false,
            attendance: "10",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f72f7713d048b00130c185a"
            },
            id: "shkuu",
            head: "Queere Christ*innen<br>Freitag<br>16.10.2020",
            body: "<br>Am Freitag um 19 Uhr treffen sich die Queeren Christ*innen im evangelische Gemeindehaus am Ulrichsplatz 17!<br><br>Wir erkunden unseren Glauben, tauschen uns über über das Kirchenleben aus und singen gemeinsam Lieder.<br><br>Kommt vorbei!<br><br>🏳️‍🌈✝️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1602867600000"
            },
            planned: false,
            attendance: "15",
            rClosing: null,
            rLimit: null,
            registrationRequired: false
        },
        {
            _id: {
                $oid: "5f89d11bf2268800126d8a4a"
            },
            id: "qEnNd",
            head: "Among Us<br>Donnerstag, 22.10.2020",
            body: "Eine Gruppe von queeren Regenbogenalpakas macht sich auf die Reise zum fernen Planeten Queertopia. 🌈🦙<br><br>Alles scheint gut zu gehen... Doch unter uns sind fiese queerphobe Killer-Einhörner! 😬🦄<br><br>Macht mit bei unserer Reise ins Paradies!<br><br>Ab 19 Uhr auf unserem Discord-Server.<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1603386000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "5f96e292f2268800126d8a51"
            },
            id: "T9Ko5",
            head: "Bavarian Queerentine Gaming Day<br>Mittwoch, 18.11.2020<br>🎮🤍💙",
            body: "Gemeinsam mit vielen queeren Organisationen aus ganz Bayern spielen wir Among Us und scribbl.io und tauschen uns in gemütlicher Atmosphäre aus.<br><br>Mit dabei sind die Queerreferate der LMU, der FAU (Erlangen) und der HM (München), die Jugendgruppen Bonito Allgäu (Kempten), Not in Range (Ingolstadt), Jung und Gleich (Regensburg), Rainbows (Aschaffenburg) und DéjàWü (Würzburg) und die beiden Veranstalter des Treffens: Kunterbunt Amberg und die Jugendinitiative Fliederlich (Nürnberg).<br><br>Wir freuen uns auf die bayernweite Vernetzung und danken allen Organisationen und insbesondere den Veranstaltern vielmals für diese wundervolle Kooperation!<br><br>Das Treffen geht von 16 bis 22 Uhr und findet auf dem Discord-Server von Kunterbunt Amberg statt. Den Link findet ihr auf unserem Discord-Server:<br>https://discord.gg/kRzP9VE<br><br>Es ist keine Anmeldung erforderlich. Ihr könnt jederzeit kommen und gehen. Bei technischen Problemen bitte eine Mail schreiben.<br><br>Wir freuen uns auf euch! 🤗<br><br>🎮🤍💙",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1605722400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "50"
        },
        {
            _id: {
                $oid: "5fa15caa72688b0012b8c492"
            },
            id: "d82aF",
            head: "✨💡 Ideenwerkstatt 💡✨<br>Donnerstag, 05.11.2020",
            body: "<br>Queer Augsburg ist nun Teil des Projektraums. Wir können diesen Raum regelmäßig für Treffen nutzen. Normalerweise jeden zweiten Donnerstag um 19 Uhr. 🏳️‍🌈<br><br>Der Raum bietet uns auch die Möglichkeit, einen aktiven Beitrag zur Stadtteilentwicklung des Viertels Rechts-der-Wertach leisten. Wir können die Plätze des Viertels beleben, Kooperationen mit anderen Organisationen starten und vieles mehr! Lasst uns Ideen dafür sammeln, wie wir den Raum am besten nutzen können und welche Projekte wir umsetzen wollen. 💡<br><br>Bringt eure Ideen ein und gestaltet den Stadtteil mit! 🤗<br><br>Das Treffen findet auf Zoom um 19 Uhr statt. Zoom-Link:<br>[Link entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1604599200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "5fac0e24796d570012344c4d"
            },
            id: "EoUE7",
            head: "✨📜 Queer History 📜✨<br>Mittwoch, 25.11.2020",
            body: "<br>Hii, am 25.11 um 19 Uhr findet der Queer History Abend statt! 🎉<br><br>Worum geht's?<br><br>Hast du in der Schule etwas über Queer History oder über bedeutende queere Menschen in der Geschichte erfahren?<br><br>Ich rate einfach mal: wahrscheinlich nicht. Ich auch nicht. Das finde ich ziemlich schade und deswegen hatte ich Bock darauf, dass wir das alle zusammen nachholen ☺️<br><br>Jede*r, der*die Lust und Laune hat, kann einfach seinen*ihren liebsten queeren Menschen oder ein Thema aus der Queer History vorstellen und damit einen Beitrag dazu leisten, dass wir alle fortan Geschichte ein Stück bunter 🏳️‍🌈 sehen können :)<br><br>Ihr könnt auch einfach zuhören, ohne große Vorbereitung.<br><br>[Zoom-Link entfernt]<br><br>Wir freuen uns auf dich!<br><br>☺️🏳️‍🌈📜📚",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1606327200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "5fac0e67796d570012344c4f"
            },
            id: "OHCIA",
            head: "❤️🎗️ Welt-AIDS-Tag 🎗️❤️<br>Donnerstag, 03.12.2020",
            body: "<br>Zwischen Stigmatisierung, Aufklärung und Therapie: Anlässlich des Welt-AIDS-Tages ist Laura vom Augsburger AIDS-Hilfe e.V. bei uns zu Besuch. Nach einer kurzen Vorstellungsrunde und einer Einführung von Laura in die Thematik schauen wir einen kurzen informativen Clip und widmen uns anschließend einer Diskussionsrunde mit Q&amp;A.<br>Danach lassen wir den Abend wie gewohnt open end ausklingen.<br><br>Zoom-Link:<br>[Entfernt]<br><br>Ihr findet den Link auch in unserer Insta-Bio kurz vor Beginn des Treffens um 19:00 Uhr.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1607018400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "5fb2de426cdb4f0012dabe34"
            },
            id: "9PJhI",
            head: "✨✝️ Queere Christ*innen ✝️✨<br>Freitag, 20.11.2020",
            body: "Die Queeren Christ*innen treffen sich am 20.11.2020 um 19 Uhr online auf Jitsi! Ihr könnt dem Treffen unter folgendem Link beitreten:<br>https://meet.jit.si/qcaux<br><br>Kommt vorbei!<br>🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1605895200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "5fb2dee36cdb4f0012dabe36"
            },
            id: "Zgsoi",
            head: "Andacht zum Weltaidstag<br>Dienstag, 01.12.2020<br>⛪",
            body: "Die Queeren Christ*innen veranstalten in St.Ulrich am 1. Dezember 2020 ab 19 Uhr eine Andacht zum Weltaidstag.<br><br>Ihr könnt gerne mit dabei sein!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1606845600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "5fb814df6cdb4f0012dabf47"
            },
            id: "hvtoG",
            head: "Auszeit zwischen den Jahren<br>27.12.2020 bis 29.12 2020<br>❄️",
            body: 'Die Queeren Christ*innen veranstalten zum Ausklang des Jahres drei gemeinsame besinnliche Tage.<br><br>Meldet euch unter<br><a href="mailto:bernhard.offenberger@elkb.de">bernhard.offenberger@elkb.de</a>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1609059600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "5fbae7ff25c95900120ecf0f"
            },
            id: "ABPRW",
            head: "🏳️‍🌈💡Ideenwerkstatt 💡🏳️‍🌈<br>Donnerstag, 10.12.2020",
            body: "Das alte Jahr neigt sich dem Ende zu.<br>Und was steht im neuen Jahr an? 🤔🎁<br>Lasst es uns gemeinsam herausfinden!<br><br>Wir setzen uns ab 19 Uhr per Zoom zusammen.<br>Gemeinsam entwickeln wir Ideen und Pläne für weitere Treffen.<br>Ob spontaner Einfall oder ausgeklügeltes Konzept, wir freuen uns über alle Beiträge. 💡😊<br><br>Du denkst, dir fällt nichts zu weiteren Treffen ein?<br>Dann sei trotzdem dabei! Du kannst schonmal spitzeln, was im nächsten Jahr so alles läuft.<br>Und deinen Senf dazugeben. 💬<br><br>Hier geht es zum Zoom-Meeting:<br>[Link entfernt]<br><br>Den Link findest du kurz vorher auch noch in unserer Insta-Bio.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1607623200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "5fc918b8f2495e00129aff44"
            },
            id: "eMJDl",
            head: "✨🎮 South German 🎮✨<br>Queerentine Gaming Day<br>Samstag, 02.01.2021",
            body: "Vergiss Quarantäne - komm in die Queerentine! 🏳️‍🌈🎮<br><br>Für alle, die das neue Jahr spielend beginnen wollen, haben wir etwas: Die Jugendinitiative Fliederlich und Kunterbunt Amberg rufen am 02.01.2021 zum South German Queerentine Gaming-Day (SGQGD) auf.<br><br>Queer Augsburg ist da selbstverständlich dabei! 🙌<br><br>Auch mit dabei: DéjàWü (Würzburg), Bonito (Kempten) Not IN Range (Ingolstadt), Rainbows Aschaffenburg, Jung und Gleich (Regensburg), WuF-Zentrum (Würzburg), Panda Bayern und die Queerreferate der LMU, FAU (Nürnberg) und HM (München).<br><br>Nimm an den virtuellen Spielrunden von Among Us, Skribble.io, Cards against Humanity oder Jackbox teil.<br><br>Triff alte Freunde und knüpfe neue Kontakte zu anderen Menschen aus ganz Deutschland.<br><br>Komm zu unserer verlängerten Neujahrsparty! Es ist keine Anmeldung erforderlich. Wir freuen uns auf deine Teilnahme.<br><br>Wann: 02.01.2021, 15 - 22 Uhr<br>Wo: http://discord.gg/sWkeFBb<br>Für mehr Informationen: sgqgd.de<br><br>Bei weiteren Fragen kannst du dich gerne an uns wenden.<br><br>🏳️‍🌈🎮❄️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1609610400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "40"
        },
        {
            _id: {
                $oid: "5fcd6f80f2495e00129b0038"
            },
            id: "YC5l0",
            head: "CSD München<br>Samstag, 11.07.2020",
            body: "Der CSD München lebt und ihr könnt dabei sein! 🏳️‍🌈<br><br>In der ganzen Stadt verteilt wird es Demo-Spots geben, wo jeweils eine queere Organisation protestieren darf. Wir haben zwar keinen eigenen Spot, können unsere Mitstreiter aber mit eigenen Schildern, bunten Farben und Glitzer unterstützen! ✨<br><br>Wir werden in mehreren Gruppen unterwegs sein. Eine Gruppe besteht maximal aus 10 Personen. Die Gruppen werden sich nicht mischen.<br><br>Meldet euch bis zum 9.Juli an, um sicher dabei zu sein. Ihr könnt euch per Mail oder Insta bei uns melden.<br><br>Der Protest wird von 12 bis 15 Uhr gehen. Wir werden daher mit den Zügen um 11:06 Uhr und 12:06 Uhr fahren. Treffpunkt ist jeweils 20 Minuten vorher am Hbf. Wann ihr zurückfahrt, könnt ihr selbstständig in der Gruppe entscheiden.<br><br>Wir freuen uns darauf, dich noch mit euch auf einen CSD fahren zu können. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1594458000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "5fefa64d273c4500132fe365"
            },
            id: "CiCWc",
            head: "🚪 Gatekeeping 🚪<br>in der queeren Community<br>Donnerstag, 14.01.2021",
            body: "How can we do better? Zwischen Gatekeeping und Awarenessweeks: Bi+feindlichkeit und Trans*feindlichkeit in der queeren Community und wie man sie behandelt.<br><br><br>Als Gatekeeping bezeichnet man den Ausschluss von Personen aus den Schutzräumen der Communities.<br><br>Gatekeeper*innen postulieren die Norm, dass man einer bestimmten Definition zu entsprechen, sich auf eine bestimmte Art verhalten  müsse, um Teil einer Gruppe sein zu können. So werden Bi+Sexuelle nur als Allies oder Phasengänger deklariert und aus LGBT-Gruppen gedrängt oder trans*Personen vorgeschrieben, wie sie transitionieren müssen, um „richtig/echt/genug trans“ zu sein.<br><br>Heute wollen wir mit euch über die Vorurteile über Bi+Sexualität und trans*Sein sowie das damit verbundene Gatekeeping in der queeren Community reden, eure eigenen Erfahrungen einbinden und diskutieren wie wir die Community für einen besseren Schutzraum für uns alle gestalten können.<br><br>Q&amp;A-Session ab 19 Uhr auf Zoom. Danach wie gewohnt open end. Keine Anmeldung erforderlich.<br><br>Link:<br><br>[entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1610647200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "24"
        },
        {
            _id: {
                $oid: "5fefa698273c4500132fe36a"
            },
            id: "r4Tsq",
            head: "✨💄Grundkurs Schminken 💄✨<br>Donnerstag, 21.01.2021",
            body: "Am Donnerstag lernen wir ab 19 Uhr auf Zoom die Basics im Schminken. Wie deckt man Pickel und Augenringe ab? Wie verwendet man Foundation, Concealer und Lidschatten? 💄<br>Ein lustiges Treffen, bei dem vieles schief gehen kann, viel gelacht werden wird und ihr doch noch etwas lernt, erwartet euch. 🤗<br><br>Ihr könnt jede Schminke benutzen, die euch zur Verfügung steht. Ihr braucht auch nicht alles zu besorgen. Es reicht, was ihr auch wirklich verwenden wollt. 😇<br><br>Unsere Empfehlungen findet ihr relativ günstig bei den örtlichen Drogeriemärkten:<br>Foundation: Perfect Match von L’Oreal<br>Puder: “All about matt!” Fixing Compact Powder, essence<br>oder Perfect Match, Hautton anpassendes Puder<br>Lidschatten Palette: “Ultimate shadow palette”, Warm neutrals<br>oder Lidschatten Eyestudio Nudes Palette<br>Concealer: Maybelline “Fit Me”<br>Augenbrauen: Terra Naturi Browgel<br>und Augenbrauen Puder<br>Mascara: Maybelline Colossal Volume Express<br>Pinsel: Spuli für Augenbrauen und Beauty Blender in DM<br>Lippen: NYX Professional Lipliner Nude<br>und einen einfachen Labello<br>Abschinken: Reinigungsöl von Nivea mit Macadamia Öl<br>und Neutrogena Hydroboost<br><br>(Bitte keine Abschminktücher kaufen! Sie schaden der Haut und der Natur!)<br><br>Link:<br>[Entfernt]<br><br>Keine Anmeldung erforderlich!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1611252000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "5fefa6cf273c4500132fe36c"
            },
            id: "muzwC",
            head: "Sexuelle Belästigung von Frauen<br>Donnerstag, 28.01.2021",
            body: "<br>❗Triggerwarnung: Gewalt gegenüber Frauen, sexualisierte Gewalt, Sexismus, Hate Speech und Diskriminierung ❗<br><br><br>Gewalt tritt im Alltag in vielen unterschiedlichen Formen auf. Sexuelle Belästigung ist nur eine davon.<br>Die Rollenverteilung und Vorstellungen von Männer und Frauen spielen bei Gewalt an Frauen und alle, die als solche gelesen werden eine wesentliche Rolle.<br><br>Wir wollen laut werden und uns gegen Gewalt und Diskriminierung aussprechen. Aufklärung ist der erste Schritt und diesen möchten wir gerne mit euch gehen. Im Rahmen des Vortrages setzen wir uns mit dem Thema „Sexualisierte Gewalt gegen Frauen“ auseinander und richten den Fokus hierbei auf den ganz „normalen“ Alltag.<br>Das erwartet euch:<br><br>~&gt; Klärung Gewaltbegriff<br>~&gt; wer erfährt Gewalt<br>~&gt; Formen von sexueller Gewalt<br>~&gt; sexuelle Gewalt im Alltag<br>~&gt; strukturelle Gewalt<br>~&gt; das kannst du tun<br><br>Keine Anmeldung erforderlich. Ab 19 Uhr.<br>Wie immer findet ihr den Link auf der Website und in unserer Instagram-Bio.<br><br>Link:<br>[Entfernt]<br><br>❗️Bitte nehmt nur Teil, wenn ihr euch *emotional gefestigt* genug fühlt, um mit dieser Thematik umzugehen. Wir können keine Aftercare leisten, da wir keine psychologische oder therapeutische Ausbildung haben. Aber wir geben euch im Anschluss an den Vortrag gerne Hilfestellen an die Hand, die euch professionell betreuen können❗️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1611856800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "19"
        },
        {
            _id: {
                $oid: "5fefa740273c4500132fe36e"
            },
            id: "YhNyF",
            head: "Internationales Vernetzungstreffen<br>Donnerstag, 04.02.2021<br>🇩🇪🇦🇹🇨🇭",
            body: "Weit weg und doch nah - das Internet macht es möglich! Wir nutzen die Isolation, um ungeahnte Gemeinschaften zu schaffen.<br><br>Diesen Donnerstag trifft sich Queer Augsburg um 19 Uhr mit queeren Gruppen aus dem deutschsprachigen Ausland auf Zoom. Mit dabei sind die HoSi-Jugend aus Wien, die Milchjugend aus Zürich und die Königskinder aus Stuttgart.<br><br>Es wird eine lockere Runde, bei der wir uns kennenlernen und einen kleinen Beitrag zur Völkerverständigung leisten.<br><br>Keine Anmeldung erforderlich.<br><br>Link:<br>[Entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1612461600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "36"
        },
        {
            _id: {
                $oid: "5fefa7e6273c4500132fe373"
            },
            id: "wYTaq",
            head: "Strategie- und Richtungstreffen 2<br>Donnerstag, 11.02.2021<br>💡💡",
            body: "<br>Was ist die Zukunft von Queer Augsburg?<br><br>Beim ersten Treffen Anfang Januar haben wir uns intensiv mit unseren Stärken und Schwächen und mit Chancen und Risiken für unsere Gruppe auseinandergesetzt. Aus diesen Überlegungen haben sich vier Ziele herauskristallisiert:<br><br>Wir brauchen mehr Struktur! Wir brauchen klare Zuständigkeiten und konkrete Ansprechpartner. Die Struktur soll transparent, durchlässig und effektiv sein. Eine Vereinsgründung könnte dieses Problem lösen. Wir werden eine Vereinsgründung kritisch beleuchten und jemanden dabeihaben, der Erfahrung mit Vereinsgründungen gemacht hat und Zeit und Lust hat, sich unseren Fragen zu stellen.<br><br>Wir wollen uns Vernetzen! Wir können sehr viel von anderen queeren Gruppen lernen, insbesondere von Münchener Gruppen. Mit welchen Gruppen sollen wir uns worüber näher austauschen?<br><br>Wir wollen auf uns aufmerksam machen! Wir brauchen mehr Werbung. Sticker, Flyer, Plakate, eigenes Merch? Welche Werbung macht Sinn und bringt uns am meisten neue Besucher*innen?<br><br>Wir wollen innovativ sein! Wir sind vielfältig und wollen unsere Fähigkeiten bestmöglich nutzen. Welche neuen Gruppen und Formate sollten wir ins Leben rufen?<br><br>Gestalte Queer Augsburg mit! 🏳️‍🌈<br>Du brauchst keinerlei Vorbereitung oder Vorwissen, um mitzumachen. Es ist keine Anmeldung erforderlich. 🤗<br><br>Ab 19 Uhr auf Zoom.<br><br>Link:<br>[Entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1613066400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "5fefa827273c4500132fe375"
            },
            id: "k5Txy",
            head: "Queer Africa: An Introduction<br>🇿🇦🏳️‍🌈<br>Thursday, Feb 18<br>7 pm CET on Zoom",
            body: "The presentation is a concise introduction to the idea of queerness in Africa and how as a concept it is uniquely situated aside from traditional queer articulation.<br><br>It will explore how queerness has always existed within African practices and traditions. Additionally this presentation will discuss how in a globalised and western centric world the fight for queer African rights has been pursued, is currently being pursued and what steps can be taken the better advocate for the queer African agenda.<br><br>THE PRESENTATION WILL BE ENTIRELY IN ENGLISH. 🇬🇧🇺🇸<br><br>Thank you very much for your presentation, Lusyomo! 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1613671200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "5fefa9c7273c4500132fe37b"
            },
            id: "k3K8D",
            head: "♂️ Toxische Männlichkeit ♂️<br>Donnerstag, 25.02.2021",
            body: "<br>「Toxische Männlichkeit」<br>am 25. Februar um 19:00 Uhr [online]<br><br>Lasst uns über 「Toxische Männlichkeit」sprechen und im Dialog gemeinsam Fragen klären:<br><br>Was ist eigentlich 「Toxische Männlichkeit」?<br>Was ist euer Bild von Männer und Männlichkeit?<br>Hab ihr schon mal etwas über Incels gehört?<br>Welche Klischees, traditionelle Rollenbilder und Stereotypen kennt ihr?<br><br>Lasst uns über eure eigenen Erfahrungen sprechen!<br><br>Es ist keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an<br>mail@queer-augsburg.de<br>oder per Nachricht auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1614276000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "5ff49d16273c4500132fe483"
            },
            id: "WIhbu",
            head: "Strategie- und Richtungstreffen 1<br>Donnerstag, 07.01.2021<br>💡",
            body: "<br>Was ist die Zukunft von Queer Augsburg? Wo steht unsere Gruppe? Und wo wollen wir hin?<br><br>In einer Reihe von monatlichen Treffen wollen wir diese Fragen beantworten. Los geht es am Donnerstag ab 19 Uhr auf Zoom.<br><br>Im ersten Schritt halten wir fest, welche Stärken und Schwächen unsere Gruppe hat. Dann suchen wir in unserem Umfeld nach Chancen und Risiken für Queer Augsburg. Anschließend führen wir die Ergebnisse zusammen und entwickeln realistische Ziele. Zuletzt überlegen wir uns erste Strategien, wie wir diese Ziele umsetzen können.<br><br>Gestaltet Queer Augsburg und macht die Gruppe zu dem, was ihr wollt! 🏳️‍🌈<br>Ihr braucht keinerlei Vorbereitung oder Vorwissen, um mitzumachen. Es ist keine Anmeldung erforderlich. 🤗<br><br>Link:<br>[Entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1610042400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "5ffc5b70273c4500132fe630"
            },
            id: "9PIF3",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 26.01.2021",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br><br>Link:<br>[Entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1611684000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "5ffc5bf5273c4500132fe633"
            },
            id: "N0sEj",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 09.02.2021",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br><br>Link:<br>[Entfernt]",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1612893600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "5ffc5c1a273c4500132fe635"
            },
            id: "hIveh",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 23.02.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1614103200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "5ffc5ccb273c4500132fe638"
            },
            id: "mxsKF",
            head: "DACH-Vernetzungstreffen<br>Donnerstag, 11.03.2021<br>🇩🇪🇦🇹🇨🇭",
            body: "Nach Augsburg ist nun Wien mit der Ausrichtung des Vernetzungstreffens an der Reihe. Vertreter*innen aller deutschsprachiger LGBTIQ* Organisationen sind herzlich eingeladen bei diesem Austausch teilzunehmen. Nach einer Kennenlernrunde werden wir in thematische Breakout-Rooms gehen, um uns inhaltlich besser austauschen zu können. Bisherige Themenvorschläge sind:<br><br>Pride: Politik oder Party? 🏳️‍🌈🔻<br>Queere Musik – Welche Künstler*innen sind queer oder queere Icons? 🎵<br>Das Stadtlandgefälle. Wie ises eigentlich auf dem Dorf so?🏘️🌆<br>Sommerpläne – Wo geht ihr so hin? 🌞<br><br>Das Ganze findet am 11. März um 19:00 Uhr via Zoom statt. Link auf Anfrage per Mail oder PN auf Instagram. Keine Anmeldung erforderlich.<br><br>Wir freuen uns auf euch!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1615485600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "38"
        },
        {
            _id: {
                $oid: "5ffc5cf0273c4500132fe63a"
            },
            id: "Ah2rW",
            head: "🟢 Queer Augsburg Meet 🟢<br>mit Pubquiz zum Weltfrauentag ♀️<br>Dienstag, 09.03.2021",
            body: "Anlässlich des Weltfrauentages am 08.03. haben wir ein Pubquiz dazu vorbereitet! Seid gespannt! ♀️<br><br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1615312800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "5ffcd96c273c4500132fe656"
            },
            id: "jyBVS",
            head: "✨✝️ Queere Christ*innen ✝️✨<br>Freitag, 15.01.2021",
            body: "Das erste Treffen der Queeren Christ*innen im neuen Jahr! Kommt vorbei und tauscht euch mit Gleichgesinnten aus.<br><br>Ab 19 Uhr auf Jitsi. Keine Anmeldung erforderlich.<br><br>Link: https://meet.jit.si/qcaux",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1610733600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "6007617e38dbfc00152c8fb7"
            },
            id: "IpCff",
            head: "Strategie- und Richtungstreffen 3<br>Donnerstag, 18.03.2021<br>ab 19 Uhr auf Zoom<br>💡💡💡",
            body: "Wir wollen für Queer Augsburg Werte und Zwecke festlegen, die wir als Grundlage unserer Gruppe erachten.<br><br>In einem ersten Schritt definieren wir, was Werte und Zwecke grundsätzlich sind. Dann legen wir fest, welche gemeinnützigen Zwecke wir verfolgen könnten. Zuletzt untersuchen wir, welche Zwecke und Werte sich andere Gruppen gegeben haben.<br><br>Es sind weder Vorkenntnisse noch Vorbereitungen erforderlich. Deine Vorschläge und Ideen zählen! Gestalte Queer Augsburg mit und trage zu einer bunten Zukunft in Augsburg bei! 🌈<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich. Link auf Anfrage per Mail an mail@queer-augsburg.de oder per PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616090400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "600761f138dbfc00152c8fbb"
            },
            id: "cPKyc",
            head: "<br>Queer Augsburg Presents<br>Aktion zum Tag gegen Rassismus<br>Donnerstag, 25.03.2021<br>ab 19 Uhr auf Zoom<br>✊🏿",
            body: '"Erst wenn wir anfangen, Rassismus zu verstehen, können wir damit umgehen."<br><br>Gemeinsam mit der Black Community Foundation Augsburg und der Münchener Jugendgruppe für queere BIPoC Queer*YOUrope veranstalten wir einen interaktiven Workshop zum Thema intersektionaler Rassismus. Darin erfährst du unter anderem, wie sich Diskriminierung aufgrund von Queerness mit Diskriminierung aufgrund von Rassismus überschneidet.<br><br>Im Workshop besprechen die Referentinnen mit dir, wie intersektionale Diskriminierung aussieht. Du erfährst von der queeren Befreiungsbewegung bis hin zu den rassistischen Strukturen in der Gegewart. Neben theoretischem Input zu Rassismus und Intersektionalität kannst du jederzeit Fragen stellen und dich an Diskussionen beteiligen.<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616695200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "19"
        },
        {
            _id: {
                $oid: "6007622838dbfc00152c8fbd"
            },
            id: "5nCW4",
            head: "International Transgender<br>Day of Visibility<br>Donnerstag, 01.04.2021<br>ab 19 Uhr auf Zoom<br>💙💜🤍💜💙",
            body: '"Some men have vaginas, some women don\'t. Get over it."<br><br>Das Reproduzieren von biologistischen Geschlechtskonstruktionen in der Sprache sowie die gedankliche Verknüpfung eines rein körperlichen Merkmals ("Penis") mit der Genderidentität einer Person ("männlich") radiert transgender, non-binäre und gender non confirming Personen auf sprachlicher Ebene aus.<br><br>Pauschalisierende Formulierungen wie "schwangere Frauen" entsprechen nicht der Lebenswirklichkeit von trans Personen und missachten die Existenz von gebärenden Vätern und zeugenden Müttern.<br><br>Das Fehlen eines geschlechtsneutralen Pronomens jenseits der Binarität von "sie" und "er" macht es unmöglich auf non-binäre Personen in adäquater Weise Bezug zu nehmen.<br><br>Anlässlich des Day of trans visibility möchten wir mit euch um die Möglichkeiten einer inklusiven Sprache reden, die trans Personen sichtbar statt unsichtbar macht.<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1617296400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "6007625138dbfc00152c8fbf"
            },
            id: "CPYB8",
            head: "Q&amp;A: Polyamorie<br>Donnerstag, 08.04.2021<br>💙❤️🖤",
            body: '<br>"Love does not divide, it multiplies"💕<br><br>Q&amp;A Polyamorie am 08. April ab 19:00 auf Zoom.<br><br>Wir wollen uns mit euch zusammensetzen und über unsere Erfahrungen mit Polyamorie reden. ☺️<br><br>Was ist das eigentlich?<br>Wir möchten ein paar grundlegende Begriffe klären und euch unterschiedliche Arten zu lieben nahe bringen.<br>Wir freuen uns sehr, wenn ihr Interesse und viele Fragen mitbringt, wenn ihr möchtet könnt ihr auch gerne eure Erfahrungen mit Alternativen zur Monogamie mit uns teilen! 🥰<br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br><br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1617901200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "6007627e38dbfc00152c8fc1"
            },
            id: "V8cjj",
            head: "Strategie-und Richtungstreffen 4<br>Donnerstag, 15.04.2021<br>💡💡💡💡",
            body: "Wir geben uns Gruppenregeln!<br><br>Insbesondere im digitalen Raum kommt es häufig zu Missverständnissen. Daher wollen wir Regeln festlegen, wie wir miteinander umgehen wollen:<br><br>Wie wollen wir miteinander kommunizieren? Was soll nicht passieren? Wie wollen wir die Einhaltung unserer Regeln sicherstellen?<br><br>Am Ende des Abends steht eine Nettiquette, die eine harmonische Gruppendynamik fördern soll.<br><br>Sei dabei und gestalte Queer Augsburg mit!<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1618506000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "600762b838dbfc00152c8fc3"
            },
            id: "FMjQf",
            head: "Fitness<br>Donnerstag, 22.04.2021<br>🤸‍♂️🤸🤸‍♀️",
            body: "Youtube-Fitness is langweilig geworden? Pamela Reif is nur noch hübsch? Für Joggen fehlt auch die Motivation? 🤔<br><br>In der Gruppe macht schwitzen doch viel mehr Spaß und wenn das auch noch ganz easy zu Hause vorm Laptop geht, ists doch gleich doppelt gut! 🏋️‍♀️💻🏋️‍♂️<br><br>Am 22.04. will ich mit euch zusammen ein Workout über Zoom machen und danach gern noch bisschen quatschen. Ob Kamera an oder aus könnt ihr natürlich selbst entscheiden und es wird Variationen für Anfänger und Fortgeschrittene geben. 🥳💪<br><br>Du brauchst ungefähr so viel Platz, dass du dich ausgestreckt auf den Boden legen kannst.<br><br>Ich freu mich auf euch!<br><br>Amelie<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1619110800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "600762e838dbfc00152c8fc5"
            },
            id: "X4O7z",
            head: "Aktion zum<br>Day of Lesbian Visibility<br>Donnerstag, 29.04.2021<br>❤️🧡🤍💗💜",
            body: "<br>Intersektionalität von Homofeindlichkeit und Sexismus -<br>Warum lesbische Personen oft doppelt so hohe Hürden überwinden müssen<br><br>„Aber du siehst doch gar nicht lesbisch aus!“<br>„Was willst du denn noch mehr, ihr habt doch schon die Homo-Ehe?“<br>„Darf man da mal zuschauen?“<br><br><br>Wir möchten uns mit euch über Diskriminierung und Stereotypen von lesbischen Personen austauschen. Wir zeigen wie Sexismus und Homofeindlichkeit Hand in Hand gehen.<br><br>Dabei erklären wir das Konzept von Intersektionalität, gehen auf rechtliche und gesellschaftliche Diskriminierung in Deutschland ein und tauschen uns dann darüber aus, wie uns Stereotype und Erfahrungen beeinflussen.<br><br>Wir freuen uns wenn Betroffene, sowie Nicht-Betroffene vorbeischauen.<br><br>Niemand ist gezwungen Erfahrung hierzu zu teilen, wir freuen uns auch über stille Zuhörer:innen! ☺️<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich. Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1619715600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "28"
        },
        {
            _id: {
                $oid: "6007634438dbfc00152c8fc8"
            },
            id: "G8tBd",
            head: "✨🥳 2-Jahresjubiläum 🥳✨<br>Queer Augsburg<br>Samstag, 08.05.2021<br>🎂🎂",
            body: "Am Samstag ist es so weit: Queer Augsburg wird zwei Jahre alt!<br>🥳🥳<br><br>Feiert mit uns das Jubiläum und blickt gemeinsam auf die letzten zwei Jahre zurück. Wir hören sieben Personen zu, die aus ihrer Sicht von den verschiedenen queer augsburgerischen Phasen erzählen. Gegen Ende können wir noch einige Games zocken oder einfach nur entspannt rumhängen.<br><br>🕗 Wann?<br>Am 08. Mai (Samstag) gegen 19 Uhr.<br><br>📍 Wo?<br>Auf Zoom. Link auf Anfrage per Mail an mail@queer-augsburg.de oder Nachricht auf Insta.<br><br>❔ Was?<br>Ein entspannter Rückblick auf Queer Augsburgs Geschichte, begleitet von einem Interview fürs Uniradio Kanal C.<br><br>(Dein Beitrag wird nur mit deinem vorherigen Einverständnis benutzt!)<br><br>Vielen Dank an Kat und Kanal C für die Organisation und das Geschenk, zu unserem Jubiläum einen Radiobeitrag zu bekommen! 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1620493200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "6007637938dbfc00152c8fca"
            },
            id: "ml7Fw",
            head: "Strategie-und Richtungstreffen 5<br>Donnerstag, 06.05.2021<br>💡💡💡💡💡",
            body: "<br>Lasst uns Kreise, Rechtecke und Dreiecke malen und sie miteinander verbinden!<br><br>Wir wollen uns eine Gruppenstruktur geben, die demokratisch, transparent und effizient ist. Dafür brauchen wir Einheiten, die feste Aufgaben übernehmen, und gleichzeitig offen und zugänglich sind.<br><br>Wie wollen wir Queer Augsburg organisieren? Wer leitet, wer plant, wer repräsentiert und wie bestimmen wir diese Personen?<br><br>Lasst uns ein kleines Organigramm malen, das darstellt, wie wir uns unser Queer Augsburg vorstellen.<br><br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1620320400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "600763a538dbfc00152c8fcc"
            },
            id: "dxiJc",
            head: "Strategie- und Richtungstreffen 6<br>Donnerstag, 24.06.2021<br>💡💡💡💡💡💡",
            body: "<br>Wir beenden unsere Strategietreffen mit einem Austausch zu guter Gruppenführung:<br>Was macht gute Führung für uns aus? Wie wollen wir unsere Führung bestimmen? Was für Aufgaben hat sie?<br>Und wie wollen wir Vielfalt, Transparenz und Teilhabe garantieren?<br><br>Gestalte deine queere Gruppe und bestimme mit, wie unsere Führung in Zukunft aussehen wird! 🤗🌈<br><br>Ab 19 Uhr auf Zoom.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624554000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "4"
        },
        {
            _id: {
                $oid: "60088bfabfe6b100136b9f09"
            },
            id: "CCYlU",
            head: "🚪Gatekeeping 🚪<br>von aromantischen und asexuellen Personen<br>Donnerstag, 04.03.2021",
            body: '<br>How can we do better? Die zweite Folge unserer Reihe Gatekeeping in der queeren Community und wie man es behandelt.<br><br><br>Als Gatekeeping bezeichnet man den Ausschluss von Personen aus den Schutzräumen der Communities.<br><br>Gatekeeper*innen postulieren die Norm, dass man einer bestimmten Definition zu entsprechen, sich auf eine bestimmte Art verhalten müsse, um Teil einer Gruppe sein zu können.<br><br>So ist Grundannahme der Gatekeeper*innen von a_sexuellen Personen die Gleichsetzung von zero attraction und einfach unausgelebter Heterosexualität. Da der Fokus der queeren Community oft auf sexuelle Orientierung gerichtet ist, werden a_romatische Personen schlichtweg übersehen. Oder - da sich weder der Maßstab einer "klassischen" sexuellen noch einer romatischen Beziehung anlegen lässt - den queerplatonischen Beziehungen von Aro-Aces schlichtweg die "Queerness" abgesprochen.<br><br>Am 4. März wollen wir mit euch über weitere Vorurteile von Personen des Aro/Ace Spectrums sowie das damit verbundene Gatekeeping in der queeren Community reden und diskutieren, wie wir die Community zu einem besseren Schutzraum für uns alle gestalten können.<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1614880800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "60182236bfe6b100136ba35f"
            },
            id: "RDrHJ",
            head: "<br>Queer Augsburg Connects<br>Transatlantic Queer Meeting<br>Saturday, 20.03.2020<br>🇩🇪🇺🇸",
            body: "Let's meet American lesbians, gays, bisexuals, transgender, non-binaries, asexuals, aromantics and queers!<br><br>We meet with queer student groups from Marymount University in Arlington, Virginia, and Augsburg University in Minneapolis, Minnesota, at 6 p.m. EST on Zoom.<br><br>We will share our experiences of dealing with queer issues and people in our two countries, and learn about our friends across the Atlantic. :)<br><br>No registration required. Email us at mail@queer-augsburg.de or message us on Instagram at @queer_augsburg to get the link!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616263200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "60185d13bfe6b100136ba36e"
            },
            id: "b2S9p",
            head: "✨ South German Queerentine ✨ Gaming Day 2<br>Sonntag, 21.02.2021<br>ab 15 Uhr auf Discord<br>🎮🦄",
            body: "Vergiss Quarantäne - komm in die Queerentine! 🏳️‍🌈🎮<br><br>Die Jugendinitiative Fliederlich und Kunterbunt Amberg rufen am 21.02.2021 zum Zweiten South German Queerentine Gaming-Day (2. SGQGD) auf.<br><br>Queer Augsburg ist da selbstverständlich dabei! 🙌<br><br>Nimm an den virtuellen Spielrunden von Among Us, Skribble.io, Cards against Humanity oder Jackbox teil.<br><br>Triff alte Freunde und knüpfe neue Kontakte zu anderen Menschen aus ganz Deutschland.<br><br>Wann: 21.02.2021, 15 - 22 Uhr<br>Wo: http://discord.gg/sWkeFBb<br>Für mehr Informationen: sgqgd.de<br><br>Bei weiteren Fragen kannst du dich gerne an uns wenden.<br>Keine Anmeldung erforderlich.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1613930400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "60201e3ebfe6b100136ba5bd"
            },
            id: "ZQYoB",
            head: "Queere Christ*innen<br>Freitag, 19.02.2021",
            body: "Ab 19 Uhr auf Jitsi. Keine Anmeldung erforderlich.<br><br>Link: https://meet.jit.si/qcaux",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1613757600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "60201e64bfe6b100136ba5bf"
            },
            id: "kW4mk",
            head: "Queere Christ*innen<br>Freitag, 19.03.2021<br>✝️",
            body: "Ab 19 Uhr auf Jitsi. Keine Anmeldung erforderlich.<br><br>Link: https://meet.jit.si/qcaux",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616176800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "60201e8bbfe6b100136ba5c1"
            },
            id: "3ffW8",
            head: "Queere Christ*innen<br>Freitag, 16.04.2021<br>✝️",
            body: "Ab 19 Uhr auf Jitsi. Keine Anmeldung erforderlich.<br><br>Link: https://meet.jit.si/qcaux",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1618592400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "60201ec9bfe6b100136ba5c3"
            },
            id: "9lZir",
            head: "Queere Christ*innen<br>Freitag, 21.05.2021<br>✝️",
            body: "Ab 19 Uhr auf Jitsi. Keine Anmeldung erforderlich.<br><br>Link: https://meet.jit.si/qcaux",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1621616400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "603d54c4af3501001390f644"
            },
            id: "B39RL",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 23.03.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br>Ab 19 Uhr auf Zoom.<br><br>Keine Anmeldung erforderlich.<br>Schick uns Mail an mail@queer-augsburg.de oder eine Nachricht auf Instagram an @queer_augsburg, um den Link zu erhalten!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616522400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "603d5516af3501001390f646"
            },
            id: "jF4Pq",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 13.04.2020<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1618333200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "603d5544af3501001390f648"
            },
            id: "vTBOS",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 27.04.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1619542800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "603d5595af3501001390f64a"
            },
            id: "uKFA8",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 11.05.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal auf Zoom.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1620752400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "603d55f2af3501001390f64e"
            },
            id: "s0ysR",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 25.05.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1621962000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "603d5622af3501001390f651"
            },
            id: "MGD5z",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 08.06.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal auf Zoom.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1623171600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "603d5650af3501001390f653"
            },
            id: "902iF",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 22.06.2021<br>ab 19 Uhr auf dem Sonnendeck",
            body: "Unser erstes Präsenztreffen seit acht Monaten! 🥳🙌<br><br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal auf dem Sonnendeck!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns um 19 Uhr bei der Brücke direkt vor der Kulperhütte. Anschließend holen wir uns Getränke und lassen uns in der Nähe nieder. 🍹<br><br>Maximal 10 Teilnehmende. Vollständig geimpfte und genesene Personen zählen nicht dazu. Anmeldung erfolgt ausschließlich über das digitale Anmeldetool, das du über den Link unten findest.<br>Anmeldeschluss ist am Montag um 19 Uhr.<br>Bitte melde dich bei technischen Problemen bei uns per Mail an: technik@queer-augsburg.de<br><br>Queer Augsburg ist kein Verein und kann daher für nichts haften. Teilnahme auf eigenes Risiko!<br><br>AKTUELLE INFORMATIONEN:<br><br>Hallo liebe Leute!<br>Heute wird es voraussichtlich leicht regnen. 🌦️<br>Daher haben wir entschieden, beide Gruppentreffen auf dem Sonnendeck stattfinden zu lassen. Dort gibt es weitaus mehr Schirme, um sich vor potenziellem Regen zu schützen. ☂️<br>Nehmt sicherheitshalber, falls vorhanden, aber auch Regenjacke und Regenschirm mit. 🤗<br><br>Falls du aufgrund des Wetters (oder anderen Gründen) trotz Anmeldung nicht kommst, wäre ich sehr froh, wenn du mir kurz Bescheid gibst. :D<br><br>Liebe Grüße und bis 19 Uhr am Sonnendeck! ☺️<br><br>Treffpunkt ist vor dem Naturmuseum/Planetarium. ☀️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624381200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "603e81dcaf3501001390f685"
            },
            id: "YNFuZ",
            head: "🔮 Queer Augsburg Ideas 🔮<br>Dienstag, 30.03.2021<br>ab 19 Uhr auf Zoom",
            body: "Du hast Ideen für Queer Augsburg Treffen? Dann kannst du sie hier einbringen! Gemeinsam erarbeiten wir Treffen für den Sommer.<br><br>Bringe gerne alles ein, was du bei Queer Augsburg erleben willst. Du bist selbstverständlich nicht verpflichtet, deine Vorschläge umzusetzen. Wir arbeiten alle zusammen, um das bestmögliche Programm für den Sommer 2021 zu erstellen! 🤗<br><br>Hier kannst du deine Ideen und Vorschläge schon vor dem Treffen einbringen. So kannst du deine Ideen und Wünsche auch dann äußern, wenn du keine Zeit oder Lust hast, zum Treffen zu kommen. 😇<br><br>https://tweedback.de/554k/chatwall<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1617123600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "6058bada9868710013f3006d"
            },
            id: "o0m6I",
            head: 'Queere Christ*innen<br>"bewegt in die Karwoche"<br>Samstag, 27.03.2021<br>ab 18 Uhr auf Zoom<br>💃🕺📖✝️⛪',
            body: "<br>Die Woche vor Ostern ist eine bewegte Woche: Jubel und Angst, Gemeinschaft und Einsamkeit, Hoffnung und Trauer liegen darin eng aneinander.<br><br>Im zweistündigen Workshop am Vorabend von Palmsonntag lassen wir uns mit unseren Körpern auf diese Bewegungen, Spannungen und Themen ein.<br><br>Der Workshop findet über die Plattform Zoom statt: wir sind über Video verbunden und tanzen im eigenen Raum - bei Bedarf kann die Kamera auch ausgemacht werden. Vorkenntnisse braucht es keine, nur Kleidung, in der man sich gut bewegen kann, eine Bibel und etwas Platz.<br><br>Anmeldung bis Samstag Mittag an: Bernhard.offenberger@elkb.de",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616774400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6058bca99868710013f3006f"
            },
            id: "9Dx5f",
            head: "Queere Christ*innen<br>Fastenzeit ist Wüstenzeit<br>29.03.2021 bis 03.04.2021<br>🏜️",
            body: "Fastenzeit ist Wüstenzeit.<br><br>Da Corona viele Einschränkungen mit sich bringt und wir dies auch als „Wüste“ empfinden, ist diese gemeinsame Ausrichtung eine Chance, diese Zeit positiv zu erleben.<br><br>Deshalb lade ich Euch ein, in der Karwoche ein Angebot zu gestalten. Von Montag, den 29.3.um 20.00 Uhr zur Einführung bis Karsamstag, den 3.4.2021 werden wir digital jeweils morgens und abends zusammenkommen. Ich werde meditative Körperarbeit und eine geführte Meditation mit Euch durchführen. Für Einzelgespräche stehe ich gerne in der Zeit zur Verfügung.<br><br>Weitere Informationen, Jitsi-Link und Anmeldung bis Samstag Abend per Mail an wuestenzeit@qcaux.de<br><br>- Matthias Möller -",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616778000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6063a73199ac9f00145a5bc4"
            },
            id: "dmLKB",
            head: "Queerosaurus Aux:<br>Spieleabend<br>Freitag, 02.04.2021<br>ab 19 Uhr via Zoom<br>🦖🦕🏳️‍🌈🌈",
            body: 'Queerosaurus Aux ist die queere Abteilung des Vereins Stadraum e.V. Sie möchten vor allem die Felder "Bildung", "Kultur" und "Community" für ein queeres Augsburg ausbauen. Weiterhin ist es ihr Bestreben, einen Schutzraum insbesondere für queere Menschen zu schaffen, aber auch Allies sind natürlich herzlichst willkommen.<br>Der Spieleabend besteht aus unterschiedlichen Interaktionsspielen mit queerem Bezug.<br>Danach Open End.<br><br>Anmeldung unter:<br>queer@stadtraumev.de',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1617382800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6063a7f899ac9f00145a5bc9"
            },
            id: "eDezs",
            head: "CSD Augsburg<br>Samstag, 12.06.2021<br>❤️💚🤍",
            body: '<br>Hallo liebe Leute, heute findet der CSD statt!<br><br><br>Im diesjährigen Programmheft zum CSD warten spannende Artikel auf euch. Neben einer Gruppenvorstellung von Jessy (@jess_schoenrock_autorin), findet ihr dort auch einen Artikel zum Thema trans*-inklusiver Sprache von Lane (@followthislane). Julia (@juliasto_) gibt uns Tipps für eine gut laufende Fernbeziehung und Franzi (@franzithegayjesus) erzählt von der Gründung des Queer Space Königsbrunn.<br>All dies und vieles mehr könnt ihr online lesen: https://www.csd-augsburg.de/programmheft/<br><br>Am Abend lädt der CSD zu einem *Livestream* ein. Ihr könnt euch auf einen spannenden Abend und ein abwechslungsreiches Programm freuen!<br>Der diesjährige Schirmherr des CSD Augsburg *Leopold* ist nur einer der musikalischen und künstlerischen Acts die euch erwarten.<br>Neben Queer Augsburg, werdet ihr auch andere Organisationen und Gruppen aus unserer Stadt kennenlernen. Jessy (@jess_schoenrock_autorin) liest aus ihrem, im Juli erscheinenden LGBTQ+ Liebesroman. Im Talk werden Eva (@this_is_ev) und Lane (@followthislane) uns mehr zu gendergerechter Sprache, Sichtbarkeit und queerer Bildung erzählen. Ganz besonders gespannt sind wir auf die dynamische Uraufführung von Lanes Theaterstück "Kaleidoskop eines Coming Outs".<br>Allen weiteren bunten Programmpunkte könnt ihr im Livestream bestaunen.<br>Weitere Infos zum Livestream findet ihr hier: https://www.csd-augsburg.de/livestream/<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1623517200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "606e1f8199ac9f00145a5e86"
            },
            id: "FJwSV",
            head: "Queer Augsburg Talks<br>Dating und Datingfails<br>Sonntag, 28.03.2021<br>ab 19 Uhr auf Zoom",
            body: "Ab 19 Uhr auf Zoom.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1616950800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "607086c099ac9f00145a5f1b"
            },
            id: "OnBLo",
            head: "👋Queer Augsburg Meet💬<br>Dienstag, 13.07.2021<br>ab 19 Uhr im Enchilada🌮🍹",
            body: 'Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal im Enchilada.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze reserviert. Sie werden nach dem Prinzip First come First serve vor Ort vergeben. Falls erforderlich und möglich, machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, bitte nach "Queer Augsburg" oder "Leonie" fragen.<br><br>Queer Augsburg ist kein Verein und kann daher für nichts haften. Teilnahme auf eigenes Risiko!<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1626195600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "2"
        },
        {
            _id: {
                $oid: "607086ed99ac9f00145a5f1d"
            },
            id: "fhQ9i",
            head: "👋Queer Augsburg Meet💬<br>Dienstag, 27.07.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal auf Zoom.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1627405200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "11"
        },
        {
            _id: {
                $oid: "6070871b99ac9f00145a5f1f"
            },
            id: "bIwIr",
            head: "Queer Augsburg Meet<br>Dienstag, 10.08.2021<br>ab 19 Uhr in der Haifischbar🦈🍹",
            body: 'Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal in der Haifi.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze reserviert. Sie werden nach dem Prinzip First come First serve vor Ort vergeben. Falls erforderlich und möglich, machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, bitte nach "Queer Augsburg" fragen.<br><br>Queer Augsburg ist kein Verein und kann daher für nichts haften. Teilnahme auf eigenes Risiko!',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1628614800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "607088cf99ac9f00145a5f2d"
            },
            id: "CxdR7",
            head: "Queer Augsburg Meet<br>Dienstag, 24.08.2021<br>ab 19 Uhr im Okis🦁🍺🥃",
            body: '<br>ACHTUNG ÄNDERUNG: AUFGRUND DER STEIGENDEN INZIDENZ IN AUGSBURG FINDET DER MEET ONLINE AUF ZOOM STATT!!<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br><br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal im Oki\'s.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze reserviert. Sie werden nach dem Prinzip First come First serve vor Ort vergeben. Falls erforderlich und möglich, machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, bitte nach "Queer Augsburg" fragen.<br><br>Queer Augsburg ist kein Verein und kann daher für nichts haften. Teilnahme auf eigenes Risiko!<br><br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1629824400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "3"
        },
        {
            _id: {
                $oid: "607089d399ac9f00145a5f31"
            },
            id: "A1I7z",
            head: "📦🎉Queer Augsburg Ideas<br>Dienstag, 03.08.2021<br>ab 19 Uhr auf Zoom💡☝️<br><br>",
            body: "Du hast Ideen für Queer Augsburg Treffen? Dann kannst du sie hier einbringen! Gemeinsam erarbeiten wir Treffen für den Spätsommer und Herbst.<br><br>Bringe gerne alles ein, was du bei Queer Augsburg erleben willst. Du bist selbstverständlich nicht verpflichtet, deine Vorschläge umzusetzen. Wir arbeiten alle zusammen, um das bestmögliche Programm für den Herbst 2021 zu erstellen! 🤗<br><br>Auf Tweedback kannst du deine Ideen und Vorschläge schon vor dem Treffen einbringen. So kannst du deine Ideen und Wünsche auch dann äußern, wenn du keine Zeit oder Lust hast, zum Treffen zu kommen. 😇<br><br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1628010000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "3"
        },
        {
            _id: {
                $oid: "60708a8299ac9f00145a5f34"
            },
            id: "pRy6r",
            head: "🎊Queer Augsburg Ideas🥠<br>Donnerstag, 20. Januar<br>ab 19 Uhr auf Zoom",
            body: "Du hast Ideen für Queer Augsburg Treffen? Dann kannst du sie hier einbringen! Gemeinsam erarbeiten wir Treffen für den Winter und Frühjahr.<br><br>Bringe gerne alles ein, was du bei Queer Augsburg erleben willst. Du bist selbstverständlich nicht verpflichtet, deine Vorschläge umzusetzen. Wir arbeiten alle zusammen, um das bestmögliche Programm für Winter/Frühjahr 2022 zu erstellen! 🤗<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1642701600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "60708d0c99ac9f00145a5f3d"
            },
            id: "CAPTK",
            head: "Kennenlernen<br>Donnerstag, 13.05.2021<br>ab 19 Uhr auf Zoom<br>🏳️‍🌈🏳️‍🌈🏳️‍🌈",
            body: 'Lerne andere queere Menschen kennen,<br>knüpfe Kontakte und werde Teil der<br>queeren Community in Augsburg!<br><br>Wir veranstalten ein digitales Kennenlerntreffen!<br><br>Offizieller Beginn ist um 19 Uhr. Wir warten aber ein "Queeres Fünfminütchen" auf alle, die nachkommen.<br><br>Wir stellen uns kurz vor und spielen dann einige Spiele in zufällig eingeteilten kleinen Breakoutrooms. Wir spielen 2 Wahrheiten 1 Lüge (ein bisschen Vorbereitung kann hier nicht schaden), lernen uns bei einem Speeddating besser kennen und suchen nach Gegenständen...<br><br>Gegen 20 Uhr gibt es eine Pause, gegen 21 Uhr beenden wir die Veranstaltung offiziell. Der Raum bleibt aber offen, damit du weiter queere Menschen kennenlernen kannst.<br><br>Wir freuen uns auf dich! 🤗🏳️‍🌈<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1620925200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "41"
        },
        {
            _id: {
                $oid: "60708eb599ac9f00145a5f41"
            },
            id: "jCULs",
            head: "🍸💖 Queer Augsburg Party 💖🍸<br>Samstag, 03.07.2021<br>ab 17:30 bei der Haifi",
            body: "-back by popular demand-<br><br>Wir machen Augsburgs Nachtleben unsicher. ✨<br><br>Unter Leitung der erfahrenen Kneipengängern und Bier Connaisseurs Paul &amp; Nina werden gemeinsame Pub Crawls und Clubbesuche organisiert.🍹<br><br>Hier habt ihr die Möglichkeit neue Bars und Partys zu entdecken, die vielleicht sogar manchen Augsburger*innen noch nicht bekannt sind. Es ist garantiert für alle etwas dabei.🍻<br><br>Wir starten um 17.30 Uhr in der Haifischbar.<br>(Dieses Mal etwas früher als sonst, weil um 00:00 ja schon Sperrstunde ist.)<br><br>Altersgrenze ab 16!<br>Wir sind kein Verein und auch keine Jugendgruppe. Wir können weder haften noch eine Aufsichtspflicht übernehmen.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1625338800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "60708f2d99ac9f00145a5f43"
            },
            id: "yvRKO",
            head: "Queer Augsburg Ideas<br>Dienstag, 29.06.2021<br>ab 19 Uhr auf Zoom",
            body: "Du hast Ideen für Queer Augsburg Treffen? Dann kannst du sie hier einbringen! Gemeinsam erarbeiten wir Präsenztreffen im Sommer und Herbst 2021 und Treffen im öffentlichen Raum.<br><br>Bringe gerne alles ein, was du bei Queer Augsburg erleben willst. Du bist selbstverständlich nicht verpflichtet, deine Vorschläge umzusetzen. Wir arbeiten alle zusammen, um das bestmögliche Programm zu erstellen! 🤗<br><br>Auf Tweedback kannst du deine Ideen und Vorschläge schon vor dem Treffen einbringen. So kannst du deine Ideen und Wünsche auch dann äußern, wenn du keine Zeit oder Lust hast, zum Treffen zu kommen. 😇<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624986000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "4"
        },
        {
            _id: {
                $oid: "60816eee99ac9f00145a6302"
            },
            id: "wYxeu",
            head: "3. South German<br>Queerentine Gaming Day<br>🏳️‍🌈🎮",
            body: "Der 3.South German Queerentine Gaming Day findet am 22.04.2021 von 17:00 - 21:00 und am 24.04.2021 von 16:00 - 22:00 Uhr statt.<br><br>Die Jugendinitiative Fliederlich und Kunterbunt Amberg rufen zum Dritten South German Queerentine Gaming-Day (3. SGQGD) auf.<br>Mit dabei sind dieses Mal auch Österreich und die Schweiz. 🇦🇹🇨🇭<br><br>Nimm an den virtuellen Spielrunden von Among Us, Skribble.io, Gartic.io, Garticphone.com, Cards against Humanity oder Codenames teil. 🎮<br><br>Triff alte Freunde und knüpfe neue Kontakte zu anderen Menschen aus ganz Deutschland, Österreich und der Schweiz. 🤗<br><br>Einen Zugang bekommst du über Discord: http://discord.gg/sWeFBb<br>Mehr Informationen findest du auf: sgqgd.de<br>🎮👾🎮👾🎮👾",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1619272800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "6082eff799ac9f00145a6371"
            },
            id: "SyJa8",
            head: "Argumentationstraining<br>Donnerstag, 20.05.2021<br>ab 19 Uhr auf Zoom<br>🗯️",
            body: "Speak Up! Argumentationstraining gegen Homophobie und Sexismus, Donnerstag 20.05.2021, ab 19 Uhr auf Zoom, Anmeldung erforderlich!<br><br>Workshop zum Thema Umgang mit Antifeminismus von Diplom Politikwissenschaftlerin, Trainerin und Beraterin Wiebke Eltze.<br>In vielfätigen Angriffen gegen Feminismus, Gender und queere Positionen zeigen sich antifeministische Argumentationsmuster. Lebens- und Familenformen, die nicht in heteronormative Vorstellungen passen, werden dabei häufig angegriffen und abgewertet.<br><br>Diese antifeministischen Argumentationsmuster und Diskussionsstrategien und wie man auf sie reagiert sind Inhalt des Seminars. Im Mittelpunkt steht dabei die Stärkung und Sichtbarmachung der eigenen Haltung, um die Vielfalt geschlechtlicher, familialer und sexueller Identitäten und Lebensweisen argumentativ zu verteidigen.<br><br>Anmeldung nach Login (siehe unten) per Mail oder Signal. Link in der Nachricht innerhalb von 10 Minuten anklicken zur Registrierung. Den Zoom-Link bekommst du kurz vor der Veranstaltung zugeschickt. Die Anmeldung endet eine Stunde vor Veranstaltungsbeginn<br><br>Im Rahmen der Förderung durch das Bundesprogramm Demokratie leben hat der CSD Augsburg e.V. 2021 in einem Kooperationsprojekt mit Queer Augsburg und der Augsburger AIDS-Hilfe e.V. die Veranstaltungsreihe diver.see.ty 2021 ins Leben gerufen. Die abwechslungsreichen Veranstaltungen richten sich speziell an die queere Community sowie an Freund*innen und Allies.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1621530000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "20"
        },
        {
            _id: {
                $oid: "609a863495a4c80013501683"
            },
            id: "UV6pX",
            head: "Neopronomina und Microlabels<br>Donnerstag, 27.05.2021<br>ab 19 Uhr auf Zoom<br>🏷️📗",
            body: '<br>"Haben Genderfae und Genderfaun magische Vorfahren? Sind _bla_ und _es_ valide Pronomen? Und gibt es _schwule Mädchen_ wirklich?"<br><br><br>Pronomen und Labels sind ein wichtiger Aspekt in der queeren Community. Sie helfen uns uns selbst zu finden, besser zu verstehen und uns in unserer Sprache wohlzufühlen. Dabei gibt es inzwischen sehr viele verschiedene Labels und Pronomen. Viele davon sind schon lange bekannt, während andere komplett neu sind. Diese werden oft als Neopronomen und teilweise als Microlabels betitelt.<br><br>Am 27.05.2021 wollen wir mit euch genau darüber sprechen. Also was sind Microlabels und Neopronomen überhaupt und warum existieren diese, und werden auch immer mehr. Dies alles wird an Beispielen und teilweise auch an Erfahrungen dargestellt. Auf die Anwendung von Neopronomen wird ebenfalls eingegangen und hilfreiche Ressourcen und Links geteilt. Eigene Erfahrungen, Fragen und andere Diskussionsbeiträge haben Platz und sind erwünscht.<br><br>Herzlichen Dank an Phillip von Kunterbunt Amberg für die Unterstützung an diesem Abend!🤗<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1622134800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "609a86c295a4c80013501685"
            },
            id: "0BuqN",
            head: "Queerness im Islam<br>Donnerstag, 03.06.2021<br>ab 19 Uhr auf Zoom<br>🏳️‍🌈🕌🕋☪️🏳️‍🌈",
            body: "Yasmin und Marwa von Queerosaurus geben Einblicke in ihr queer-muslimisches Leben und stellen sich im Anschluss Euren Fragen. Sie werden insbesondere auf ihre eigenen Erfahrungen als queere Musliminnen in Deutschland eingehen. Weiterhin soll die Geschichte der Queerness im Islam und ihre Entwicklung grob skizziert werden.<br><br>Ab 19 Uhr auf Zoom.<br>Anmeldung ausschließlich über queer@stadtraumev.de",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1622739600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "19"
        },
        {
            _id: {
                $oid: "609a877d95a4c80013501688"
            },
            id: "rauUW",
            head: "Queer und Christlich<br>10.06.2021<br>ab 19 Uhr auf Zoom<br>🏳️‍🌈⛪✝️🏳️‍🌈",
            body: 'In Kooperation mit der Evangelischen Studierendengemeinde Augsburg und den Queerem Christ*innen Augsburg veranstalten wir einen Abend zum Thema "Queer und Christlich".',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1623344400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "19"
        },
        {
            _id: {
                $oid: "609a880a95a4c8001350168b"
            },
            id: "v76Ks",
            head: "Kennenlernen<br>Donnerstag, 17.06.2021<br>ab 19 Uhr auf Zoom<br>🏳️‍🌈",
            body: '<br>Wir veranstalten ein digitales Kennenlerntreffen!<br><br>Offizieller Beginn ist um 19 Uhr. Wir warten aber ein "Queeres Fünfminütchen" auf alle, die nachkommen.<br><br>Wir stellen uns kurz vor und gehen dann in zufällig eingeteilte kleinen Breakoutrooms. Anschließend lernen wir uns bei einem Speeddating besser kennen.<br><br>Gegen 20 Uhr gibt es eine Pause, gegen 21 Uhr beenden wir die Veranstaltung offiziell. Der Raum bleibt aber offen, damit du weiter queere Menschen kennenlernen kannst.<br><br>Wir freuen uns auf dich! 🤗🏳️‍🌈<br><br>Ab 19 Uhr auf Zoom. Keine Anmeldung erforderlich. Frage den Link bitte per PN auf Instagram oder per Mail an mail@queer-augsburg.de an. 🤗',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1623949200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "60a8415995a4c80013501a26"
            },
            id: "ciGjU",
            head: "Queere Christ*innen<br>Freitag, 18.06.2021<br>ab 19 Uhr",
            body: "<br>Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 18.06. ab 19 Uhr im Pfarrgarten von St. Ulrich, Ulrichsplatz 11. Um etwas mit der Anzahl der Personen planen zu können, bitten sie um eine kurze Anmeldung auf praesenz@qcaux.de. Weitere Infos unter www.qcuax.de",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624035600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "60a841b095a4c80013501a28"
            },
            id: "Ma3KN",
            head: "Sonntagstalk<br>Darstellung von queeren Personen in Medien<br>Sonntag, 30.05.2021<br>auf Zoom",
            body: "<br>  Auf Zoom",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1622394000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "60a8420f95a4c80013501a2a"
            },
            id: "oHzsQ",
            head: "Grillfest mit der ESG<br>Donnerstag, 01.07.2021<br>ab 17 Uhr draußen bei der ESG Cafete<br>Anmeldung trotz Impfung/Erkrankung erforderlich!<br>☀️🎲🍳",
            body: "<br>Sommer, Spiele und Grillen!<br><br>Lasst uns einen geselligen Sommerabend mit der Evangelischen Studierendengemeinde verbringen!<br><br>Es wird die weltbesten Salate geben, Grillequipment wird gestellt und Getränke können gegen kleines Entgelt vor Ort erworben werden. 🍹<br><br>Bringe dein *eigenes Grillgut und Spiele* mit und melde dich vorher auf unserer Website unter queer-augsburg.de/anmelden an. Wir haben maximal 50 Plätze frei, also bitte auch trotz Impfung oder Genesung *anmelden*!<br><br>Das Treffen beginnt *draußen* bei der ESG Cafete *um 17 Uhr und endet um 21 Uhr*. Wir wären sehr dankbar, wenn du uns am Ende mit dem Aufräumen hilfst! 😇🤗<br><br>Es gelten folgende Corona-Regeln:<br>Immer Abstand halten.<br>Beim Herumlaufen FFP2-Maske treffen.<br>Beim Hinsetzen ist Maske abnehmen erlaubt.<br>Nicht mehr als 10 Personen an einem Tisch.<br><br>Wir freuen uns auf dich! ☺️☀️🎲🍳<br><br>Das Treffen findet auch bei Regen statt! Wir verteilen uns dann auf die Innenräume der ESG in 5er Gruppen. Stand jetzt sieht es aber nicht nach Regen aus. :)<br><br>Achtung! Der Anmeldelink gilt nur für 10 Minuten! Wenn der Link in der Login-Mail abgelaufen ist, versuche es bitte nochmal. :)",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1625151600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "20"
        },
        {
            _id: {
                $oid: "60a842f295a4c80013501a2f"
            },
            id: "vmKEP",
            head: "📚👩‍🎓Queer Augsburg Students👨‍🎓📚<br>Montag, 05.07.2021<br>ab 19 Uhr auf Zoom",
            body: "<br>Ein Treffen für alle Studierenden und alle, die es werden wollen, waren und sich für Studierendenthemen interessieren. :D<br>Ein freier Austausch, bei dem es über Themen geht, die queere Studierende an Unis und FHs und im Studienalltag interessiert. Vielleicht gibt es eine akademische Diskussion, vielleicht tauschen wir Tipps aus, wir werden sehen! 🤗<br><br>ORTSÄNDERUNG<br>Wir treffen uns online auf Zoom!<br>Wir haben das Feedback bekommen, dass es aufgrund der Klausurenphase schwer ist, sich die Zeit für ein Präsenztreffen nehmen. Darüber hinaus sind viele Interessierte gar nicht in Augsburg. Wir verschieben das Treffen daher in den digitalen Raum auf Zoom!<br><br>Ihr findet den Link ab kurz vor 19 Uhr für ca 30 Minuten auf unserer Website und Instagram. 🤗<br><br><br>Bis später! Ich freue mich auf euch! ☺️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1625504400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "60a8432b95a4c80013501a31"
            },
            id: "vHXGH",
            head: "Queer Augsburg Kultur:<br>🏛🍷Queeres Griechenland🦉🏺<br>Donnerstag, 08.07.2021<br>ab 19 Uhr auf Zoom",
            body: '<br>Woher kommt das Wort "lesbisch"? Was bedeutet "sapphic"? Was hat Platon mit "platonischer Liebe" zu tun? Und wie "schwul" waren die alten Griechen wirklich?🤔<br><br>An diesem Donnerstag wollen wir uns diesen und anderen Fragen rund um das antike Griechenland widmen, dabei gemeinsam ein paar Texte aus der antiken griechischen Lyrik und klassischen Philosophie lesen und in diesem Zusammenhang auf die ein oder andere queere mythologische Figur eingehen😏.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1625763600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "11"
        },
        {
            _id: {
                $oid: "60ce5575d4034e0013ef8580"
            },
            id: "wJ9yk",
            head: "🟢 Queer Augsburg Meet 🟢<br>Dienstag, 22.06.2021<br>ab 19 Uhr am Sonnendeck",
            body: "Da die Nachfrage nach Präsenztreffen so groß ist, bieten wir parallel ein weiteres Treffen am Sonnendeck an.<br><br>Treffpunkt: vor dem Naturmuseum/Planetarium<br><br><br>Dieselben Regeln wie beim anderen Meet-Treffen.<br><br>Wir freuen uns auf euch! 🤗🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624381500000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "60d049151ba1bf001437f244"
            },
            id: "XfNuW",
            head: "Queergarten<br>Freitag, 25.06.2021<br>Ab 18 Uhr im Wirgarten",
            body: "Wenn euch unsere Kennenlerntreffen noch nicht genug sind, dann schaut auch gerne am Freitag beim QUEERGARTEN vorbei! ☺️<br><br>Zusammen mit anderen Queeren Organisationen aus Augsburg übernehmen wir für vier Termine den WirGarten im Provino und machen daraus einen QUEERGARTEN. Bis bald, wir freuen uns auf euer kommen! ☺️✨",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1624636800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "50"
        },
        {
            _id: {
                $oid: "60e0e4702e66840013599342"
            },
            id: "uxsxH",
            head: "Queer Augsburg Liest:<br>👬💘Jess Schönrock liest aus Verliebt in Leander📕📖<br>Donnerstag, 15.07 2021<br>ab 19 Uhr auf Zoom",
            body: "- Buch Vorlesung am 15.07. -<br><br>Jess Schönrock wird uns am 15.07. um 19 Uhr auf Zoom ihr neues LGBTQ+ Roman 》Verliebt in Leander《 vorstellen.<br><br>Ihre Liebesgeschichten stehen für wertschätzende Darstellung unserer Community. Es geht ihr darum zu zeigen, wie normal wir sind und das es kein toxisches Klischee benötigt, um eine queere Geschichte spannend zu gestalten.<br><br>In 》Verliebt in Leander《 geht es um schwule Liebe zwischen zwei Männern, die sich jedoch nicht beide als schwul labeln.<br><br>Wir freuen uns, wenn ihr dabei seid.<br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1626368400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "60e0e62d2e66840013599345"
            },
            id: "3wTTu",
            head: "⛪🏳️‍🌈Queere Christ*innen🏳️‍🌈⛪<br>Freitag, 16.07.2021<br>ab 19 Uhr",
            body: "Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 16.07. ab 19 Uhr im Pfarrgarten von St. Ulrich, Ulrichsplatz 11. Um etwas mit der Anzahl der Personen planen zu können, bitten sie um eine kurze Anmeldung auf praesenz@qcaux.de. Weitere Infos unter www.qcaux.de",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1626454800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "15"
        },
        {
            _id: {
                $oid: "60e20e622e668400135993c1"
            },
            id: "VdlkP",
            head: "🥖🔥Lagerfeuer mit Stockbrot🔥🥖<br>Donnerstag, 22.07.2021<br>ab 19 Uhr bei der ESG-Cafete",
            body: "Ein Abschied ist auch ein Neuanfang.<br><br>Bei Lagerfeuer und Stockbrot feiern wir das Ende des Semesters und des Schuljahres und verabschieden uns von allen, die gehen oder in den Urlaub fahren. 🔥🥖<br><br>Bitte bringt nach Möglichkeit einen ungiftigen (!) Stock (z.B. Haselnuss, Buche und Weide) für euer Brot mit.<br>Wenn ihr den Abend mit Gitarre, Geschichten und Gesang bereichern würdet, wäre das wunderbar. 🙌🎸<br><br>Helfende Hände sind herzlich willkommen! Einfach eine Stunde früher kommen oder am Ende etwas anpacken. (Vielen Dank im voraus!) 💪🤗<br><br>Ab 19 Uhr bei der ESG-Cafete, Salomon-Idler-Straße 14 (https://maps.app.goo.gl/XeB6H9N7Qn78aXRS8). Bei der Eingangstür einfach hinten in den Garten gehen. Es gibt Parkmöglichkeiten direkt bei der Cafete. Tramhaltestelle Linie 3 Universität. 🗺️<br><br>Es ist eine Anmeldung digital über unser Anmeldetool (queer-augsburg.de/anmelden) oder vor Ort auf Papier erforderlich. Maximal 50 Personen, egal ob geimpft oder genesen!<br><br>Es gelten folgende Corona-Regeln:<br>Immer Abstand halten.<br>Beim Herumlaufen FFP2-Maske treffen.<br>Beim Hinsetzen ist Maske abnehmen erlaubt.<br>Nicht mehr als 10 Personen an einem Tisch.<br><br>Queer Augsburg ist kein Verein und kann daher für nichts haften. Teilnahme auf eigenes Risiko!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1626973200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "60e20f352e668400135993c5"
            },
            id: "4MV3G",
            head: "🌳🍻Queergarten🏳️‍🌈🌳<br>Freitag, 23.07.2021<br>18 Uhr im Wirgarten",
            body: "<br>Wenn euch unsere Kennenlerntreffen noch nicht genug sind, dann schaut auch gerne am Freitag beim QUEERGARTEN vorbei! ☺️<br><br>Zusammen mit anderen Queeren Organisationen aus Augsburg übernehmen wir für vier Termine den WirGarten im Provino und machen daraus einen QUEERGARTEN. Bis bald, wir freuen uns auf euer kommen! ☺️✨<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1627056000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "70"
        },
        {
            _id: {
                $oid: "60e23d1e9ad816001343fb93"
            },
            id: "vuB39",
            head: "🕊️👊🏳️‍🌈<br>Queerer Tag Taubenschlag<br>Samstag, 31.07.2021<br>ab 12 Uhr auf dem Elias-Holl-Platz",
            body: "<br>Die queere Abteilung des Stadtraum e.V. Queerosaurus hat zusammen mit der Aidshilfe ein buntes Samstagsprogramm zum queeren Tag des Taubenschlags auf die Beine gestellt.<br><br>Wie wird mit Queerness in den verschiedenen religiösen Gemeinschaften umgegangen? Auf welche Art sind queere BIPoC  intersektionell betroffen? Wie gestaltet sich queere Sichtbarkeit in den Medien? Freut euch den ganzen Tag über diese und andere Themen sowie Musik und DJ Mix am Abend.<br><br>Eine Aktion von Queerosaurus.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1627725600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "60f5f9b0000765001326c0c7"
            },
            id: "IPyI8",
            head: '🌳🥪Augsburger Friedenspicknick mit Tanz, Musik und "Für_Sorge"-Workshop 🕊🦄<br>Sonntag, 08.08.2021<br>ab 13 Uhr',
            body: "<br>Es ist Augsburger Friedensfest und<br>zusammen mit dem Augsburger Freiwilligenzentrum möchten wir uns kümmern!<br><br>Ab 13 Uhr seid Ihr deshalb eingeladen zu einem Nachmittagsprogramm im Freiwilligen-Zentrum - mit Friedensfest-Picknick, einem philosophischen Diskussionsworkshop zum Thema »Für_Sorge für mich und für den anderen«, Geschichten über gelingendes freiwilliges Engagement, Tanz, Musik und vielem mehr.<br><br><br>Am Mittleren Lech 5<br>86150 Augsburg<br>Im Hof des paritätischen Jakobsstifts<br><br>Es ist keine Anmeldung erforderlich. An FFP-2 Maske denken. Zu den weiteren Hygiene-Bestimmungen werdet ihr vor Ort informiert. Bei schlechtem Wetter findet die Veranstaltung in den Innenräumen des Freiwilligenzentrums statt.<br><br>Weitere Informationen unter: https://www.freiwilligen-zentrum-augsburg.de/",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1628420400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "30"
        },
        {
            _id: {
                $oid: "60f5ff79000765001326c0cd"
            },
            id: "zyaT2",
            head: "🌳🍻Queergarten im Wirgarten🏳️‍🌈🌳<br>Freitag, 27.08.2021<br>ab 18 Uhr",
            body: "Wenn euch unsere Kennenlerntreffen noch nicht genug sind, dann schaut auch gerne am Freitag beim QUEERGARTEN vorbei! ☺️<br><br>Zusammen mit anderen Queeren Organisationen aus Augsburg übernehmen wir für vier Termine den WirGarten im Provino und machen daraus einen QUEERGARTEN. Bis bald, wir freuen uns auf euer kommen! ☺️✨",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1630080000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "35"
        },
        {
            _id: {
                $oid: "610b204606f0cb00134103a5"
            },
            id: "cEhjm",
            head: "🌵💡Botanischer Garten mit Lichterzauber💡🌳<br>Samstag, 14.08.2021<br>ab 19 Uhr",
            body: "Fleischfressende Pflanzen, Japanischer Garten oder die Mimosen im Gewächshaus? Alles ist schöner und unheimlicher in der Dämmerung!<br><br>Nutze mit uns den letzten Termin des Jahres für den Beleuchtungsabend und streife mit durch die wunderschön erleuchtete Pflanzenwelt. Vielleicht treffen wir Frösche im Teich🐸 oder statten den Sukkulenten🌵 im Steingarten einen Besuch ab, vielleicht schauen wir auch spontan im Kastanienbiergarten vorbei🍺🍁. Alles ist möglich.<br>Wir treffen uns gegen 19 Uhr vor dem Kassenbereich.<br><br>Teilnahme ab 16! Wir sind kein Verein und auch keine Jugendgruppe. Wir können weder haften noch eine Aufsichtspflicht übernehmen. Teilnahme auf eigenes Risiko!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1628956800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "610b214106f0cb00134103a8"
            },
            id: "USVbb",
            head: "🦚Zoobesuch mit queeren Pinguinen und Flamingos 🐧<br>Donnerstag, 19.08.2021<br>ab 15 Uhr",
            body: "<br>Pinguine, Flamingos, Pfauen und andere Paradiesvögel: Wir erkunden gemeinsam die Augsburger Zoolandschaft. Wie viele queere Tiere wir wohl finden?🦩<br><br>Treffen um 15 Uhr vor dem Kassenbereich.<br><br>Wir sind kein Verein und auch keine Jugendgruppe. Wir können weder haften noch eine Aufsichtspflicht übernehmen. Teilnahme auf eigenes Risiko!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1629378000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "3"
        },
        {
            _id: {
                $oid: "610c87fc06f0cb00134103f0"
            },
            id: "9Mqk1",
            head: "⛪🏳️‍🌈Queere Christ*innen 🏳️‍🌈⛪<br>Freitag, 20.08.2021<br>ab 19 Uhr",
            body: "Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 20.08. ab 19 Uhr im Pfarrgarten von St. Ulrich, Ulrichsplatz 11. Um etwas mit der Anzahl der Personen planen zu können, bitten sie um eine kurze Anmeldung auf praesenz@qcaux.de. Weitere Infos unter www.qcaux.de",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1629478800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "610c893c06f0cb00134103f5"
            },
            id: "xo23Y",
            head: "🏳️‍🌈⚖Senat Open🏛🔓<br>Donnerstag, 26.08.2021<br>ab 19 Uhr auf Zoom",
            body: "Wolltet ihr schon immer wissen wie so ein Senatsalltag aussieht? Wie sich die Senatsmitglieder die Aufgaben aufteilen? Oder welche Kooperationen geplant sind? Queer Augsburg ist transparent: Fragt unsere Senator*innen alles, was euch grad auf den Nägeln brennt.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1629997200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "4"
        },
        {
            _id: {
                $oid: "612ec95f06f0cb0013410c39"
            },
            id: "DdEsm",
            head: "💙💜💖Bi Visibility Day<br>Donnerstag, 23.09.2021<br>ab 19 Uhr auf Zoom🏳️‍🌈",
            body: "Das Spektrum von Bi+ ist groß. Mit unserer Aktion zum Bi Visibility Day wollen wir für mehr Sichtbarkeit der Vielfalt der Bi+Community sorgen.<br><br>Bi+Personen werden häufig mit Vorurteilen und Klischees konfrontiert. Bi+Erasure, also die fortwährende Unsichtbarmachung von Bi+Personen, in der Gesellschaft ein ständiger Begleiter. Auch innerhalb der queeren Community sind Bi+Personen von Gatekeeping betroffen.<br><br>Egal ob du bi+ bist oder nicht: Du bist herzlich eingeladen an diesem Donnerstag an unserem eigenen Beitrag zum Bi+Visibility Day teilzunehmen. Diskutiere mit uns wie wir gemeinsam die queere Community zu einem Safespace für Bi+Personen machen können und frage alles, was du schon schon immer über bi+ wissen wolltest.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1632416400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "612f6ca706f0cb0013410c54"
            },
            id: "9KxMs",
            head: "Queer Augsburg Meet<br>Donnerstag, 02.09.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1630602000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "6130ac2506f0cb0013410cbd"
            },
            id: "gOXz6",
            head: "Queer Augsburg Meet<br>Donnerstag, 16.09.2021<br>ab 19 Uhr im Unikum📓🍔",
            body: "<br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal im Unikum.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Keine Anmeldung erforderlich. Da wir drinnen sitzen musst du allerdings Geimpft Getestet oder Genesen sein. (Und das auch nachweisen können)<br><br>Queer Augsburg ist kein Verein und kann für nichts haften. Teilnahme auf eigenes Risiko!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1631811600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "6130ae5b06f0cb0013410cc7"
            },
            id: "ElVlY",
            head: "🌞🏖Queer Augsburg Summer Scrap Book📒📸<br>Donnerstag, 09.09.2021<br>ab 19 Uhr auf Zoom",
            body: '<br>  Wie hast du den Sommer verbracht? In der Stadt, auf dem Land oder am Fluss?🚣‍♂️ Fleißig Muscheln gesammelt oder die Schuhe am Berg durchgetragen?🧗‍♀️ Die Museen unsicher gemacht oder die Bars?🍻 Oder ging es bei dir doch ins berühmt-berüchtigte Balkonien?🤭<br><br>Bringe 4-5 Gegenstände, Photos, Tickets, Souvenirs etc. mit und teile mit uns deine Sommererlebnisse!😎 Gerne kannst du diese als eine digitale oder analoge Version einer Scrapbook- bzw. Photoalbumseite zum Herumzeigen gestalten. Aber kein "Muss"!😉<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1631206800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "61317b5506f0cb0013410d16"
            },
            id: "l9sfA",
            head: "⛪🏳️‍🌈Queere Christ*innen<br>Freitag, 17.09.2021🏳️‍🌈⛪<br>ab 19 Uhr",
            body: "Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 17.09. ab 19 Uhr. Um etwas mit der Anzahl der Personen planen zu können, bitten sie um eine kurze Anmeldung auf praesenz@qcaux.de. Weitere Infos unter www.qcaux.de.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1631898000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "61317df706f0cb0013410d1c"
            },
            id: "5q6Xe",
            head: "🍻🌳Queergarten im Wirgarten🏳️‍🌈🌳<br>Freitag, 24.09.2021<br>ab 18 Uhr",
            body: "Wenn euch unsere Kennenlerntreffen noch nicht genug sind, dann schaut auch gerne am Freitag beim QUEERGARTEN vorbei! ☺️<br><br>Zusammen mit anderen Queeren Organisationen aus Augsburg übernehmen wir für vier Termine den WirGarten im Provino und machen daraus einen QUEERGARTEN. Bis bald, wir freuen uns auf euer kommen! ☺️✨",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1632499200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "614c447c06f0cb001341120c"
            },
            id: "i2Lz5",
            head: '🎬Queer Augsburg Cinema:<br>🏳️‍🌈Preview zum Kinofilm "Trans - I got life"📽<br>Sonntag, 26.09.2021<br>ab 11:30 LILIOM Augsburg',
            body: 'Am Sonntag treffen wir uns um 11:30 Uhr am Liliom Kino um gemeinsam die Preview zum Film "Trans - I got life" anzuschauen. Zur Vorstellung um 12 Uhr werden auch die Regisseurin des Films und evtl. auch Protagonist*innen vor Ort sein.<br><br>Hier könnt ihr euch den Trailer zum Film und die Instagramseite mit vielen Background Infos anschauen:🎞 https://www.instagram.com/tv/CQdRyAsBEtC/?utm_medium=share_sheet<br><br>Wer möchte kann sich eine Karte über die Website des Lilioms reservieren oder diese am Sonntag vor Ort kaufen.🎟 Im Liliom gilt die 3G-Regel und eine Maskenpflicht im Gebäude, auf den Plätzen dürfen diese allerdings abgenommen werden😷.<br><br>Bringt gerne auch Eltern, Geschwister, Freund*innen oder Bekannte mit, die vielleicht mit dem Thema noch wenig Berührung hatten.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1632650400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "614c46cf06f0cb0013411212"
            },
            id: "lZOy4",
            head: "Queer Augsburg Meet<br>Donnerstag, 14.10.2021<br>ab 19 Uhr im Flannigan's Post☘🍻",
            body: "<br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal im Flannigan's Post, Fuggerstraße 5-7.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Bitte beachte die 3-G-Regel in der Gastronomie!<br>Zutritt nur für Geimpfte, Genesene und Getestete.<br><br>Queer Augsburg ist kein Verein und kann für nichts haften. Teilnahme auf eigenes Risiko!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1634230800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "24"
        },
        {
            _id: {
                $oid: "61522dc306f0cb0013411366"
            },
            id: "XI1aD",
            head: "❎👍Bundestagswahl -<br>✉revisited🗳<br>Donnerstag, 30.09.2021<br>ab 19 Uhr auf Zoom<br><br>",
            body: "Ihr habt genug von der Bundestagswahl? Machen wir doch unsere eigene! Wer sind die Kandidat*innen? Was ist das Programm? Wer wird als Sieger*in hervorgehen?<br><br>Am Anfang wollen wir kurz über die Bundestagswahl sprechen. Danach machen wir spaßeshalber unsere eigene. Ziel des Spiels ist es eine eigene Partei zu gründen und Themen für die Wahl aufzustellen. Ob queere Weltherrschaft mit Glitzer und Regenbögen oder flauschige Katzenmonarchie, alles ist möglich.<br><br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1633021200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "3"
        },
        {
            _id: {
                $oid: "615cd587466de000138fd32b"
            },
            id: "qdS8e",
            head: "🎭Improtheater reloaded👏<br>Freitag, den 22.10.2021<br>ab 19 Uhr Projektraum",
            body: "Ohne Skript und Props aber mit angespannten Lachmuskeln starten wir wieder ins spontane Improvisieren.<br><br>Beim Improvisationstheater entstehen die witzigsten Geschichten!<br>Wir werden uns erst mit ein paar grundlegenden Übungen einspielen<br>und dann coole Szenen auf die Bühne bringen. 🎉🎭<br><br>Egal ob Vorerfahrung oder nicht, jeder kann dabei sein!<br><br>Ab 19 Uhr im Projektraum, Wolfgangstraße 2.<br><br><br>Es gilt die 3-G-Regel!<br>Zutritt nur für Geimpfte, Genesene und Getestete.<br><br>Queer Augsburg ist kein Verein und kann für nichts haften. Teilnahme auf eigenes Risiko!<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1634922000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "615dbb5d466de000138fd366"
            },
            id: "k2CQ1",
            head: "Queer Augsburg Meet<br>Donnerstag, 07.10.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1633626000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "615e9d73466de000138fd3ab"
            },
            id: "Zvq8b",
            head: "👋Kennenlernen🤝<br>Donnerstag, 04.11.2021<br>ab 19 Uhr in St. Ulrich",
            body: "Neu in Augsburg? Schon länger hier? Und du möchtest queere Leute kennenlernen?<br><br>Komm zu unserem großes Kennenlerntreffen am 04.11, um 19:00 in St Ulrich!<br><br>Egal ob du gerade nach Augsburg gezogen bist, oder alteingesessen bist. Egal ob du studierst oder nicht. Egal ob jung oder alt. Bei Queer Augsburg sind alle wilkommen! Wir wollen einen Safespace schaffen, der für alle offen ist, wo man sich treffen und kennenlernen kann.<br><br>Am Donnerstag haben wir dafür ein besonderes Kennenlerntreffen. Wir wollen uns vorstellen und gemeinsam Spiele spielen. Uns unterhalten und eine schöne Zeit haben. Lerne die Queere Comunity in Augsburg besser kennen und knüpfe neue Kontakte.🤗🏳️‍🌈<br><br>Interesse? Komm einfach vorbei!<br><br>Das Treffen findet um 19:00 Uhr im Kleinen Saal, Gemeindehaus St. Ulrich, Ulrichsplatz 17 statt<br><br><br>Es gilt die 3-G-Regel!<br>Zutritt nur für Geimpfte, Genesene und Getestete.<br><br>Bitte denkt unbedingt an eure Nachweise (3-G-Regel), Schüler*innen mit Schüler*innenausweis dürften ohne Testnachweis kommen, werden aber vor Ort getestet.🧪<br><br>Es gilt übliche Maskenpflicht.😷 Am Platz darf diese aber abgenommen werden.<br><br>Queer Augsburg ist kein Verein und kann für nichts haften. Teilnahme auf eigenes Risiko!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1636048800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "40"
        },
        {
            _id: {
                $oid: "615e9e58466de000138fd3ae"
            },
            id: "kaMhn",
            head: "🖤♠️⚪💜<br>Asexual Awareness Week<br>Donnerstag, 28.10.2021<br>ab 19 Uhr auf Zoom",
            body: "Anlässlich der Ace Awareness Week haben wir für euch einen Themenabend zum a_sexuellen Spektrum vorbereitet: An diesem Donnerstag laden wir euch zu einem Q&amp;A ein - kommt vorbei und bringt Fragen mit.💬❔<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1635440400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "6168a12d23163b001342948c"
            },
            id: "9y5dF",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 15.10.2021<br>ab 19 Uhr",
            body: "Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 15.10. ab 19 Uhr, kleiner Saal, Gemeindehaus St. Ulrich, Ulrichsplatz 17.<br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1634317200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "616c98e823163b0013429589"
            },
            id: "zCr2p",
            head: "👋Queer Augsburg Meet🤝<br>Donnerstag, 11.11.2021<br>🍹ab 18:45 Uhr Enchilada🌮",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung! 🤗 Diesmal im Enchilada, Hallstraße 4.<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze im Enchilada reserviert. Sie werden nach dem Prinzip First come First Serve vor Ort vergeben. Falls erforderlich und möglich, machen wir nach Kapazität der Location einen weiteren Tisch auf.<br><br>🚦Bitte beachte die 3-G-Plus-Regel in der Gastronomie!🚩<br>Zutritt nur für Geimpfte, Genesene und Getestete.<br><br>Queer Augsburg ist kein Verein und kann für nichts haften. Teilnahme auf eigenes Risiko!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1636653600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "61801e5323163b0013429a9d"
            },
            id: "u2q1E",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 19.11.2021<br>ab 19 Uhr St. Ulrich",
            body: "Endlich ist es wieder möglich sich persönlich zu treffen. Daher freuen sich die Queeren Christ*innen, Euch zu einer gemütlichen Runde mit Ratsch und Tratsch einzuladen. Sie treffen sich am Freitag 19.11. ab 19 Uhr, kleiner Saal, Gemeindehaus St. Ulrich, Ulrichsplatz 17.<br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1637344800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "61804fb423163b0013429ab3"
            },
            id: "giPhi",
            head: "💙💗◻💗💙<br>Trans Awareness Week/<br>Trans Day of Remembrance🕯💐<br>Mittwoch, 17.11.2021<br>ab 19 Uhr auf Zoom",
            body: "Die Transgender Awareness Week ist die Woche im Vorfeld des Tages der Erinnerung an die Opfer transfeindlicher Gewalt und soll der Sichtbarkeit und Bewusstmachung der Belange von trans* Personen dienen.<br><br>Im Zuge dieser Woche hat Queer Augsburg einen Themenabend für euch vorbereitet: Was bedeutet trans*? Wie fühlt sich das an trans* zu sein? Auf welche Hürden stößt man als trans* Person in der Gesellschaft? Ist man gerade als trans* Person speziellen Gefahren ausgesetzt? Und was kann die queere Community tun um ein besserer Ally für trans* Personen zu werden?<br><br><br>Zu diesen und anderen Fragen bist du diesen Mittwoch ab 19 Uhr auf Zoom herzlich eingeladen. Du bist trans*? Dann komm gerne vorbei und teile deine ganz persönliche Erfahrung, wenn du möchtest! Du bist selbst nicht trans*? Dann sei unbedingt dabei und hilf mit einen Safespace für unsere trans* Community zu schaffen.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1637172000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "61832d6fa1435a001320180f"
            },
            id: "YaFVz",
            head: "🖐Queer Augsburg Meet🤝<br>Donnerstag, 25.11.2021<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romatische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1637863200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "619aced2a1435a0013201e04"
            },
            id: "eH4I7",
            head: "✊Sei cute, zeig Schleife!-Themenabend zum<br>Welt-AIDS-Tag🧸❣️<br>Donnerstag, 02.12.2021<br>ab 19 Uhr auf Zoom",
            body: "Anlässlich des Welt-AIDS-tags veranstalten wir in Kooperation mit der Augsburger-AIDS-Hilfe einen Abend rund um das Thema HIV.<br><br>Ute und Flo von der Aidshilfe Augsburg werden uns einen kleinen Input zu Diskriminierungserfahrungen durch HIV und dem lokalen Testangebot Checkpoint sowie mehr zum Thema PrEP und Safer Sex geben. 🙌🏻😊<br><br>Wir freuen uns auf einen lehrreichen Abend und bedanken uns für die Unterstützung der Augsburger-AIDS-Hilfe e.V.<br><br>✊Solidarisiert euch und seid dabei, damit wir gemeinsam Wissen vermehren und uns gegen die Krankheit und Stigmatisierung stark machen!💪<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1638468000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "619acf55a1435a0013201e06"
            },
            id: "yP0a4",
            head: "👩‍⚕️Mental Health Matters!🧠<br>Donnerstag, 6. Januar<br>ab 19 Uhr auf Zoom",
            body: "<br>❗TW: Mental health und psychische Erkrankungen<br><br><br>Wir leben im 21. Jahrhundert - ein Zeitalter des Fortschritts in Wissenschaft, Wirtschaft, Technik, und trotzdem werden psychische Krankheiten immernoch in vielen gesellschaftlichen Bereichen tabuisiert.🤐<br><br>Erfahrungsgemäß sprechen die Wenigsten offen und ungezwungen über ihre psychischen Erkrankungen und suchen in den entscheidenden Momente keine Hilfe.😔<br>Doch warum ist das so? Um diese komplexe Frage zu beantworten bedarf es Aufklärung und Diskussion.💬<br><br>Sei deshalb dabei, wenn wir über dieses sehr wichtige, sensible Thema sprechen und folgende Fragen gemeinsam diskutieren:<br>- Was bedeutet es, psychisch krank zu sein und welche verschiedenen Erkrankungen gibt es?<br>- Wie merke ich, wenn es mir seelisch nicht gut geht und wohin kann ich mich dann hinwenden?<br>- Was kann ich tun, um meine psychische Lebensqualität selbst zu verbessern?<br>- Wie schaffen wir es, psychische Krankheiten zu entstigmatisieren?<br><br>Ich (Kübra) freue mich auf einen interessentanten Abend mit Euch!<br><br>❗Wir sind keine ausgebildeten Psycholog*innen und können weder während der Veranstaltung psychologische/psychiatrische Hilfe noch Aftercare anbieten. Bitte nehmt an dem Themenabend nur teil, wenn ihr emotional genug gefestigt seid mit der Thematik umzugehen.❗<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1641492000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "619acff5a1435a0013201e09"
            },
            id: "0LunC",
            head: "🏳️‍🌈🌲Queermas Weihnachtsfeier🎄🛷<br>Donnerstag, 16.12.2021<br>ab 18:55 Uhr auf Zoom",
            body: "<br>Schmückt euer Bäumchen schon mal in allen Regenbogenfarben, denn zusammen mit den Queeren Christ*innen planen wir eine digitale Weihnachtsfeier.<br><br>🦌Los geht es am Donnerstag um 18:55 Uhr auf Zoom. Gemeinsam mit den Queeren Christ*innen und Queerspace Königsbrunn blicken wir auf das vergangene Jahr zurück, hören die Weihnachtsgeschichte und spielen weihnachtliche Spiele in gemütlicher Atmosphäre. Seid pünktlich, denn wir haben viel Programm mit euch vor🤗🎄.<br><br><br>Ab 18:55 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1639677600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "20"
        },
        {
            _id: {
                $oid: "61a64f07a1435a0013202085"
            },
            id: "P1eU4",
            head: "🖐Meet am Sonntag🤝<br>Sonntag, 19.12.2021<br>ab 19 Uhr auf Zoom",
            body: "Unser beliebtes Format, diesmal für alle, die Donnerstags bzw. unter der Woche nicht können, an einem Sonntag.<br><br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1639936800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "61a6576ea1435a001320208a"
            },
            id: "PbR9g",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 17.12.2021<br>19 Uhr",
            body: "Die Queeren Christ*innen treffen sich auch diesen Freitag in digitaler Runde.<br><br>Weitere Infos unter www.qcaux.de.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1639764000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "61a6805ba1435a00132020a0"
            },
            id: "lmlwR",
            head: "🖐Queer Augsburg Meet🤝<br>Mittwoch, 08.12.2021<br>ab 19 Uhr auf Zoom",
            body: "<br>Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1638986400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "61d427366d39740013c65776"
            },
            id: "Oz8u1",
            head: "🤝Queer Augsburg Meet🖐<br>Donnerstag, 13. Januar<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1642096800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "61d427b16d39740013c65779"
            },
            id: "iMo9X",
            head: "🤝Queer Augsburg Meet🖐<br>Donnerstag, 27. Januar<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1643306400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "61d429356d39740013c6577f"
            },
            id: "lZe1k",
            head: "⛪Queere Christ*innen🏳️‍🌈<br>Freitag, 21. Januar<br>ab 19 Uhr auf Zoom",
            body: "Die Queeren Christ*innen treffen sich auch diesen Freitag in digitaler Runde.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1642788000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "61d429766d39740013c65781"
            },
            id: "GgKSI",
            head: "⛪Queere Christ*innen🏳️‍🌈<br>Freitag, 18. Februar<br>ab 19 Uhr auf Zoom",
            body: "Die Queeren Christ*innen treffen sich auch diesen Freitag in digitaler Runde.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1645207200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "61d429f86d39740013c65783"
            },
            id: "0fM9e",
            head: "Lesbian Visibility Day<br>Dienstag, 3. Mai<br>ab 19 Uhr auf Zoom<br>❤️🧡🤍💗💜",
            body: "Am diesjährigen Lesbian Visibility Day möchten wir mit euch Lesbische Subkulturen in Deutschland und weltweit genauer besprechen!<br><br>Wir freuen uns auf regen Austausch und Diskussionen mit Menschen jeglicher sexueller Orientierung, nicht-lesbische Personen sind natürlich auch explizit willkommen!🧡🤍💗<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1651597200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "61d42b4a6d39740013c65789"
            },
            id: "4cTTp",
            head: "💙💗🤍💗💙<br>We are sick of dysphoria!<br>Trans Day of Visibility<br>Donnerstag, 31. März<br>ab 19 Uhr Zoom<br>🏳️‍⚧️",
            body: "We are sick of dysphoria! Kaum ein Themenabend zum Thema trans* und wir sprechen wieder über Diskriminierung, Misgendering und Dysphorie?<br><br>Diesmal nicht! Am diesjährigen Tag der Trans*-Sichtbarkeit möchten wir den Fokus auf Geschlechtseuphorie legen und mit euch darüber reden, wie und was uns trans* Personen ein gutes Gefühl gibt. Und vor allem wie und was cis Personen tun können um uns ein paar Gender-Euphoria-Flügel zu verleihen.<br><br>Besonders herzliche Einladung an cis Personen, ihr seid ausdrücklich willkommen Fragen in einem offenen und respektvollen Safe Space zu stellen.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1648746000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "61df888a276ac5001379e7b7"
            },
            id: "kQecI",
            head: "Queer Augsburg Urlaub<br>Washington DC<br>Sonntag, 3. April<br>ab 20 Uhr auf Zoom<br>🇺🇸🌸",
            body: "Unser US-Korrespondent berichtet aus der amerikanischen Hauptstadt! Kommt mit auf einen Sonntagsspaziergang durch die National Mall live aus Washington DC!<br>🇺🇸<br>Erlebt das Kapitol, den Supreme Court, die Library of Congress, das Washington Monument, das Weiße Haus, das WW2-, Vietnam-, Lincoln-, Martin-Luther-King-Jr.- und Jefferson-Memorial während die Stadt vor Kirschblüten erstrahlt.<br>🌸<br><br>Ab 20 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1649008800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "61efcdfca3535b0014622470"
            },
            id: "37s6x",
            head: "🖤🤍💚🏹<br>Aromantic Awareness Week<br>Donnerstag, 24. Februar<br>ab 19 Uhr auf Zoom",
            body: "<br>Was ist A_romantik? Und was macht das ganze aro-Spektrum aus? Und was haben gesellschaftliche Normen mit Romantik zu tun? Und wie können queere Beziehungsstrukturen außerhalb von Romantik aussehen?<br><br>Anlässlich der Aromantic (Spectrum) Awareness Week ist ein Themenabend rund um diese Fragen geplant. Zwischen quasi-Vortrag und Q&amp;A können Fragen und persönliche Erfahrungen geteilt werden.<br><br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1645725600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "61f384dca3535b0014622546"
            },
            id: "qhSx7",
            head: "🏳️‍🌈 2022 🏳️‍⚧️",
            body: "Frohes Neues!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1641013200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "61f3850fa3535b0014622548"
            },
            id: "bwu2a",
            head: "🏳️‍🌈 2021 🏳️‍⚧️",
            body: "Frohes Neues!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1609477200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "61f38538a3535b001462254a"
            },
            id: "hK8ln",
            head: "🏳️‍🌈 2020 🏳️‍⚧️",
            body: "Frohes Neues!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1577854800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "61fd66aea3535b0014622809"
            },
            id: "ZywEP",
            head: "🖐Queer Augsburg Meet🤝<br>Donnerstag, 17. Februar<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1645120800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "9"
        },
        {
            _id: {
                $oid: "61fd6835a3535b001462280e"
            },
            id: "DfLvo",
            head: "Queer Augsburg Presents<br>Queer History Month📖<br>Donnerstag, 10. Februar<br>ab 19 Uhr auf Zoom",
            body: 'Februar ist der Monat der queeren Geschichte, also lässt uns gemeinsamen in den queeren Archiven kramen: Bringe eine queere Person oder ein Ereignis der queeren Geschichte mit in die Runde und erzähle uns davon! Wir lernen gemeinsam von- und miteinander.💪😉📚<br><br><br>Oder wolltest du schon immer die wahre Geschichte hinter Lili Elbe und dem Film "The Danish Girl" kennen?🎞 Dann sei am Donnerstag dabei!<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1644516000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "11"
        },
        {
            _id: {
                $oid: "61fd6918a3535b0014622812"
            },
            id: "gJlNn",
            head: "Themenabend zum 8. März<br>🚺<br>Montag, der 7. März<br>ab 19 Uhr auf Zoom",
            body: 'Am 8.März wird der feministische Kamptag mit Demonstrationen gefeiert. Welche Geschichte trägt dieser Tag und wieso ist er heute noch so unglaublich relevant?<br><br>Von einem historischen Abriss zum 8.März über das Thema "Feministische Arbeitskämpfe verbinden" hin zur Notwendigkeit von gemeinsamen politischen Kämpfen hat für uns am Vorabend des Internationalen Frauentages Theresa einen interessanten Vortrag vorbereitet. Wir diskutieren über antifeministische Rhetorik und die Notwendigkeit einer neuen Terminologie, da patriarchale Strukturen nicht nur gegen Frauen gehen.⚧<br>Sei dabei! All Gender welcome✊.<br><br>Und zum live Reinschnuppern läd bereits heute, Samstag den 5.3, zum feministischen Beisammensein am Rathausplatz das Feministische Streikkomitee Augsburg.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1646676000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "620eb3fda3535b0014622c32"
            },
            id: "ywfLh",
            head: "⛪Queere Christ*innen🏳️‍🌈<br>Freitag, 18. März<br>ab 19 Uhr im Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im Kleinen Saal des St. Ulrich, Ulrichtsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1647626400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "621e6682a3535b0014622f98"
            },
            id: "ehPPe",
            head: "🖐Queer Augsburg Meet🤝<br>Mittwoch, der 2. März<br>ab 20 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Ab 20 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1646247600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "3"
        },
        {
            _id: {
                $oid: "621e67d8a3535b0014622f9b"
            },
            id: "vUfdp",
            head: "🖐Queer Augsburg Meet🤝<br>Dienstag, 15. März<br>ab 19 Uhr auf Zoom",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1647367200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "622faabaa3535b001462345e"
            },
            id: "yURSt",
            head: "International Asexuality Day<br>Mittwoch, 6. April<br>ab 19 Uhr auf Zoom<br>🖤♠️⚪💜",
            body: "<br>  Am diesjährigen Internationalen Tag der Asexualität stellen wir euch das asexuelle Spektrum, Geschichte dazu und Symbole aus der asexuallen Community vor. Kommt gerne vorbei. Wir freuen uns auf gemeinsamen Austausch, eure Fragen könnt ihr hier ganz offen (&amp;respektvoll) stellen.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.<br>Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1649264400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "62302d7da3535b0014623477"
            },
            id: "nKTVO",
            head: "🤝Queer Augsburg Meet👋<br>Donnerstag, 28. April<br>ab 19 Uhr Zeughausstuben<br>🍖🍻🥨",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns um 19 Uhr in der Zeughausstuben. Bei gutem Wetter dort im Biergarten. Bitte macht nach Möglichkeit vorab einen Selbsttest, nehmt aufeinander Rücksicht und bleibt bei Erkältungssymptomen zuhause.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg oder Matthis.🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1651165200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "6241377ca3535b0014623a2c"
            },
            id: "XWOtf",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 8. April<br>ab 19 Uhr Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im UlrichsEck, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1649437200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "624f69aa7a790000148c89ed"
            },
            id: "q9jeI",
            head: "🤝Queer Augsburg Meet👋<br>Dienstag, 10. Mai<br>ab 19 Uhr Enchilada<br>🍹🌯🌮",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg oder Leo/Matthis.🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1652202000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "624f6a157a790000148c89f0"
            },
            id: "9YaKu",
            head: "🤝Queer Augsburg Meet👋<br>Dienstag, 24. Mai<br>ab 19 Uhr im Ratskeller<br>🥨🍖🍻",
            body: "Triff lesbische, schwule, trans*, bisexuelle, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg oder Leo/Matthis.🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1653411600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "11"
        },
        {
            _id: {
                $oid: "624f6a927a790000148c89f2"
            },
            id: "VeqMX",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 20. Mai<br>ab 19 Uhr im Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im UlrichsEck, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1653066000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "624f6acf7a790000148c89f4"
            },
            id: "qeXCu",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Samstag, 18. Juni<br>ab 20:30 Uhr Moritzkirche",
            body: "Die Queeren Christ*innen treffen sich statt wie immer Freitags diesen Samstag als Get together direkt nach dem CSD Gottesdienst.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1655577000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "626263957a790000148c8e6d"
            },
            id: "TFa0Z",
            head: "Queer Augsburg Explores:<br>Japanisches Frühlingsfest<br>🌸🍡🍵<br>Sonntag, 8. Mai<br>ab 12 Uhr Botanischer Garten",
            body: '🥳Queer Augsburg wird drei!🎂<br><br>Dem Anlass gebührend besuchen wir mit Pride und Cosplay das nun nach zwei Jahren Pause erstmals wieder stattfindende japanische Frühlingsfest.<br><br>Zwischen dem Klang von Taiko-Trommeln, Origamikunst und poetischen Haikus wollen wir bei erfrischendem Kakigori oder mit einem Becher Sake auf Queer Augsburg anstoßen und den japanischen Garten mit Glitzerstaub und Regenbogen schmücken. Bringt daher gerne eure Pridefarben mit.😉🏳️‍🌈<br><br>Im Cosplay oder traditioneller japanischer Kleidung ist der Eintritt für euch sogar kostenlos.<br><br>Wir treffen uns am großen Brunnen beim Eingang des Botanischen Gartens, Dr-Ziegenspeckweg 10, um 12 Uhr.<br><br><br>Meldet euch in der großen WhatsApp Gruppe, falls ihr uns nicht findet oder unterwegs "verloren" geht.<br><br>🏳️‍🌈👘🍣🍱🍲',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1652011200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "626903fc7a790000148c8fd2"
            },
            id: "kZo8f",
            head: "Queer Augsburg Cinema:<br>Augsburger Kurzfilmtage<br>Donnerstag, 16. Juni<br>ab 19 Uhr im Liliom<br>🎬📽🎞",
            body: 'Feministische Kurzfilme made in Augsburg! Unter dem Motto "FLINTA* werden laut" rief das Mehrfrau_kulturkollektiv zum Filmemachen auf. Wo werden FLINTA* nicht gehört, belästigt, gesilencet?🙉🙈🙊<br><br>Das Resultat sind 10 Filme, vom humorvoll bis ernst, aber allesamt kritisch. Nun hast du die Möglichkeit diese tollen Filme auch auf einer Kinoleinwand zu sehen! Komm mit uns auf eine cineastische Auseinandersetzung.✊<br><br>Und psst: Es wirkt gemunkelt, dass auch ein paar Queer Augsburg Einhörner beteiligt gewesen sein sollen!🦄<br><br>*FLINTA steht für FRAUEN, LESBEN, INTER*, NICHTBINÄRE, TRANS* und AGENDER Personen.<br><br>Wir treffen uns im Foyer des Liliom. Anmeldung nicht notwendig, aber um besser planen und ggf. Kartenreservierungen vornehmen zu können, kannst du uns gerne vorher Bescheid geben. Wir freuen uns auf dich!😊💫',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1655398800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "627f6eb37a790000148c97b7"
            },
            id: "Gbkel",
            head: "Queer Augsburg Urlaub:<br>🇺🇲🎙🎧<br>Washington DC - die Zweite<br>Donnerstag, 19. Mai<br>ab 19 Uhr auf Zoom",
            body: "🎙🎧Unser US-Korrespondent berichtet ein zweites Mal aus der amerikanischen Hauptstadt.<br>Kommt mit auf einen Donnerstagssspaziergang durch den westlichen Teil der National Mall live aus Washington DC!<br>🇺🇸<br>Erlebe das das Washington Monument, das Weiße Haus, das WW2-, Vietnam-, Lincoln-, Martin-Luther-King-Jr.- und Jefferson-Memorial.<br><br>Ab 19 Uhr auf Zoom.<br>Keine Anmeldung erforderlich.Link auf Anfrage per Mail an mail@queer-augsburg.de oder PN auf Instagram/Twitter.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1652979600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "4"
        },
        {
            _id: {
                $oid: "627f700b7a790000148c97c1"
            },
            id: "h348g",
            head: "Basteln für die CSD Augsburg Parade<br>Samstag, 18. Juni<br>ab 9 Uhr am Rathausplatz<br>💜💙💚💛🧡❤",
            body: "<br>  Kommt mit uns, seid stolz und werdet sichtbar!<br>Diesen Samstag um 11 Uhr geht die Augsburger CSD Parade am Königsplatz los. Dafür wollen wir uns richtig bunt herausputzen! ✨🌈💄<br><br><br>Alle die wollen, treffen sich daher ab 9 Uhr an den Bänken vor der Tourist*innen-Information am Rathausplatz, um Glitzer und Makeup aufzutragen, Banner, Logos und Plakate zu basteln und unsere Outfits zurechtzumachen. 🏳️‍🌈🏳‍⚧👠👑🌟<br><br><br>Für die Schilder brauchen wir noch bunte Acrylfarben, Spraydosen und Karton. Du kannst es einfach mitbringen oder dich zur Koordination unter csd@queer-augsburg.de melden.<br>Danke! ✨🌈<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1655553600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "628a72abf538cb00129266e7"
            },
            id: "TS6HN",
            head: "<br>Queer Augsburg Travels:<br>CSD Sommer<br>🏳️‍🌈🏳️‍⚧️☀️",
            body: "Der CSD-Sommer ist nah! Wir wollen mit dem Neun-Euro-Ticket bunte Straßenfeste genießen, Flagge zeigen und Queers aus ganz Deutschland kennenlernen! Fülle die Umfrage aus, hilf eine Fahrt zu organisieren und komm mit!<br><br>https://forms.gle/2JDbzCcd3NgcMC4v8",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1654038000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62914b05f538cb0012926973"
            },
            id: "GXWTQ",
            head: "Queer Augsburg Travels:<br>CSD am Bodensee<br>Samstag, 9. Juli<br>🏳️‍🌈🏳️‍⚧️☀️",
            body: "<br>‼AKTUALISIERUNG: LEIDER KANN DIESE FAHRT NICHT STATTFINDEN‼<br><br>Die erste CSD-Fahrt des CSD Sommers steht! Fahre mit Annabel und weiteren queeren Freund*innen am Samstag, den 9. Juli 2022, zum CSD am Bodensee in Kreuzlingen und Konstanz!<br><br>Treffpunkt und Abfahrt ist um 7:24 Uhr am Hauptbahnhof in Augsburg.<br><br>🏳️‍🌈Die Demo beginnt um 12 mit anschließendem Event und Picknick im Stadtgarten. Da das Picknick ein Selbstversorger Picknick ist, wäre es schön wenn ihr was zu Essen/Trinken mitbringt. 🥪🥤🍏<br><br>Komm mit und sei beim bunten CSD Sommer dabei! 🤗🏳️‍🌈🏳‍⚧",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1657346400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6295e180f538cb0012926b0d"
            },
            id: "j55St",
            head: "👋Queer Augsburg Meet🤝<br>Dienstag, 7. Juni<br>ab 19 Uhr im Flannigan's Post<br>🍻☘🥃🎻",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg oder Leo/Matthis.🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1654621200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "629cb5e1f538cb0012926cd3"
            },
            id: "iC3bY",
            head: "Queer Augsburg<br>trans* Treff<br>🖐🏳‍⚧✊<br>Donnerstag, 23. Juni<br>ab 18 Uhr im Biergarten des Liliom🎬🍺🌳",
            body: "<br>Die Augsburger Pride Week ist zu Ende aber uns hält das doch nicht auf weiterhin stolz und sichtbar zu bleiben! Queer Augsburg meldet sich zurück mit einem neuen Format:<br><br>Wolltest du dich schon immer über die life hacks zu Binding, Tucking und genderaffirmative stuff austauschen? 👙👔🛍💇‍♂️👠💄Oder mal wieder Dampf über das letzte nervige Misgendering ablassen?🗯💥🤬 Oder bist du gerade am Questioning und wolltest ungeoutet mal in die Erfahrungen der trans* Community reinlauschen?👂Dann joine uns zu unserem T*-Kränzchen in einem Café oder Bistro der Stadt.☕🧁🥪<br><br><br>Queer Augsburg trans* Treff ist das Treffen für trans* Frauen, trans* Männer, nichtbinäre, genderqueere, inter* Personen and friends.<br><br>Dieses mal treffen wir uns im Biergarten des Liliom Kino (bei schlechtem Wetter drinnen).🎬🍺🌳<br>Es sind 10 Plätze auf Queer Augsburg reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Wir freuen uns auf dich.🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1656003600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "62a8511a0dd50800124302b2"
            },
            id: "M32U2",
            head: "🍻🦄Queergarten🐧🌈<br>Freitag, 17. Juni<br>ab 19 Uhr im Provinoclub<br>",
            body: "Und auch im Juni heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1655481600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "62ab141879f2350012847d95"
            },
            id: "nVIhw",
            head: "Queer Augsburg Kultur:<br>TransVision<br>Dienstag, 5. Juli<br>ab 14:30 Uhr im Amerikahaus<br>🖼🧐📚🏳️‍🌈🏛",
            body: 'München hat im Amerikahaus gerade eine spannende Doppelausstellung zur Geschichte und Gegenwart der trans* Community (https://www.amerikahaus.de/transvision).<br><br>Und mit dem 9-Euro-Ticket ist München fast schon so nah wie Augsburg. Klar, dass wir dabei sind!🤗<br><br>Damit ihr euren Münchenausflug flexibel gestalten könnt, treffen wir uns um 14:30 Uhr direkt vor Ort im Amerikahaus. So könnt ihr die Zeit davor für den Besuch der Glyptothek und/oder für eine Shoppingtour nutzen.<br><br>Für alle, die länger bleiben können und den Film im Liliom letzten Sommer verpasst haben: Am Abend wird es um 19 Uhr Film und Talk zu "trans - I got life" von den Regisseurinnen Doris Metz und Imogen Kimmel geben.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1657024200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62b6461c4569210012c19d5b"
            },
            id: "nvzNh",
            head: "🍺🌳Queergarten🦚🌈<br>Freitag, 15. Juli<br>ab 18 Uhr im Provinoclub",
            body: "Und auch im Juli heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1657904400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62b647b44569210012c19d64"
            },
            id: "OO1cv",
            head: "🏳️‍🌈Queere Christ*innen💒<br>Freitag, 15. Juli<br>ab 19 Uhr im Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im UlrichsEck, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1657904400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62b8e11a4569210012c19dd1"
            },
            id: "sUbTq",
            head: "⛺FLINTA*-Festival✊<br>Samstag/Sonntag, 13./14. August im Provinoclub",
            body: "Freut euch auf zwei Tage voller Workshops und abwechslungsreichem Abendprogramm<br>bei dem kooperativen FLINTA*-Festival.<br><br> Unter dem Motto „Raum nehmen“ wird ein empowerndes Umfeld geschaffen, in dem sich feministische Gruppen und FLINTA*-Personen in und um Augsburg vernetzen und austauschen können.💜🤝🏳️‍🌈Dabei soll (queer-)feministische Bildung und Spaß verbunden sowie lokalen Künstler*innen und DJs eine Bühne gegeben werden.🎤🎧<br><br>Unser Team von Queer Augsburg ist am Sonntag ab 15:30 Uhr mit einem Workshop zur trans*-inklusiven Sprache dabei.💬<br><br><br>Das Festival findet am 13. und 14. August jeweils ganztags ab 15:30 Uhr im Provino Club Augsburg statt.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1660483800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "62befc324acc270012c20501"
            },
            id: "AmEfc",
            head: "🖐Queer Augsburg Meet🤝<br>Dienstag, 19. Juli<br>ab 17:30 Uhr<br>auf dem Sonnendeck<br>🏢⛱🍹",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom, Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 17:30 Uhr auf dem Sonnendeck, Ludwigsstraße 28.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg🤗.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1658250000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "62befd1f4acc270012c20505"
            },
            id: "uEYCb",
            head: "🖐Queer Augsburg Meet🤝<br>Dienstag, 23. August<br>ab 19 Uhr<br>auf dem Sonnendeck<br>⛱🍹🌞",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung!<br><br>Wir lernen uns bei lockeren Gesprächen, Spielen oder Essen und Trinken kennen - Mal auf Zoom, Mal persönlich in wechselnden Cafés und Bars in der Stadt.<br>Komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr auf dem Sonnendeck, Ludwigsstraße 28.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls ihr uns nicht findet, fragt einfach nach Queer Augsburg🤗.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1661274000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "62bf62dc4acc270012c2051d"
            },
            id: "5nKOM",
            head: "🍺🌳Queergarten🦖🌈<br>Freitag, 26. August<br>ab 18 Uhr im Provinoclub",
            body: "Und auch im August heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1661529600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62c182c14acc270012c20578"
            },
            id: "GBhFj",
            head: "LGBT+ in Japan aus rechtlicher Sicht<br>🏳️‍🌈🏳️‍⚧️🇯🇵<br>Freitag, 22. Juli<br>von 9 bis 17 Uhr im Management Center des ZWW",
            body: "An der juristischen Fakultät der Universität Augsburg wird es ein Symposium zu queerbezogenen Fragen im Japan geben. Es werden unter anderem verfassungs-, arbeits- und familienrechtliche Aspekte behandelt. Dabei soll zugleich ein Bezug zu der Rechtsentwicklung und der aktuellen Situation in<br>Deutschland hergestellt werden.<br>🎌⛩️🗾<br><br>📍Veranstaltungsort: Management Center des ZWW – Universität Augsburg, Universitätsstraße 12 &amp; 16, 86159 Augsburg<br><br>📩 Anmeldung per E-Mail an michaela.braun@jura.uni-augsburg.de<br>Die Plätze sind begrenzt und werden nach Eingang der Anmeldung vergeben. Für externe Teilnehmer*innen wird ein Online-Zugang per Zoom ermöglicht; der Link kann per Mail unter der oben angegebenen Adresse angefordert werden.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1658502000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62c186484acc270012c20584"
            },
            id: "M9fvA",
            head: "Queer Augsburg Travels:<br>🏳️‍🌈CSD München🏳️‍🌈<br>Samstag, 16. Juli",
            body: "<br>‼Bitte meldet euch via Mail, Instagram oder Twitter, falls ihr mitfahren möchtet. Wir haben eine WhatsApp Gruppe erstellt, wo ihr euch vernetzten könnt.‼<br><br><br>Das schönste an Augsburg ist der Zug nach...😜: Wir nehmen um 9:05 Uhr den Zug nach München. Bitte seid rechtzeitig da, damit wir gemeinsam mit dem CSD Augsburg Verein und bunt gen Bayerns Hauptstadt starten können.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1657956000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62e2ffc04acc270012c20abc"
            },
            id: "zlOuO",
            head: "🏳️‍🌈Queere Christ*innen💒<br>Freitag, 19. August<br>ab 19 Uhr im Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im UlrichsEck, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1660928400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "62e4c8924acc270012c20ae7"
            },
            id: "SQI5S",
            head: "<br>🎭Improtheater reloaded👏<br>Donnerstag, 04. August<br>ab 19 Uhr im Projektraum",
            body: "<br>Ohne Skript und Props aber mit angespannten Lachmuskeln starten wir wieder ins spontane Improvisieren.<br><br><br>Beim Improvisationstheater entstehen die lustigsten Geschichten!🤣<br>Wir beginnen mit ein paar grundlegenden Übungen zum Reinkommen und starten dann mit schnellen Impro-Spielen mit Spaß und Begeisterung. 🎉🎭💪<br><br>Egal ob mit oder ohne Vorerfahrung, jede*r kann dabei sein!🤪<br><br>Ab 19 Uhr im Projektraum, Wolfgangstraße 2.<br><br>Bitte gebt uns Rückmeldung, wer schon weiß, dass er*sie kommen möchte, damit wir etwas Planungssicherheit haben für den Raum.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1659632400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "630dd3f5a5ba8100125b5765"
            },
            id: "iJc91",
            head: "🍺🌳Queergarten🦄🌈<br>Freitag, 16. September<br>ab 18 Uhr im Provinoclub",
            body: "Und auch im September heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1663347600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "630dd6d8a5ba8100125b5770"
            },
            id: "KxFxl",
            head: "Queer Augsburg Explores:<br>🎠🎡Plärrer🎢🌈<br>Mittwoch, 31. August<br>ab 19 Uhr Festgelände",
            body: "Autoscooter, Zuckerwatte, glasierte Früchte oder schunkeliges Einkehren im Festzelt? Es ist wieder Plärrerzeit und wir wollen gemeinsam das Festgelände erkunden und uns etwas von den vielen Eindrücken treiben lassen.🍭🍏🕹🧸<br><br>Komm mit uns auf eine Tour Geisterbahn, schieß ein Foto oder stoße mit uns mit einer Maß Spezi an🎢👻📸🔫🍻.<br><br>Wir treffen uns um 19 Uhr am großen Eingang auf dem Festgelände.<br><br><br>Wir sind kein Verein und keine Jugendgruppe. Wir können weder haften noch eine Aufsichtspflicht übernehmen. Teilnahme auf eigenes Risiko!<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1661965200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "6317b955a5ba8100125b5a32"
            },
            id: "PhB0J",
            head: "👋 Queer Augsburg Meet 🤝<br>Montag, 12. September<br>ab 19 Uhr im Thing",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br>Bei einer Apfelschorle oder einer Portion Pommes kannst du mit Queers ins Gespräch kommen. Was bewegt sie wohl? Das neue iPhone? Der Schulstart am nächsten Tag? Oder der anstrengende Montag?🍟<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Je nach Wetter, werden wir im Biergarten draußen oder in der Gaststätte drinnen sitzen. Wir geben 24 Stunden vorher bekannt, ob wir eher draußen oder drinnen sitzen werden. Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗<br><br>Wir treffen uns voraussichtlich DRAUẞEN und gehen dann bei Bedarf im Laufe des Abends rein.<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1663002000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "6317c48da5ba8100125b5a4d"
            },
            id: "xuEDf",
            head: "👋 Queer Augsburg Meet 🤝<br>Mittwoch, 28. September<br>☕ab 19 Uhr im Grandhotel🌍<br>",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einem Orangensaft🍊, einem Blümchenbier🍺🌼 oder einer kosmopolitischen Köstlichkeit🥙 kannst du mit Queers ins Gespräch kommen. Was bewegt sie wohl? Der Wiesnbesuch?🎠 Turamichele?👹👼 Oder die anstehende Dult? 🍰<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Grandhotel Cosmopolis, Springergäßchen 5. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Pilgerhausstraße (1er, 35er), oder Dom/Stadtwerke (2er) zum Grandhotel. Parken kannst du am besten in der Kolping Garage.<br><br>Drinnen sind 12 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls du uns nicht findest, frage einfach nach Queer Augsburg.🤗<br><br>Und noch ein kleiner Hinweis für alle Interessierten: 🎨🖍Direkt davor um 17:30 Uhr treffen sich Polyamor* in Augsburg zum Gestalten eines eigenen Logos ebenfalls im Grandhotel. 💙❤️🖤",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1664384400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "631fbf1ba5ba8100125b5c2f"
            },
            id: "75p8E",
            head: "Queere Christ*innen💒<br>Freitag, 16. September<br>ab 19 Uhr im Ulrichseck",
            body: "Die Queeren Christ*innen treffen sich diesen Freitag im UlrichsEck, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1663347600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "631fc096a5ba8100125b5c34"
            },
            id: "QG2kO",
            head: "Queermas<br>Freitag, 16. Dezember<br>ab 18:55 Uhr in der ESG<br>🎄🎁🦌<br>",
            body: "Bunt geschmückte Bäume werden aufgestellt, Plätzchen gebacken und Geschenke vorbereitet - Queermas steht vor der Tür! Lasst uns gemeinsam mit Polyamor* in Augsburg in der Evangelischen Studierenden Gemeinde in gemütlicher Atmosphäre zurückblicken, winterliche Spiele spielen und Punsch genießen. Es sind ausdrücklich alle Personen eingeladen - auch jüngere, ältere und Nicht-Studierende!<br>🌟<br><br>Schrottwichteln:<br>Wenn du beim Schrottwichteln mitmachen willst, bringe etwas mit, das du gerne weitergeben möchtest. Packe es bitte so ein, dass der Gegenstand von außen nicht direkt erkennbar ist. Du kannst deinen Gegenstand auch erst vor Ort einpacken.<br>🎁<br><br>Safe Space:<br>Vor Ort wird es eine Awareness-Person und einen Rückzugsraum geben. Wenn du dich überwältigt oder unwohl fühlst, wird es eine Person geben, mit der du reden kannst. Wenn du kurz Ruhe oder Abstand von Menschen brauchst, kannst du jederzeit in den Rückzugsraum oder in den Garten der ESG gehen.<br>😊<br><br>Mitbringen und helfen:<br>Wir würden uns sehr freuen, wenn du Lebkuchen, Plätzchen, Stollen oder ein anderes Gebäck mitbringen würdest. (Du kannst vor Ort eine Beschriftung mit Allergenen, Unverträglichkeiten und Präferenzen anbringen.) Wenn du Zeit und Lust hast, bei der Vorbereitung zu helfen, komm gerne schon um 18:30 Uhr in die ESG. Vielen Dank!<br>🤝<br><br>Anfahrt:<br>Wir treffen uns im ersten Stock der ESG Augsburg, Salomon-Idler-Straße 14, 86159 Augsburg. Hinter der Glastür geht links eine Treppe zur Queermas-Feier hoch. Alternativ ist ein Aufzug direkt am Eingang. Das Gebäude ist barrierefrei. Es gibt Parkplätze und Fahrradstellplätze vor Ort. Die nächsten Haltestellen sind Beim Dürren Ast, Linie 2, und Universität, Linie 3. Um 18:45 Uhr wird eine Person an der Haltestellen Universität warten, um gemeinsam zur ESG zu gehen. Du wirst die Person an ihrer grünen Jacke erkennen können. Einen bebilderten Gang von der Haltestelle zur ESG findest du einige Stunden vor dem Treffen auf unserem Instagram-Account @queer_augsburg.<br>🚈<br><br>Rücksicht:<br>Bitte nimm Rücksicht auf deine Mitmenschen und teste dich bevor du kommst. Wenn du Symptome hast oder dir unsicher bist, ziehe in Erwägung zuhause zu bleiben oder eine Maske zu tragen. 😷<br><br><br>Wir freuen uns, gemeinsam das Jahr ausklingen zu lassen!<br>🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1671213600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "24"
        },
        {
            _id: {
                $oid: "631fc78da5ba8100125b5c3d"
            },
            id: "3faU1",
            head: "Queer Augsburg Connects:<br>🕍Meet a Jew✡<br>Montag, 6. Februar",
            body: 'Jüdinnen und Juden sind Arbeitskolleg*innen, Kommiliton*innen, Nachbar*innen. Wir sitzen nebeneinander in der Straba oder stehen gemeinsam an der Supermarktkasse. Doch selten haben wir die Möglichkeit bewusst miteinander ins Gespräch zu kommen. Deswegen gibt es Meet a Jew! In persönlichen Begegnungen gibt die Aktion ganz individuelle Einblicke in die Vielfalt des jüdischen Lebens in Deutschland. Hier steht nicht die Geschichte im Vordergrund, sondern der lebendige Alltag von Jüdinnen und Juden heute.<br><br>Weg von dem oft abstrakten Bild von „den Juden“ in unserer Gesellschaft und hin zu einer Vielzahl von authentischen jüdischen Gesichtern und Perspektiven. Ein persönlicher Austausch bewirkt, was hundert Bücher nicht leisten können. Queer Augsburg hat ihn dank der ehrenamtlichen Aktion "Meet a Jew" und mithilfe der Queeren Christ*innen möglich gemacht: Lasst uns miteinander, statt übereinander reden!<br><br>Teilnahme nach Anmeldung unter mail@queer.augsburg.de',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1675706400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "63227bafb3e9070012f3ce40"
            },
            id: "gKluF",
            head: "Queer Augsburg Explores:<br>Christkindlesmarkt<br>Mittwoch, 7. Dezember<br>ab 18:30 Uhr am Elias-Holl-Platz<br>🎄🌭🍷🔥",
            body: "Ho ho ho! Es weihnachtet in der Augsburger Innenstadt! Das zieht natürlich auch ein queeres Einhornrudel wie uns an... Lasst uns Regenbogen, Glitzer und Weihnachtsstimmung verteilen! 🧑‍🎄🦄✨<br><br>Treffpunkt ist pünktlich um 18:30 Uhr hinter dem Rathaus am Obelisken (Elias-Holl-Denkmal) in der Ecke des Elias-Holl-Platzes, wo sich die Straßen kreuzen, bei den Bäumen und Bänken. 🌳<br><br>Nach einer Runde Punsch, gebrannten Mandeln und Wurstsemmeln setzen wir uns dann in einer gemütlichen Runde ab 20:00 Uhr zusammen ins Henry's Coffee auf der dem Rathaus gegenüberliegenden Seite des Rathausplatzes. Es sind zehn Plätze reserviert. Nach Bedarf und Möglichkeit machen wir einen weiteren Tisch auf. Du kannst auch erst im Henry‘s Coffee dazustoßen. Wenn du nachkommst oder uns nicht findest, frage einfach nach „Queer Augsburg“. ☕️<br><br>Wir freuen uns auf dich! 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1670522400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "6328f3f0b3e9070012f3d01b"
            },
            id: "SGKzm",
            head: "Bi+Get-together and friends/Workshop zum Bi+Visibility Day<br>💗💜💙<br>Freitag, 23. September<br>ab 19 Uhr im Café des Grandhotel 🌍☕",
            body: '<br>Ob panromantisch, omnisexuell, biromantisch oder polysexuell: Das Spektrum von Bi+ ist groß!<br>🙌🌈💗💜💙<br><br>Mit unserer Aktion zum diesjährigen Bi+Visibility Day wollen wir für mehr Sichtbarkeit👁 der Vielfalt der Bi+Community sorgen und einen Begegnungsort🤝 für und mit Bi+Identities schaffen.<br><br>🗓Der Bi+Visibility Day am 23.September wird als Abschluss der Bi+Awareness Week begangen. Doch warum ist das Bewusstsein um Bi+ in der Community so wichtig?<br><br>Von "gierig" bis "Phase": Um bi+ Personen ranken sich absurde Vorurteile und abwegige Klischees.😠 Bi-Erasure, also die fortwährende Unsichtbarmachung von bi+ Personen, findet überall in der Gesellschaft statt. Innerhalb der queeren Community sind Bi+Personen von Gatekeeping betroffen.🥺<br><br>Let\'s learn together: Erfahre mehr über Bi+Identities in der queeren Community!📚<br>Wir wollen darüber reden, was Bi als Identität für uns bedeutet, gemeinsam brainstormen und auch einfach unsere Identität feiern.<br>💗💜💙<br><br>Wir treffen uns um 19 Uhr im "Astronautenraum" des Café Grandhotel Cosmopolis, Springergässchen 5.👩‍🚀 Fragt einfach nach Queer Augsburg, wenn ihr uns nicht findet.🤗🏳️‍🌈',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1663952400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "18"
        },
        {
            _id: {
                $oid: "632a3e23b3e9070012f3d07b"
            },
            id: "nKPKA",
            head: "Queer Slam Workshop",
            body: "\n  Lasst uns gemeinsam die Macht des Wortes erkunden!<br><br>In einem kleinen Workshop werden kreative Texte entstehen, die von euch - sofern gewollt - auf der Bühne performt werden.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1662696000000"
            },
            planned: true,
            registrationRequired: false,
            rLimit: null,
            rClosing: null
        },
        {
            _id: {
                $oid: "6334e3a8b3e9070012f3d370"
            },
            id: "agnZ3",
            head: "Queer Augsburg:<br>👩‍🎓📚Students<br>&amp; friends👨‍🎓📚<br>Donnerstag, 20. Oktober<br>ab 19 Uhr im Unikum",
            body: "Du hast die O-Phase überstanden und startest in deine erste Uniwoche? Du kennst die Uni fast nur digital und freust dich, endlich queere Studierende in Person kennenzulernen? Oder bist du du schon so lang an der Uni, dass dir deine Semesterzahl langsam peinlich wird? 📖<br><br>Dann bist du bei Queer Augsburg Students genau richtig! (Alle anderen sind natürlich auch willkommen!) Bei einer Maracujaschorle oder Portion Gnocchi Gorgonzola kannst du dich mit lesbischen, schwulen, trans*, bi+, a_sexuellen, a_romantischen, inter* und queeren Studierenden austauschen über den besten Stundenplan, die buntesten Dozierenden oder dein Halloween Kostüm. Für Kennenlern- und Kartenspiele ist gesorgt! 🧀✨🎃🃏<br><br>Wir treffen uns ab 19:00 Uhr im Unikum, Salomon Idler Straße 24F. Kartenzahlung ist ab fünf Euro möglich. Die Haltestelle Universität, Tramlinie 3, ist direkt neben dem Lokal. Fahrradabstellplätze gibt es in unmittelbarer Nähe des Unikums. Parken kannst du als Studi auf der P1 Parketage. Als Auswärtige*r parkst du am besten auf dem Messeparkplatz oder auf gut Glück im Univiertel. 🚉🚲🚙<br><br>Wir haben den großen viereckigen Tisch etwas weiter abgelegen hinten im Unikum reserviert. Geh einfach etwas weiter ins Lokal rein, steig die zwei Treppenstufen hoch und dann bist du schon angekommen. (Wir assistieren dir auch gerne bei den Stufen. :)) Ein paar Minuten vor dem Beginn des Treffens werden die Organisator*innen bereits am Tisch sitzen. Auf dem Tisch wird ein Evoli-Plüschtier sein. Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗<br><br>Du traust dich nicht alleine zum Treffen und willst vorher schon jemanden kennenlernen? Melde dich bei uns per E-Mail an hallo@queer-augsburg.de oder per privater Nachricht auf Instagram und wir treffen uns vor dem großen Queer Augsburg Students Treffen mit dir.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1666285200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "34"
        },
        {
            _id: {
                $oid: "6334e46fb3e9070012f3d372"
            },
            id: "63ifC",
            head: "Queer Augsburg Meet,<br>Party and Fun<br>👻Halloween!🎃<br>Montag, 31. Oktober<br>ab 19 Uhr im Thing",
            body: "Es spukt bei Queer Augsburg! Komm und erschrecke oder werde erschreckt! 🐁🐙🍁<br><br>🐺Mache mit und spiele mit uns eine Runde Werwölfe im gespenstisch geschmücktem Thing an Halloween. 💀⚰👻<br><br>Bei einem Kirschnektar oder einem Knoblauchdip kannst du mit lesbischen Magierinnen, schwulen Vampiren, trans* Piraten, bi+ Hexen, a_sexuellen Meermenschen, a_romantischen Dunkelelfen, inter* Geistern und queeren Zombies aus Augsburg und Umgebung ins Gespräch kommen.<br>Verkleidung keine Pflicht, aber sehr gern erwünscht!<br>🧚‍♂️🧙‍♀️🧜‍♀️🧝‍♀️🧟‍♂️🧛‍♂️🦹‍♀️🦸‍♀️<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br>🕷🎃🕸️🦇<br><br>(Bitte sei bei deiner Kostümwahl respektvoll gegenüber marginalisierten Gruppen. Reproduziere bitte keine ableistischen Klischees, und sei sensibel in Bezug auf die Themen mental health und kulturelle Aneignung.)<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1667239200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "25"
        },
        {
            _id: {
                $oid: "6334e7e9b3e9070012f3d375"
            },
            id: "zuEA6",
            head: "🖐Queer Augsburg Meet🤝<br>Donnerstag, 6. Oktober<br>ab 19 Uhr im Annapam",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einer Spezi oder einem Salat kannst du mit Queers ins Gespräch kommen. 🥗 Was bewegt sie wohl? Fünf Jahre Ehe für Alle? 💍 Das bunte Laub? 🍂 Oder das bevorstehende Musical RENT? 🎶<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Annapam, Bäckergasse 23. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Rotes Tor (2er, 3er, 6er, 32er), Margaret (22er, 35er), Moritzplatz (1er) oder Königsplatz (restliche Linien) zum Annapam. Fahrräder können vor Ort abgestellt werden. Parken kannst du am besten in der City Galerie.<br><br>Es sind 12 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1665075600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "63358b3eb3e9070012f3d388"
            },
            id: "uMWfu",
            head: "Queer Augsburg Kultur:<br>🎤Musical Rent🏢<br>Samstag, 8. Oktober<br>ab 19:30 Uhr<br>im Kulturhaus Abraxas",
            body: "<br>Das Broadway Musical RENT erzählt die Geschichte um den Musiker Roger, Filmemacher Mark und deren Freund*innen im New Yorker East Village der 90er. Die Protagonist*innen sind mit diversen Herausforderungen konfrontiert: Das Leben am Existenzminimum, AIDS, Drogenmissbrauch, Rassismus, der Suche nach sich selbst und dem größeren Sinn des Lebens. Der Glaube an die Liebe, die Kraft der Freundschaft, die Menschlichkeit und das Leben im Hier und Jetzt spielen eine große Rolle.<br><br>Eine Produktion der Augsburger Musical Company, Regie: Guillermo Amaya.🕺💃<br><br><br>Wir sammeln uns für die Vorstellung am 8.10, falls du aber an dem Tag nicht kannst, gibt es noch am 7./9./14./15. und 16.10 die Möglichkeit das Musical anzuschauen.🗓<br><br>Die Karten kosten 32 Eur/25 Eur ermäßigt. Bitte organisiere dir selbstständig eine Karte: Plätze um die Reihe 2, Platz 17, falls du in unserer Nähe sitzen möchtest. Karten im Vorverkauf erhältlich im Abraxas (vor Ort oder online über reservix) oder in der Bürgerinfo am Rathausplatz.🎫<br><br>(Und wer weiß, vielleicht sieht man das ein oder andere Queer Augsburg Einhorn auch über die Bühne huschen.🦄😏)",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1665250200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "63358bffb3e9070012f3d38a"
            },
            id: "qof1O",
            head: 'Queer Augsburg Kultur:<br>🎭Theaterstück "Tante Gerda laden wir nicht ein!"👰👰<br>Donnerstag, 13. Oktober<br>ab 18 Uhr im Bürgertreff Hochzoll',
            body: "Eine queere Hochzeit muss geplant werden...<br><br>Tante Gerda laden wir nicht ein!<br>von und mit Bella Nick und Janina Sachsenmaier<br><br>Charlotte und Mina waren ein glückliches Paar - bis sie beschlossen zu heiraten.👭 💍Ahoi, ahoi! Kleine Streitigkeiten entwickeln sich zum Politikum in ihrer Beziehung. 😱 Öko-Hochzeit oder Prunk? Familienfeier oder Party? Und ich frag dich leise, ob du noch mitwillst auf unsre kleine Reise... In ihrer stipendiengeförderten Dramödie berichten die beiden Absolventinnen der Hochschule für Musik und Theater Rostock vom Wunsch vieler Paare, in den Hafen der Ehe einzulaufen und von den verschiedenen Vorstellungen über den Kurs dorthin. Mit dem Tretboot?!⛵<br><br><br>Treffen am Bürgertreff Hochzoll / Holzerbau, Neuschwansteinstr. 23a, 86163 Augsburg<br>Einlass: ab 18 Uhr Beginn: 19 Uhr<br><br>Bitte seid nach Möglichkeit frühzeitig da.<br><br>Das Stück dauert 60 Minuten, im Anschluss findet ein 20 minütiges Nachgespräch mit den Künstlerinnen statt. Eintritt: frei; Platzreservierung empfohlen unter per Mail an info@buergertreff-hochzoll.de<br><br>Im Anschluss treffen wir uns ab 21 Uhr im Murdocks. Ihr könnt natürlich auch gerne dazukommen, auch wenn ihr nicht im Theaterstück wart.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1665676800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "4"
        },
        {
            _id: {
                $oid: "63377a15b3e9070012f3d420"
            },
            id: "Ldcy5",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 21. Oktober<br>ab 19 Uhr im UlrichsEck",
            body: "Und auch diesen Freitag treffen sich die Queeren Christ*innen im kleinen Saal des UlrichsEcks, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1666371600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "634e97b43b7d720012c58405"
            },
            id: "OU7JN",
            head: "Queer Augsburg Explores:<br>✨Nachts im Museum 🎃🦇<br>Samstag, 29. Oktober<br>ab 18 Uhr im Maximilianmuseum",
            body: "Mache mit uns am Samstag vor Halloween das Museum nachts unsicher! 👻🖼👻<br><br>Das Maximilianmuseum hat pünktlich zu Halloween wieder seine berühmte magische Nacht organisiert. 🧙‍♂️🧚‍♀️🧞‍♀️ Das dürfen wir natürlich auf keinen Fall verpassen! Spuke mit uns durch die magisch beleuchteten Räume des Museums, etwa bei einer spannenden Führung 🔦🔎📜, oder lausche den gruseligen Klängen des Geistermusikonzerts. ⚰🎼🎻🕯<br><br>Und das Beste: Für magisch Verkleidete ist der Eintritt sogar kostenlos! 🤫🤭<br>(Nicht-Verkleidete: 3 Euro)<br><br>Also wirf dich in dein Halloween Outfit und sei pünktlich kurz vor 18 Uhr am Eingang zum Maxmuseum, Fuggerplatz 1 (direkt in der Nähe des Fuggerdenkmals bzw. hinterer Thaliaeingang) für eine kleine Vorstellungsrunde und das Abholen der (Frei-)karten. 👽👾🤖😈<br><br>(Bitte sei bei deiner Kostümwahl respektvoll gegenüber marginalisierten Gruppen. Reproduziere bitte keine ableistischen Klischees, und sei sensibel in Bezug auf die Themen mental health und kulturelle Aneignung.)<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1667059200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "635e56723b7d720012c58853"
            },
            id: "bOLfy",
            head: "⛪Gottesdienst➰<br>zum Welt-AIDS-Tag<br>Donnerstag, 1. Dezember<br>ab 19 Uhr in der<br>Apostolin-Junia-Kirche",
            body: "<br>  https://qcaux.de/gottesdienst-welt-aids-tag-2022/",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1669892400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6360e48d3b7d720012c58919"
            },
            id: "Azt3c",
            head: "🍻Queer-Kneipe🧣<br>Freitag, 4. November<br>ab 18 Uhr im Provino",
            body: "Denkt ihr auch noch voller schöner Erinnerungen an den diesjährigen Queergarten?<br><br>Der CSD Augsburg hat jetzt eine Winterversion organisiert: Auch im November heißt es wieder ab mit deinen Favorite Queers in den Provinoclub.<br>Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1667581200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6360e6073b7d720012c5891c"
            },
            id: "K8A7i",
            head: "Trans Awareness Week/<br>Trans Day of Remembrance:💙💗🕯💗💙<br>trans* folks and friends<br>Freitag, 18. November<br>ab 18 Uhr im Grandhotel",
            body: 'Wir wollen die Trans Awareness Week und den anstehenden Trans Day of Remembrance zum Anlass nehmen für ein lockeres und gemütliches Beisammensein mit und von eurer Favorite trans* Community: Du bist ein trans guy oder eine trans femme auf der Suche nach Anschluss? Nonbinary oder genderqueer? In the Closet oder Questioning? Egal ob schon lang geschlüpft oder noch in Eierschale, bei uns findest du nette Leute, die dich herzlich und ohne Gatekeeping aufnehmen. Allies, Family, Friends und Herzpersonen ebenfalls herzlich Willkommen.<br><br>Wir treffen uns um diesmal bereits um 18 Uhr im "Astronautenraum" des Café Grandhotel Cosmopolis, Springergässchen 5.👩‍🚀 Fragt einfach nach Queer Augsburg, wenn ihr uns nicht findet.🤗🏳️‍🌈<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1668790800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "6360e6cb3b7d720012c5891e"
            },
            id: "Jsid3",
            head: "Queer Augsburg Educates:<br>💙❤💛🖤<br>Polyamor Day<br>Samstag, 26. November<br>ab 19 Uhr im Projektraum",
            body: 'Leider herrschen immer noch sehr viele Vorurteile und Miskonzeptionen über Polyamorie und nicht-monogame Beziehungen, Zeit wird\'s diese endlich abzubauen! Deshalb gibt\'s anlässlich des Polyamory-Day bei QueerAugsburg für alle, die interessiert sind ein Thementreffen🤭🥳:<br><br>Ganz nach dem Motto "Love does not divide, it multiplies" diskutieren wir wie eine nicht-monogame Beziehung funktioniert, welche "Regeln" es zu beachten gilt und welche möglichen Konstellationen und Fachbegriffe existieren. 👩‍🏫📚Lerne mehr über die polyamore und nicht-monogame Beziehungsformen, "meet a non-monogamous person" und stelle ihr (respektvoll) Löcher in den Bauch.😌💬❔❕<br><br>✨Kurzer Input mit anschließendem Q&amp;A✨:<br>👉🏼 Samstag 26.11.22, 19:00 Uhr<br>👉🏼 im ProjektRaum Rechts der Wertach (nur ein paar Schritte von der Tram-Haltestelle Senkelbach).<br><br>Im Raum gibt es keine Bewirtung, aber wer Lust hat kann gern Snacks zum Teilen mitbringen.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1669485600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "6363ff6f3b7d720012c58a47"
            },
            id: "024cL",
            head: "🏳️‍🌈Queere Christ*innen⛪<br>Freitag, 18. November<br>ab 19 Uhr im UlrichsEck",
            body: "Und auch diesen Freitag treffen sich die Queeren Christ*innen im kleinen Saal des UlrichsEcks, Ulrichsplatz 17.<br><br>Weitere Infos unter www.qcaux.de.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1668794400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6368084f3b7d720012c58b50"
            },
            id: "Qov7V",
            head: "🖐Queer Augsburg Meet🤝<br>Donnerstag, 10. November<br>🍟ab 19 Uhr im Okis🍔<br>",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einer Cola oder einem Cheeseburger kannst du mit Queers ins Gespräch kommen. 🍔 Reden sie noch über die letzte Halloweenparty oder machen sie schon Pläne für Weihnachten?<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Okis, Georgenstraße 2, direkt zwischen den Haltestellen der Linie 2 vom Mozarthaus und Fischertor.<br><br>Es sind 12 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1668103200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "19"
        },
        {
            _id: {
                $oid: "636cbf473b7d720012c58ce8"
            },
            id: "vyRzQ",
            head: "Trans Awareness Week: Workshop trans* Identitäten<br>💙💗⚪💗💙<br>Mittwoch, 16. November<br>ab 18 Uhr im Grandhotel",
            body: '<br>Für Neugierige, fortgeschrittene trans* Menschen und solche, die es mal werden wollen.😉 /j<br><br>Wir wollen die Vielfalt des Trans*-seins aufzeigen, über binäre und nicht-binäre Geschlechter sowie genderqueere Identitäten und Lebenswege reden, Fragen beantworten und uns miteinander über unsere Erfahrungen austauschen.💬<br><br>Aber nicht nur "über" sondern auch gerne "mit": Kommt deshalb vorbei, wenn ihr Fragen habt, selber was zu erzählen habt oder einfach neugierig seid.👩‍🏫<br><br>Die Einladung richtet sich an cis und trans Personen gleichermaßen. Lasst uns gemeinsam sowie mit- und voneinander in einem Rahmen eines offenen und respektvollen Safe Space lernen.<br><br>Wir treffen uns um diesmal bereits um 18 Uhr im "Astronautenraum" des Café Grandhotel Cosmopolis, Springergässchen 5.👩‍🚀 Fragt einfach nach Queer Augsburg, wenn ihr uns nicht findet.🤗🏳️‍🌈<br><br>Und schon mal zum Anteasern: Am Freitag treffen wir uns zu einem gemütlichen Beisammensein von unserer Trans*-Community and friends, gleicher Ort, gleiche Zeit.<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1668621600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "6393cc91cb0155001294c220"
            },
            id: "pgIU5",
            head: "🏳️‍🌈 2023 🏳️‍⚧️",
            body: 'Frohes Neues!<br><br><br>Liebe Queer Augsburg Community,<br><br>dieses Jahr haben wir queere Geschichte gelernt und dass "Mental Health Matters", wir sind auf einen Spaziergang in Washington mitgenommen worden, haben unser Dreijähriges beim Japanischen Frühlingsfest gefeiert, mehr über a_romantische Orientierungen und lesbische Subkulturen erfahren und die Bi+ und Ace Sichtbarkeit gestärkt.<br><br>Wir haben queere Filme und Theaterstücke angeschaut, sind selbst beim Improtheater aktiv geworden und haben das FLINTA* Festival bereichert. Wir haben uns vernetzt bei unzähligen Meets und bei unserem großen Students Treffen. Wir haben einen dauerhaften trans* Treff etabliert und Halloween und Queermas gefeiert.<br><br>Dies und vieles mehr haben wir dieses Jahr geschafft. Lasst uns 2023 noch mehr schaffen. Mehr Sichtbarkeit, Vernetzung und Safe Space und mehr Miteinander. Miteinander lachen, lernen und spielen und miteinander sein.<br><br>Wir wünschen uns allen einen guten Rutsch ins Jahr 2023!',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1672527600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "63bfd079d8e734001292dd7e"
            },
            id: "d1iqA",
            head: "🥠Queer Augsburg Ideas🎊<br>Sonntag, 15. Januar<br>ab 14 Uhr im Café Dreizehn",
            body: "<br>Bei einem gemütlichen Sonntagskaffee tauschen wir Ideen für Treffen im nächsten Jahr aus.☕🍰 Was lief letztes Jahr gut? Worauf haben wir Lust? Welche Themenwochen stehen an?<br><br><br>Komm vorbei und bringe alles ein, was du bei Queer Augsburg erleben willst. Du bist selbstverständlich nicht verpflichtet, deine Vorschläge umzusetzen. Wir arbeiten alle zusammen, um das bestmögliche Programm für 2023 zu erstellen! 🤗<br><br>Diesen Sonntag ab 14 Uhr im Café Dreizehn in der Kresselsmühle, Barfüßerstraße 4, 86150 Augsburg. Am schnellsten kommst du vom Rathausplatz (Linie 1 und 2) oder vom Königsplatz zum Café.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1673787600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "63d16187d8e734001292e161"
            },
            id: "tAJ0Z",
            head: 'Queer Augsburg Educates:<br>"Some men have Vaginas." Themenabend zum<br>Trans Day of Visibility<br>Freitag, 31. März<br>ab 18:30 Uhr im Projektraum<br>💙💗💬💗💙',
            body: '<br>Das Reproduzieren von biologistischen Geschlechtskonstruktionen in der Sprache sowie die gedankliche Verknüpfung eines rein körperlichen Merkmals ("Penis") mit der Geschlechtsidentität einer Person ("männlich") radiert transgender, nicht-binäre und gender non confirming Personen auf sprachlicher Ebene aus, während pauschalisierende Formulierungen wie "schwangere Frauen" nicht der Lebenswirklichkeit von trans Personen entsprechen und dabei die Existenz von gebärenden Vätern und zeugenden Müttern missachten. Das Fehlen eines geschlechtsneutralen Pronomens jenseits der Binarität von "sie" und "er" wiederum macht es unmöglich, auf nicht-binäre Personen in adäquater Weise Bezug zu nehmen.<br><br>Was sind die Möglichkeiten, aber auch die Grenzen einer inklusiveren Sprache?<br><br>Anlässlich des Trans Day of Visibility möchten wir mit euch bei einem Workshop und Q&amp;A zur trans*-inklusiven Sprache über die Möglichkeiten einer<br>Sprache reden, die trans Personen sichtbar statt unsichtbar macht.<br><br>Wir treffen uns um 18:30 Uhr im Projektraum-Rechts-der-Wertach (dieser befindet sich nur ein paar Schritte von der Tram-Haltestelle "Senkelbach").',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1680282000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "63d2ba15d8e734001292e1a1"
            },
            id: "uZ4WS",
            head: "🖐Queer Augsburg Meet🤝<br>Mittwoch, 1. Februar<br>ab 19 Uhr im Thing",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br>Bei einer Cola oder einem Burger kannst du mit Queers ins Gespräch kommen.🍔 Sind sie erklärte Valentinstagsfans oder eingeschworene Gegner*innen? Denken sie schon an Frühling oder freuen sich erst auf Fasching? Oder gar schon auf die nächste Pride?<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1675274400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "11"
        },
        {
            _id: {
                $oid: "63da3b87d8e734001292e342"
            },
            id: "LjLi7",
            head: "Valentine's Meet and Fun<br>Montag, 13. Februar<br>ab 19 Uhr im Thing<br>🤝❤🖐",
            body: 'Liebe ist vielfältig, bunt und nicht immer romantischer Art💚🏹, aber oft "everywhere you look around". Wir wollen allen, die den Valentinstag etwas zelebrieren möchten, am Vorabend des 14. Februars bei einem kleinen Meet mit ein bisschen Valentinsvibes auch die Gelegenheit dazu geben.<br><br>Folge unserem Motto ❤"Wear something red, wear something lovely!"💋 und triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Amors und Valentinsfans aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br>Bei einer Traubensaftschorle oder Tomatencremesuppe und einem Valentinsquiz kannst du mit Queers ins Gespräch kommen.💘👼<br><br>Du kannst auch gern passende Spiele mitbringen!🎲🎴♥️<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1676311200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "640ca7fa550a510012fd1c75"
            },
            id: "pmoSS",
            head: "🖐Queer Augsburg Mewt🤝<br>Mittwoch, 15. März<br>ab 17 Uhr im Katzentempel🐈",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen und Katzen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einem Tira-miau-su oder einem Karottenlachssandwich kannst du mit Queers ins Gespräch kommen und dabei ein paar quirlige Fellnasen streicheln.🐱 Sind sie mehr Katzen- oder eher doch Hundemenschen? Bereits ehrwürdige Katzentempelritter oder zum ersten Mal auf Flauschtour?🐈<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns diesmal schon ab 17:00 Uhr im Katzentempel, Jakoberstraße 6. Du kannst das Café gut zu Fuß vom Rathausplatz aus erreichen. Ansonsten sind die nächsten Haltestellen Barfüßerbrücke/Brechthaus und Pilgerhausstraße, erreichbar zB mit der Linie 1 oder 23. Parken kannst du in der Metzgplatz Tiefgarage. Dein Fahrrad kannst du in der Karolinenstraße am Rathausplatz abstellen.<br><br>Hinweis für Katzenhaarallergien und mögliche Tierphobien: Es sind 5 echte flauschige Katzentiere vor Ort, die gegenfalls zu euch hinkommen und gestreichelt werden wollen.<br><br>Es sind 8 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1678896000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "17"
        },
        {
            _id: {
                $oid: "640cb7e8550a510012fd1c85"
            },
            id: "oF0IH",
            head: "🏳️‍🌈 LOVEPOP Rockfabrik 👯<br>Queer Clubbing auf 2 Floors<br>mit Freikarten!<br>Samtag, 18. März ab 22:00",
            body: "Party for open-minded People – Queer | Straight | Whatever<br><br>Mainfloor:<br>Pop, Dance &amp; Queer Classics vs. HipHop Black, Trap &amp; Reggaeton<br>Caramel Mafia (Schwuz &amp; Rachet Berlin)<br>Matthew Black (Himbeerparty Mannheim &amp; Exile Köln)<br><br>Jam! Floor:<br>CHARLIE´S CONNEXXION<br>Techno, Electro, Progressive, Minimal &amp; Psy<br>► Briickie<br>► Der Dude<br>► Der Grobmotoriker<br>&amp; die Charlie und die Ravefabrik Crew<br>+ Deko by Marys YggdrasiL<br>+ Special Lights by Linewand<br><br>Mehr Informationen hier: https://www.lovepop.info/18-03-lovepop-rockfabrik/<br><br>Es gibt Freikarten! ✨<br>Bitte per Mail oder persönlich bei Paul Hennig anfragen.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1679173200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "640cb9d8550a510012fd1c91"
            },
            id: "Xd85k",
            head: "🏳️‍🌈 LOVEPOP Kantine 👯<br>Queer Clubbing auf 2 Floors<br>mit Freikarten!<br>Sonntag, 9. April ab 22:00",
            body: "<br>Party for open-minded People – Queer | Straight | Whatever<br><br>► Floor 1: LOVEPOP<br>Wildstyle Pop, 80ies + 90ies, Dance &amp; Queer Classics<br>BAMBI MERCURY (Schwuz Berlin | Queen of Drags &amp; Viva La Diva)<br>DJ NT (White Noise Stuttgart | Lovepop Resident)<br><br>►Floor 2: BOOTYLICIOUS:<br>Black, HipHop, Dancehall, Reggaeton, R&amp;B &amp; Trap<br>DJane ABRISSBARBIE (Garage Saarbrücken | Pure Gay Clubbing FFM)<br><br><br>Mehr Informationen hier: https://www.lovepop.info/lovepop-queer-clubbing-auf-2-floors-rockfabrik-augsburg/<br><br>Es gibt Freikarten! ✨<br>Bitte per Mail oder persönlich bei Paul Hennig anfragen.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1681070400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "640cbb33550a510012fd1c98"
            },
            id: "R42Yu",
            head: "🏳️‍🌈 LOVEPOP Rockfabrik 👯<br>Queer Clubbing auf 2 Floors<br>mit Freikarten!<br>Samstag, 13. Mai ab 22:00",
            body: "<br>Party for open-minded People – Queer | Straight | Whatever<br><br><br>Mainfloor:<br>Pop, Dance, Black, House &amp; Queer Classics<br>I AM NICO (Chantal´s House of Shame | Irrenhouse Berlin)<br>DJ NT (Kantine Augsburg | White Noise Stuttgart)<br>DJ Queerland (Queer the Night | CSD Augsburg)<br><br>Jam! Floor hosted by Charlie &amp; die Ravefabrik<br>Techno, Electro, Progressive, Minimal<br>by OZI, Alessia Cattani &amp; Friends<br><br><br>Mehr Informationen hier: https://www.lovepop.info/lovepop-queer-easter-clubbing-auf-2-floors-kantine-augsburg/<br><br>Es gibt Freikarten! ✨<br>Bitte per Mail oder persönlich bei Paul Hennig anfragen.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1684008000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "640cbbbb550a510012fd1c9a"
            },
            id: "yvlLM",
            head: "<br>🏳️‍🌈 LOVEPOP CSD EDITION Rockfabrik 👯<br>Queer Pride Clubbing on 3 Floors<br>mit Freikarten!<br>Samtag, 17. Juni ab 22:00",
            body: "<br>Lovepop Augsburg lädt mit illustren Gästen am CHRISTOPHER STREET DAY AUGSBURG zur größten queeren Party der Stadt in Augsburgs wohl bekanntesten &amp; traditionsreichsten Club auf 3 Floors und gigantischer Fläche mit Cafe, Bistro &amp; Gaming-Center!<br><br>► Party for open-minded People – Queer | Straight | Whatever<br><br>Floor 1 | LOVEPOP<br>Pop, Dance, Black, House &amp; Queer Classics<br>► MATTHEW BLACK (Exile Köln &amp; Himbeerparty Mannheim)<br>► DJane NICINATION (Pink Heaven Muc | Pink Inc. HH)<br>► CHRIS RODRIGUES (Pinkmonkeys.Club Nbg | Rosa Park Karlsruhe)<br><br>Floor 2 | TECHROOM<br>100% Techno by Charlie &amp; Ravefabrik Crew<br>► Alessia Cattani (Simon Says)<br>► OZI (CRF / Kantine ua.a.)<br>► more tba<br><br>Floor 3 | FREAKPOP<br>Hits &amp; Seltengehörtes aus 80ies/90ies bis Indie &amp; Rock<br>► DJ MARIO aka GARTH WEDAM (White Noise &amp; Gaytunnel Augsburg)<br><br><br>Mehr Informationen hier: https://www.lovepop.info/17-06-lovepop-csd-edition/<br><br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1687032000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "640cff5e550a510012fd1cc2"
            },
            id: "dvtR2",
            head: "Queer Augsburg<br>🥪Snax&amp;Relax🧘‍♂️<br>Freitag, 17. März<br>ab 19 Uhr im Projektraum Rechts-der-Wertach<br>🌱🕯🌈",
            body: '<br>In der Welt da draußen ist dir zu viel Stress und zu wenig Regenbogen? Nicht bei uns! Wir wollen in einem offenen Safe Space zusammen Yoga machen, entspannen und danach noch gemütlich picknicken.<br><br>Du brauchst keine Yogaerfahrung, es gibt Anleitung und ein leichtes Programm.<br><br>Wir treffen uns diesmal um 19:00 Uhr im Projektraum-Rechts-der -Wertach (dieser befindet sich nur ein paar Schritte von der Tram-Haltestelle "Senkelbach").<br><br>Bring bitte eine Yogamatte und (vegane) Snacks zum Teilen mit. 🥗 Für Tee und Wasser ist gesorgt.🍵 Falls du keine Yogamatte haben solltest, sag rechtzeitig Bescheid, damit wir eine Lösung finden können. Eine Anmeldung ist nicht nötig, aber eine Ankündigung, dass du kommst, würde uns die Planung erleichtern. Wir freuen uns auf dich!🤗<br><br>(Wir können keine Haftung für etwaige Verletzungen, Lebensmittelunverträglichkeiten oder sonstige Unwägbarkeiten übernehmen, Teilnahme daher auf eigene Verantwortung.)',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1679076000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "5"
        },
        {
            _id: {
                $oid: "642de842550a510012fd2495"
            },
            id: "Tex5T",
            head: "Queer Augsburg Party:<br>Rosa Montag<br>Montag, 17. April<br>ab 18 Uhr am Plärrer<br>🎀🍺🍎🎡",
            body: 'Autoscooter, Fotoschießen, Zuckerwatte und glasierte Früchte?🍭🍏🕹🧸Es ist wieder Plärrerzeit und wir wollen gemeinsam uns etwas von den vielen Eindrücken mitnehmen lassen und im Festzelt zu einem queeren Programm schunkelig einkehren🎢👻📸🔫🍻.<br><br>Der Rosa Montag hat queere Tradition, das dürfen wir nicht verpassen: Deshalb treffen wir uns um 18 Uhr im Schallerfestzelt auf dem Plärrergelände, dort ist ein Tisch für uns reserviert. Falls du uns nicht findest, frage nach Paul oder Queer Augsburg.<br>🏳️‍🌈🎀🏳️‍🌈<br>Du erreichst das Plärrergelände bequem mit der Straßenbahnlinie 4, Haltestelle "Plärrer".<br><br>Wir sind kein Verein und keine Jugendgruppe. Wir können weder haften noch eine Aufsichtspflicht übernehmen. Teilnahme auf eigenes Risiko!',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1681747200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6"
        },
        {
            _id: {
                $oid: "642de8ab550a510012fd2497"
            },
            id: "OKwAV",
            head: "🍺Queergarten🌳<br>Freitag, 21. April<br>ab 18 Uhr im Provinoclub",
            body: "Es ist wieder Bier-, ehm, Queergartenzeit! Ab April heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen Initiativen und hab Spaß.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1682092800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6431fecf550a510012fd2595"
            },
            id: "GOoPr",
            head: "🖐Queer Augsburg Meet🤝<br>Freitag, 14. April<br>ab 19 Uhr im Thing",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einem Orangensaft oder einer Quinoa-Bowl🍛 bzw. einem Bärlauchburger 🍔🌱kannst du mit Queers ins Gespräch kommen.<br>Wie viele Ostereier haben sie gefunden? Denken sie schon an den Sommer oder freuen sie sich noch auf das Japanische Frühlingsfest? Oder gar schon auf den Rosa Montag nächsten Montag auf dem Plärrer?<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br><br>Es sind 10 Plätze reserviert. Nach Verfügbarkeit machen wir einen weiteren Tisch auf.<br>Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1681491600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "6431ffce550a510012fd2597"
            },
            id: "MZe55",
            head: "<b>Queer Augsburg:<br></b><b>Students &amp; friends</b><br><b>🎓🧑‍🎓📚<br>Mittwoch, 26. April<br>ab 19 Uhr im Murdock's</b>",
            body: "Starte in deinen queeren Hochschulsommer!<br>🏳️‍🌈🏳️‍⚧️☀️🏖️🎓<br><br>Lerne lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Studierende aller Fakultäten der Hochschule und Universität Augsburg kennen! (Freunde, Allies und Nicht-Studierende sind auch herzlich willkommen.) Tausche dich mit ihnen aus über spannende Seminare, schräge Dozierende oder das Japanische Frühlingsfest. Für Kennenlern- und Kartenspiele ist gesorgt! 🎌🎴<br><br>Wir treffen uns um 19 Uhr im Murdock's Irish Pub, Am Roten Tor 8, 86150 Augsburg. Du kannst dort ein Guinness oder Apfelcider trinken. Deinen Appetit kannst du mit einem Irish Stew, Fish and Chips und weiteren (vegetarischen und auch veganen) Gerichten stillen. Für die Schokiqueers gibt es das Death by Chocolate Dessert. 🍟🍫<br><br>Das Murdock's ist direkt neben der Augsburger Puppenkiste und kann am besten von der Haltestelle Rotes Tor aus erreicht werden. Dort halten die Linien 2, 3, 6 und 35. Fahrräder können vor Ort abgestellt werden. Parken kannst du am besten in der City Galerie oder auf dem Studierendenparkplatz der Hochschule Augsburg. Von der Hochschule aus ist das Murdock's zu Fuß zu erreichen. 🎎<br><br>Das Murdock's ist nicht barrierefrei. Wir assistieren dir gerne bei den Treppenstufen.<br><br>Wir haben den ruhigen Raum ganz hinten im Lokal reserviert. Frag am besten direkt nach Queer Augsburg oder Paul, wenn du reinkommst. Du wirst dann geradeaus und dann rechts Richtung Toiletten in einen Nebenraum geführt. Wenn du dann nach links schaust, siehst du hinten rechts im Nebenraum einen mit Schiebetüren separierbaren Raum. (In unserem Instagram-Post findest du einen bebilderten Weg zum Raum.) Den Raum haben wir für uns an diesem Abend. Komm bitte rechtzeitig, da die freien Plätze sonst an andere Gäste vergeben werden. Es ist keine Anmeldung erforderlich. 🤗<br><br>Lass uns zusammen den queeren Hochschulsommer einleiten!<br>☀️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1682528400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "41"
        },
        {
            _id: {
                $oid: "64320093550a510012fd2599"
            },
            id: "cpKmD",
            head: "Queer Augsburg Explores:<br>Japanisches Frühlingsfest<br>🎎🍢🍡🍙🎏🎐👘🎌⛩️<br>Sonntag, 14. Mai<br>ab 12 Uhr im Botanischen Garten",
            body: "Zwischen dem Klang von Taiko-Trommeln, Origamikunst und poetischen Haikus wollen wir bei erfrischendem Kakigori oder mit einem Becher Sake auf Queer Augsburgs Vierjähriges anstoßen und den Botanischen Garten mit Glitzerstaub und Regenbogen schmücken. Bring daher gerne deine Pridefarben mit! 🏳️‍⚧️🏳️‍🌈<br><br>Im Cosplay oder traditioneller japanischer Kleidung ist der Eintrittspreis sogar günstiger und beträgt dann 2€. Der reguläre Eintritt ist 4,50€.<br><br>Wir treffen uns bei den Klangspringquadraten links neben dem großen Brunnen am Eingang des Botanischen Gartens, Dr.-Ziegenspeck-Weg 10, um 12 Uhr. Von dort aus erkunden wir gemeinsam das Fest.<br><br>Um 14 Uhr planen wir dann ein queeres Picknick auf der großen Wiese zwischen Spielplatz und Biergarten. Bring gerne Spiele, Snacks und Getränke mit! Du erkennst uns an den bunten Farben. 🌈🦄<br><br>Am besten kommst du mit der Buslinie 32 vom Königsplatz zum Botanischen Garten. Vor Ort gibt es viele Fahrradstell- und Parkplätze. Beachte, dass das Japanische Frühlingsfest der besuchsstärkste Tag im Jahr ist. Die Parkmöglichkeiten werden sehr schnell ab dem offiziellen Beginn um 10 Uhr voll werden. Zudem ist die Schlange für die Tickets erfahrungsgemäß sehr lang. Bitte plane ausreichend Zeit ein, um in den Botanischen Garten zu kommen.<br><br>Auf dem Fest wird es viele einzigartige japanische Verpflegungs- und Erwerbsmöglichkeiten geben. Es empfiehlt sich daher, ein wenig Taschengeld einzupacken. Es gibt keine Bankautomaten in der Nähe. Kartenzahlung wird wahrscheinlich nicht möglich sein.<br><br>Wir sind keine Jugendgruppe und können weder Aufsicht noch Haftung übernehmen.<br><br>🏳️‍🌈👘🍣🍱🍲",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1684076400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "6432fe9c550a510012fd25d1"
            },
            id: "n8ajV",
            head: "Queer Augsburg trans* Treff<br>im Queergarten<br>Freitag, 21. April<br>ab 18 Uhr im Provinoclub<br>🏳️‍🌈🌳🍺🏳‍⚧",
            body: 'Unser T*-Kränzchen goes Queergarten.☕🍰🧁🥪<br><br>Wolltest du dich schon immer über die life hacks zu Binding, Tucking und genderaffirmative stuff austauschen? 👙👔🛍💇‍♂️👠💄Oder mal wieder Dampf über das letzte nervige Misgendering ablassen oder das leidige Hin- und Her ums Selbstbestimmungsgesetz?🗯💥🤬 Oder bist du gerade am Questioning und wolltest ungeoutet mal in die Erfahrungen der trans* Community reinlauschen?👂Dann joine uns zu unserem in regelmäßigen Abständen stattfindendem T*-Kränzchen in einem Café oder Bistro der Stadt.<br>☕🧁🥪<br><br>Der Queergarten ist eröffnet! Und deshalb treffen wir uns dieses Mal einfach dort. Du kannst gerne Kuchen oder Sandwiches mitbringen, Getränke können vor Ort erworben werden.<br><br><br>Hinweis zur Akzessibilität: Der Provinoclub ist etwa 300 m von der Straßenbahnlinie 6, Haltestelle "Textilmuseum" (durch das Textilmuseumsgelände und am Rewe vorbei), entfernt. Durch den Schotter ist der Biergarten leider nur bedingt barrierefrei.<br><br>Queer Augsburg T*-Kränzchen ist das Treffen für trans* Frauen, trans* Männer, nichtbinäre, genderqueere, inter* Personen, allies and friends: Du bist ein trans guy oder eine trans femme auf der Suche nach Anschluss? Nonbinary oder genderqueer? In Closet oder Questioning? Egal ob schon lang geschlüpft oder immer noch in Eierschale, wir wollen dich! Bei uns findest du nette Leute, die dich herzlich &amp; ohne Gatekeeping aufnehmen. Family/Friends/Herzpersonen&amp;Allies sind ebenfalls willkommen.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1682092800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "16"
        },
        {
            _id: {
                $oid: "6438660f550a510012fd276a"
            },
            id: "XESJM",
            head: "Queer @ Hochschule Augsburg<br>🏳️‍🌈🏳️‍⚧️🎓<br>Mittwoch, 26. April<br>ab 18:30 Uhr im Murdock's",
            body: "Du studierst an der Hochschule und willst dich dort für queere Menschen engagieren? Dann komm zu unserem Kick-Off Treffen für eine queere Hochschulgruppe an der Hochschule Augsburg!<br><br>Komm einfach eine halbe Stunde vor dem Students Treffen (siehe unten) ins Murdock's. Wir lernen uns kennen und tauschen uns über mögliche queere Treffen in diesem Sommersemester aus.<br><br>Wir freuen uns auf deine Teilnahme! 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1682526600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "14"
        },
        {
            _id: {
                $oid: "64386705550a510012fd2771"
            },
            id: "6Rqyn",
            head: "Meet a Queer<br>Mittwoch, 17. Mai<br>ab 14 Uhr in der Stadtbücherei<br>🏳️‍🌈🏳️‍⚧️📚",
            body: "<br>Du wolltest schon immer wissen, was die Basis einer polyamoren Beziehungsform ist, was nicht-binär bedeutet, oder ob bi wirklich eine Phase ist? Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung und frage sie was du schon immer mal eine queere Person fragen wolltest. 🏳️‍🌈🏳️‍⚧️<br><br>Mit MEET A QUEER möchten wir einen Raum für Begegnungen schaffen und in einem respektvollen Miteinander über die Vielfalt der queeren Community aufklären.<br><br>Im Rahmen des IDAHOBITA* veranstaltet Queer Augsburg von 14 bis 17 Uhr ein Meet a Queer in der Stadtbücherei am Ernst-Reuter-Platz.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1684335600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "64447d19b2bca80012898dd9"
            },
            id: "R7X5T",
            head: "Queer Augsburg Party:<br>🥂🍾Kneipentour🍷🍻<br>Sonntag, 30. April<br>ab 19 Uhr in der Haifischbar🍹🦈",
            body: "Die Vögel zwitschern, die Sonne lacht und der Frühling ist erwacht! Das kann nur eines bedeuten: Unsere legendäre Kneipentour steht vor der Tür! Ob wir in der Mainacht zum Blocksberg 🏔 fliegen, uns einfach ins Hexenhaus 🧙‍♀️🧹 ums Eck aufmachen oder uns im schicken Outfit bei der Brezn🥨 sehen lassen, das entscheidet sich spontan. Aber eins ist sicher - es wird eine Nacht voller Spaß und guter Laune! Also schnapp dir deine Freunde und komm am 30. April um 19 Uhr zur Haifischbar, wo wir unseren berühmt-berüchtigten Pub-Crawl in den Mai starten!<br><br><br>Wir möchten darauf hinweisen, dass wir kein Verein oder Jugendgruppe sind und du daher auf eigene Verantwortung teilnimmst.<br><br>Der Tisch in der Haifischbar ist reserviert. ☺️",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1682874000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "6461fce8b2bca800128994c2"
            },
            id: "FOZyz",
            head: 'Bunter World Café Abend zu "queer und christlich"<br>am Donnerstag, den 13. Juli<br>ab 19:30 Uhr in der ESG<br>mit den Queeren Christ*innen<br>🏳️‍🌈 ✝️ 🏳️‍⚧️',
            body: "<br>Zwischen Ausgrenzung, Kirchentrauma und #outinchurch wollen wir ein Statement setzen und durch gegenseitigen Austausch zu einer Veränderung beitragen: Lasst uns in einer gemeinsamen Begegnung zeigen, dass queer und christlich kein Widerspruch sein darf.<br><br>Nach einem Impulsvortrag zu trans* in der Schöpfungsgeschichte kannst du dich an vier Tischen zu Erfahrungen queeren und christlichen Menschen austauschen. Es wird Brezen und Obatzda geben!<br><br>Wir treffen uns im ersten Stock der ESG Augsburg, Salomon-Idler-Straße 14, 86159 Augsburg. Das Gebäude ist direkt neben dem Europaplatz. Neben dem Eingang ist eine Plakatvitrine mit einem Plakat, das dieses Treffen bewirbt. Hinter der Glastür geht links eine Treppe hoch. Alternativ ist ein Aufzug direkt am Eingang. Das Gebäude ist barrierefrei. Es gibt Parkplätze und Fahrradstellplätze vor Ort. Die nächsten Haltestellen sind Beim Dürren Ast, Linie 2, und Universität, Linie 3.<br><br>Einen bebilderten Gang von der Haltestelle zur ESG findest du einige Stunden vor dem Treffen auf dem Instagram-Account @queer_augsburg.<br>🚈<br><br>UPDATE: Der Aufzug ist noch immer außer Betrieb, damit ist ein barrierefreier Zugang in den ersten Stock nicht möglich. Wir bedauern sehr diesen Umstand😤",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1689269400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "20"
        },
        {
            _id: {
                $oid: "64671cb8b2bca800128995fb"
            },
            id: "DlTVr",
            head: "🍻Queergarten☀️<br>Freitag, 19. Mai<br>ab 18 Uhr im Provinoclub",
            body: "Es ist wieder Bier-, ehm, Queergartenzeit! Ab April heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen queeren Gruppen und Initiativen und hab Spaß.<br><br><br>(Dieses Mal gibt es kein Awareness-Team vor Ort.)",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1684512000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "64671f16b2bca80012899602"
            },
            id: "GvqgW",
            head: 'Queer Augsburg Kultur:<br>✨Theaterstück "Kaleidoskop eines COMING-OUTS"🌈🚪<br>Freitag, 16. Juni<br>ab 17:15 Uhr im Projektraum',
            body: 'Premiere "Kaleidoskop eines COMING-OUTS", ein 10-Minute-Play von A. Lane Ziegler mit der Queer Augsburg Theatergruppe.<br><br>Das "Kaleidoskop eines COMING-OUTS" stellt das Herauskommen, das sich ja als Handlung ständig und in allen Situationen wiederholt, ebenso auch als einen fortwährenden, iterativen und performativen Prozess dar. Situationsfetzen, die sich tagtäglich inhaltlich so oder so ähnlich abspielen, werden aufgegriffen und pointiert durch das sprachliche Kaleidoskop einer dichten experimentellen Assoziationskaskade inszeniert. Scharf zugespitzt bringt dies die Form eines sprachlichen vielschichtigen Stimmengeflechts auf die Bühne, das in seinen Sinnzusammenhängen und ausgelösten Wahrnehmungen unterschiedlich deutbar ist.<br><br>Beginn: 17:30 Uhr<br>Einlass: 15 Min. vor Veranstaltungsbeginn.<br>Im Projektraum Rechts-der-Wertach Wolfgangstraße 2<br>Dauer: 10 konzentrierte Minuten. Im Anschluss Publikumsgespräch.<br>Eintritt: frei.<br><br>(Content Note: Szenen, die Alkoholkonsum darstellen.)<br><br>Danach gehen wir mit allen, die wollen, gemeinsam in den Queergarten.<br>🏳️‍🌈🌳🍻☀️<br>',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1686928500000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "34"
        },
        {
            _id: {
                $oid: "646bae98b2bca8001289971b"
            },
            id: "2Fy0J",
            head: "🏳️‍🌈CSD Parade🏳️‍🌈<br>Samstag, 17. Juni<br>ab 10:45 Uhr am Königsplatz",
            body: "Aktualisierter Ablauf CSD Augsburg, Samstag, 17. Juni (Stand jetzt)<br><br>ab 10:30 Uhr: Buntmachen am Kö vor der Deutschen Bank<br>(ggf. gehen wir schon in die Aufstellung direkt daneben in der Straße im Initiativenblock vorne und machen dort weiter)<br><br>11:30 Uhr: Abholung der Ordner*innen Binden am Kö vor der Deutschen Bank<br>spätestens ab 12 Uhr: Aufstellung im Initiativenblock vorne in der Parade entlang der Fuggerstraße<br><br>bis 16 Uhr: Politparade entlang der 3,8km langen Route mit mehreren Stopps und einer Trinkwasserstation<br><br>ab 16 Uhr: Queeres Picknick am Elias-Holl-Platz (direkt hinter dem Rathaus) im Schatten<br>zeitgleich ab 16 Uhr: Beginn des Bühnenprogramms am Rathausplatz<br>ab 16:30 Uhr: Reden, unter anderem von Lane von Queer Augsburg<br>19:30 Uhr: Ökumenischer CSD Gottesdienst in der Moritzkirche (anschließend Get Together)<br>ab 22 Uhr: Queer Pride Clubbing, LOVEPOP in der Rockfabrik<br><br>Ordner*innen gesucht!<br>Hilf mit bei der CSD Augsburg Politparade am Samstag! Komm um 11:25 vor die Deutsche Bank und nimm deine Order*innen-Binde entgegen. Damit hilfst du, die Queer Augsburg Gruppe zusammenzuhalten und für einen sicheren Ablauf zu sorgen.<br>Du musst volljährig sein, deinen Ausweis mitführen sowie keine Drogen (inkl. Alkohol) konsumieren. Zusätzlich kannst du eine Warnweste tragen.<br>Gib uns bitte vorher per Mail Bescheid, wenn du planst Ordner*in zu sein. Du kannst aber auch erst vor Ort spontan entscheiden.<br><br>Buddy-, Care- und Awareness-fähige Personen gesucht!<br>Die Politparade am Samstag wird insgesamt wohl vier Stunden dauern. Bei den angekündigten sonnigen 26°C kann das für einige zur körperlichen Belastung werden. Kümmere dich um deine Community und achte beim CSD darauf, dass alle in der Queer Augsburg Gruppe ausreichend essen und trinken sowie ggf. in den Schatten gehen. Gib uns gerne vorher Bescheid oder sei einfach ab 12 Uhr am Samstag bei der Parade dabei!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1686992400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "6001"
        },
        {
            _id: {
                $oid: "64934ac15d0b330012e84a56"
            },
            id: "6Usvh",
            head: "Queer Augsburg<br>🥪🧺Picknick Meet🍇🍉<br>Mittwoch, den 21. Juni<br>ab 19 Uhr im Hofgarten",
            body: "Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🌈<br><br>Bei einem queeren Picknick 🌱 kannst du mit Queers ins Gespräch kommen.<br>Wie fanden sie die diesjährige Pride in Augsburg? Denken schon an die kommende Pride in München oder freuen sie einfach auf einen queeren Augsburger Sommer? 🏳️‍🌈🏳️‍⚧️☀️<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg! 🤗<br><br>Wir treffen uns ab 19:00 Uhr im Hofgarten. Bring gern Früchte und Snacks zum Teilen mit! 🍏🥨<br><br>Im Anschluss besteht die Möglichkeit gemeinsam ins Kulturcafé Neruda zu gehen, wo wir uns falls es gewittern sollte ebenfalls niederlassen. 🌧️<br><br>Der Hofgarten (Fronhof 8, 86152 Augsburg) liegt nahe der Haltestellen Staatstheater (Linie 6), Karlstraße (Linie 23 und 44) und Dom/Stadtwerke (Linie 2). Vor Ort gibt es Fahrradstellplätze. Parken kannst im CONTIPARK Parkhaus Ludwigstraße. Der Park hat einen Haupteingang mit Stufen sowie einen barrierefreien Seiteneingang. Dort befindet sich auch ein Bücherschrank. 📚<br><br>Das Kulturcafé Neruda (Alte Gasse 7, 86152 Augsburg) ist direkt neben dem Hofgarten und bietet in gemütlicher Wohnzimmeratmosphäre unter anderem vegetarisches und veganes Essen an. 🍅<br><br>Wir freuen uns auf dich! 😄",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1687366800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "12"
        },
        {
            _id: {
                $oid: "64a2976b5d0b330012e84e8e"
            },
            id: "MegHw",
            head: "🌳Queergarten🏳️‍🌈<br>Freitag, der 21. Juli<br>ab 18 Uhr im Riegele",
            body: '- MUSS LEIDER AUFGRUND DES SCHLECHTEN WTTERS ENTFALLEN -<br><br>UPDATE: !! Der Queergarten im Provino wurde leider abgesagt. Aber wir machen jetzt einfach den Riegele Biergarten in der Fröhlichstraße queer! Selfservice für Essen und Getränke. Mitgebrachte Speisen ("Brotzeit") dürfen dort verzehrt werden. Wir freuen uns auf dich!!🌳😉🍻🏳️‍🌈 : UPDATE<br><br>Es ist wieder Bier-, ehm, Queergartenzeit! Ab April heißt es wieder Sonne an und ab mit deinen Favorite Queers in den Queergarten. Trifft bekannte Gesichter aus Queer Augsburg und anderen queeren Gruppen und Initiativen und hab Spaß.<br><br>Wir werden einen Queer Augsburg Tisch haben.<br>🦉<br>Unser Erkennungszeichen ist Owly, eine freundliche kleine Plüscheule. Sie wird uns während des Abends auf dem Tisch Gesellschaft leisten. 🤗',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1689955200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "64a29b805d0b330012e84e91"
            },
            id: "8pU5E",
            head: 'Queer Augsburg Kultur:<br>Theaterstück "Kaleidoskop eines COMING-OUTS" 🌈🚪<br>ab 18:30 Uhr im Projektraum',
            body: 'Nach unserer erfolgreichen Premiere "Kaleidoskop eines COMING-OUTS", ein 10-Minute-Play von A. Lane Ziegler mit der Queer Augsburg Theatergruppe haben wir jetzt einen weiteren Termin im Rahmen des Mittelstraßenfestes. Nach dem Stück lohnt es sich also ein bisschen auf interkulturelle Entdeckungstour zu Bands und Tanz zu gehen.<br><br>Das "Kaleidoskop eines COMING-OUTS" stellt das Herauskommen, das sich ja als Handlung ständig und in allen Situationen wiederholt, ebenso auch als einen fortwährenden, iterativen und performativen Prozess dar. Situationsfetzen, die sich tagtäglich inhaltlich so oder so ähnlich abspielen, werden aufgegriffen und pointiert durch das sprachliche Kaleidoskop einer dichten experimentellen Assoziationskaskade inszeniert. Scharf zugespitzt bringt dies die Form eines sprachlichen vielschichtigen Stimmengeflechts auf die Bühne, das in seinen Sinnzusammenhängen und ausgelösten Wahrnehmungen unterschiedlich deutbar ist.<br><br>Beginn: 18:40 Uhr<br>Einlass: 10 Min. vor Veranstaltungsbeginn.<br>Im Projektraum Rechts-der-Wertach Wolfgangstraße 2<br>Dauer: 10 konzentrierte Minuten.<br>Eintritt: frei.<br><br>(Content Note: Szenen, die Alkoholkonsum darstellen.)',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1689438600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: ""
        },
        {
            _id: {
                $oid: "64a5e006a9c129001218b5f0"
            },
            id: "OQTCL",
            head: "THAt's Queer<br>am Donnerstag, den 27. Juli<br>ab 19 Uhr im Annapam<br>👉🏳️‍🌈🏳️‍⚧️",
            body: "UPDATE: Wir treffen uns im Annapam. Bring gerne Spiele mit - Snacks und Getränke gibt es vor Ort. :)<br><br>Das Annapam ist in der Bäckergasse 23. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Rotes Tor (2er, 3er, 6er, 32er), Margaret (22er, 35er), Moritzplatz (1er) oder Königsplatz (restliche Linien) zum Annapam. Fahrräder können vor Ort abgestellt werden. Parken kannst du am besten in der City Galerie<br><br>🌧️<br><br>Die queere Hochschulgruppe der Technischen Hochschule Augsburg trifft sich zu einem Picknick im Roten Tor Park! Bringt eure Snacks, Spiele, Decke, Getränke und gute Laune mit. Lasst uns gemeinsam eine tolle Zeit haben! 🌈<br>Alle sind wilkommen! 😇<br><br>Falls es regnen sollte, wird noch bis zum 26.7 Bescheid gegeben, ob das Ganze nach drinnen verlagert wird!",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1690477200000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "7"
        },
        {
            _id: {
                $oid: "64a5e4cfa9c129001218b5f3"
            },
            id: "Gc6WV",
            head: "Queer Augsburg goes<br>Augsburger Hohes Friedensfest<br>am Dienstag, den 8. August<br>ab 10:30 Uhr auf dem Rathausplatz🌈🕊️",
            body: "Zu unserem stadteigenem Feiertag versammeln wir uns mit der Augsburger Stadtgemeinschaft auf dem Rathausplatz zum Friedenspicknick und teilen Essen und Getränke miteinander!<br><br>Wir treffen uns um 10:30 Uhr vor dem großen Tor des Rathauses. Wir suchen uns dann weiter vorne in der Nähe der Bühne einen Tisch im Schatten. Komm gerne auch später nach. Wir sind bis mindestens 12:30 Uhr vor Ort. Um 13 Uhr geht dann in der Bäckergasse 4 das House of New Realities los, wo wir gemeinsam hingehen werden.<br><br>Du erkennst uns an den Regenbogenflaggen auf dem Tisch.<br>Bring gerne Früchte, Brote, Getränke und selbstgemachte Salate und Gerichte mit! Beachte aber, dass in den Stadtgrenzen die Geschäfte geschlossen sind.<br><br>Achtung: Aufgrund von Bauarbeiten in der Karolinenstraße ist der Rathausplatz zurzeit nicht direkt mit den öffentlichen Verkehrsmitteln zu erreichen. Du kannst vom Königsplatz aus hinlaufen. Dort kannst du auch dein Fahrrad abstellen. Die nächsten Parkplätze sind am Ernst-Reuter-Platz, Fuggerstraße und Annahof.<br><br>Wir freuen uns sehr, einen bunten Touch zu dieser ureigenen Augsburger Tradition beizusteuern. Sei dabei!<br>🤗🏳️‍⚧️🏳️‍🌈",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1691483400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "64aebf55a9c129001218b687"
            },
            id: "ttbKa",
            head: "Nonbinary People's Day<br>Freitag, 14. Juli<br>ab 19 Uhr im Thing<br>💛⚪💜🖤",
            body: '<br>Einladung zum "Queer Augsburg" Treffen für nicht-binäre, genderqueere und questioning Menschen und ihre Freund:innen und Allys im Thing!<br><br>Liebe nicht-binäre, genderqueere und questioning Menschen, liebe Freund:innen und Allys<br>wir laden euch herzlich zu unserem "Queer Augsburg" Treffen für ein! Das Thing ist der perfekte Ort, um sich in einer entspannten Atmosphäre zu treffen, miteinander zu plaudern und gemeinsam Spiele zu spielen.<br><br>Datum: 14.07.2023 (International Non-Binary People\'s Day💛🤍💜🖤)<br>Uhrzeit: 19:00<br>Ort: Thing, Vorderer Lech 45, 86150 Augsburg<br><br>Egal ob du dich bereits mit deiner Identität wohl fühlst oder noch auf der Suche nach Antworten bist, bei uns bist du herzlich willkommen. Unser Treffen bietet Raum für Austausch, Verständnis und Gemeinschaft. Wir möchten eine sichere und unterstützende Umgebung schaffen, in der du dich frei entfalten und mit anderen Menschen, die ähnliche Erfahrungen machen, interagieren kannst.<br>Neben Gesprächen und dem Kennenlernen anderer großartiger Menschen haben wir auch eine Auswahl an Spielen vorbereitet, um für jede Menge Spaß und Unterhaltung zu sorgen. Also komm vorbei und verbringe eine großartige Zeit mit uns beim "Queer Augsburg" Treffen im Thing.<br>Wir freuen uns schon sehr darauf, dich dort zu sehen und eine wundervolle Zeit gemeinsam zu erleben. Solltest du Fragen haben oder weitere Informationen benötigen, zögere nicht, uns zu kontaktieren.<br>Wir haben einen Tisch im Biergarten reserviert, bei schlechtem Wetter weichen wir nach drinnen aus. Wenn ihr uns nicht findet, der Tisch ist auf "Sauer" reserviert.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1689354000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "20"
        },
        {
            _id: {
                $oid: "64b549a6a9c129001218b8f2"
            },
            id: "8243X",
            head: "Ostqueer",
            body: "Ein Treffen für alle queeren Menschen mit Osthintergrund. Von Ostdeeutschland über Polen, die Sowjetunion und Ungarn bis hin zu Jugoslawien ist alles dabei.<br><br>Friends, Allies und Interessierte sind herzlich willkommen!<br><br>Lass uns gemeinsam über unsere besonderen Erfahrungen mit unserem queer sein reden.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1693242000000"
            },
            planned: true,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64b54cb2a9c129001218b8fa"
            },
            id: "4ixrJ",
            head: "Gay Meet",
            body: "Herzliche Einladung an alle schwulen, bi+, pan und queeren Personen sowie deren Friends und Allies zu einem Treffen!<br><br>Egal ob frisch oder lang geoutet oder noch unsicher - bei uns sind alle willkommen. Lasst uns über Coming-Out und Dating-Erfahrungen reden oder einfach die Gesellschaft von Gleichgesinnten genießen.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1694106000000"
            },
            planned: true,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64b7f0e6a9c129001218b9d7"
            },
            id: "7zjSl",
            head: "19 Jahre LOVEPOP Augsburg - Queer Birthday Clubbing auf 2 Floors 🏳️‍🌈👯<br>am Montag, den 14 August ab 23:00 Uhr",
            body: "Augsburgs queeres Partyvergnügen #1 feiert Geburtstag mit vielen Specials<br><br>► Floor 1: LOVEPOP<br>Wildstyle Pop, 80ies + 90ies, Dance &amp; Queer Classics<br>DJ SVEN ENZELMANN (Lovepop Hamburg | Markthalle Hamburg)<br>DJ NT (White Noise Stuttgart | Lovepop Resident)<br><br>►Floor 2: BOOTYLICIOUS:<br>Queer/Fem. HipHop, Househop, R´n´B, Dancehall &amp; Bass Sounds<br>DJ JUCQUES (Jederlamm / Lamm &amp; Cityclub) &amp; Friends<br><br>Mehr Informationen hier:https://www.lovepop.info/lovepop-queer-clubbing-auf-2-floors-kantine-augsburg/<br><br>Es gibt Freikarten! ✨<br>Bitte per mail anfragen.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1692046800000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64bce7bba9c129001218bb22"
            },
            id: "1FMY5",
            head: "Doppelworkshop zu trans*-inklusiver Sprache und Daily Ableism<br>Sonntag, 30. Juni<br>ab 11:30 Uhr im House of NEW REALITIES",
            body: 'Im gerade aktuellen House of NEW REALITIES der bluespotproductions bietet Aiden Lane Ziegler für alle Interessierten kommenden Sonntag den Doppelworkshop "Some men have vaginas." und "Daily Ableism and how to avoid it" an.<br><br>Ihr findet das House in der Bäckergasse 4, (alte Wiedemann Glasfabrik, Innenhof), dort im Café Êdēr, dem Gebäude gegenüber des großen Wandgraffito. Der Doppelworkshop findet um<br>11:30 bis14:30 Uhr statt.<br><br><br>Ankündigstext des Workshops:<br><br>"Some men have vaginas."<br><br>Die gedankliche Verknüpfung eines rein körperlichen Merkmals ("Penis") mit der Geschlechtsidentität einer Person ("männlich") radiert trans Frauen, trans Männer, nicht-binäre und gender non confirming Personen auf sprachlicher Ebene aus. Pauschalisierende medizinische Formulierungen wie "schwangere Frauen" missachten die Existenz von gebärenden Vätern und zeugenden Müttern. Ein geschlechtsneutrales Personalpronomen jenseits der Binarität von "sie" und "er" fehlt im Deutschen gänzlich.<br><br>Bei einem Workshop mit Q&amp;A zur trans*-inklusiven Sprache werden wir über die Möglichkeiten einer<br>Sprache reden, die trans* Personen sichtbar statt unsichtbar macht.<br><br><br>"Daily Ableism and how to avoid it"<br><br>Crashkurs-Workshop zu ableistischen Alltagssituationen und internalisiertem Ableismus in der Sprache und wie man dies vermeidet.<br><br>Lasst uns in den diesem Doppelworkshop gemeinsam an einer neuen Realität arbeiten.<br><br>Respektvoller Umgang vorausgesetzt. Englischkenntnisse aufgrund der Fachbegriffe etwas von Vorteil, aber dagegen keine Voraussetzung.<br><br>Vorherige Anmeldung ist sehr willkommen unter<br>projekte@bluespotsproductions.com<br><br>Die Teilnahme ist kostenlos (Spende willkommen).',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1690709400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64be635ea9c129001218bb92"
            },
            id: "JwT9V",
            head: "Queer Augsburg Party:<br>🎀Rosa Montag🏳️‍🌈<br>am 28. August<br>ab 17 Uhr im Schallerzelt auf dem Augsburger Herbstplärrer 2023<br>🎡🍻🎠🎪<br>",
            body: '<br>Autoscooter, Fotoschießen, Zuckerwatte und glasierte Früchte?🍭🍏🕹🧸Es ist wieder Plärrerzeit und wir wollen gemeinsam uns etwas von den vielen Eindrücken mitnehmen lassen und im Festzelt zu einem queeren Programm schunkelig einkehren🎢👻📸🔫🍻.<br><br>Der Rosa Montag hat queere Tradition, das dürfen wir nicht verpassen: Deshalb treffen wir uns um 17 Uhr im Schallerfestzelt auf dem Plärrergelände. Der Eintritt zum Rosa Montag ist wie immer frei, Queer Augsburg wird einen Tisch reserviert haben!<br>🏳️‍🌈🎀🏳️‍🌈<br>Du erreichst das Plärrergelände bequem mit der Straßenbahnlinie 4, Haltestelle "Plärrer".<br><br>Disclaimer: Wir können weder haften noch eine Aufsichtspflicht übernehmen. Teilnahme auf eigenes Risiko!<br><br><br>Veranstaltertext: Am Montag, 28.08.2023 wird das Schallerzelt wieder zum Place to be für die gesamte LGBTQ+ Community und für alle, die einfach nur gerne und ausgelassen feiern möchten. Das bunte, gut gelaunte Publikum, die super Stimmung und die hochkarätigen Bands sind das Geheimnis, die diese Party so einzigartig machen. Für die musikalische Unterhaltung sorgt dieses Mal die “Hausband” aus dem schönen Allgäu, die das Zelt mit ihren 11 Top-Musikern und einem Mix aus aktuellen Hits, Schlagern und den Besten Songs der 90er und 2000er, wieder zum Beben bringt.<br><br>Gefeiert wird im Zelt bis 23 Uhr und danach geht\'s weiter ins FILION (gleich gegenüber vom Plärrergelände) zu Okis großer “rosaMontag-Aftershow-Party” mit open end.',
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1693242000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "10"
        },
        {
            _id: {
                $oid: "64bfa465a9c129001218bbe1"
            },
            id: "uJnrN",
            head: "Queer Augsburg goes Disability Pride Month<br>Freitag, 28. Juni<br>ab 17 Uhr in den Zeughaus Stuben",
            body: "<br>Liebe queere Menschen mit Behinderung und/oder chronischen Erkrankungen, Lernschwierigkeiten psychischen Erkrankungungen und/oder Neurodivergenz,<br><br>wir laden euch herzlich zu unserem Queer Augsburg Treffen für queere Menschen mit Be_hinderungen und Allies.<br><br>Datum: 28.07.23<br>Uhrzeit: 17:00 Uhr<br>Ort: Zeughaus Stuben<br>(Zeugpl. 4, 86150 Augsburg, direkt neben der Haltestelle Moritzplatz, es gibt Park- und Fahrradabstellmöglichkeiten vor Ort.)<br><br><br>Egal ob du dich bereits mit deiner Identität wohl fühlst oder noch auf der Suche nach Antworten bist, bei uns bist du herzlich willkommen. Unser Treffen bietet Raum für Austausch, Verständnis und Gemeinschaft. Wir möchten eine sichere und unterstützende Umgebung schaffen, in der du dich frei entfalten und mit anderen Menschen, die ähnliche Erfahrungen machen, interagieren kannst. Wir bemühen uns um einen ableism-freien Safe Space und barrierefreien Raum, soweit es in unseren Möglichkeiten liegt.<br><br>Wir freuen uns schon sehr darauf, dich dort zu sehen und eine wundervolle Zeit gemeinsam zu erleben. Solltest du Fragen haben oder weitere Informationen oder eine Assistenz bzw. Buddyperson für den Abend benötigen, zögere nicht, uns zu kontaktieren.<br><br>Für Rollstuhlnutzer*innen: Die Zeughaus Stuben hat einen barrierefreien Zugang, leider ist laut Angabe der Gastronomie gegenwärtig der Aufzug zur Toilette außer Betrieb.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1690560000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64d176c8a9c129001218c004"
            },
            id: "0jGNN",
            head: "<br>Queer Augsburg Cinema: Queer Augsburg goes Pink!<br>💕👚🎀💓💕<br>am Sonntag, den 13. August<br>ab 16:20 im Cinestar",
            body: "Wir schauen zusammen Barbie an! Also hol deine pinken Klamotten aus dem Schrank, denn jetzt ist deren Zeit gekommen die queere Augsburger Welt in ein zartrosa und pastellmint zu tauchen.<br><br>Mach unsere Kinotour zu einem gemeinsamen Erlebnis und komm bereits ab spätestens 16:20 Uhr zum Cinestar im Helio am Hauptbahnhof. Dort haben wir dann so ausreichend Zeit fürs Karten kaufen und ggf. für ein Gruppenphoto bis zum Filmbeginn um 16:50 Uhr.<br><br>Der Zugang zum Kino verfügt über zwei Aufzüge und eine barrierefreie Toilette.<br><br>Durch eine Cinestarcard kostet das Ticket nur noch 5,50 €.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1691946000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "64d940f3a9c129001218c253"
            },
            id: "f3MTk",
            head: "Queer Augsburg Meet<br>am Montag, den 14. August<br>ab 19 Uhr im Thing",
            body: "<br>Triff lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Menschen aus Augsburg und Umgebung! 🏳️‍🌈🏳️‍⚧️<br><br><br>Bei einem Orangensaft oder einer Quinoa-Bowl 🍛 bzw. einem Burger 🍔🌱 kannst du mit Queers ins Gespräch kommen.<br>Was sind die Pläne für den morgigen Feiertag? Wo verbringen Sie ihren Sommer am liebsten? Welches Eis schmeckt am besten?<br><br>Finde es heraus, komm vorbei und werde Teil von Queer Augsburg!<br><br>Wir treffen uns ab 19:00 Uhr im Thing, Vorderer Lech 45. Je nachdem, wo du losfährst, läufst du am besten von der Haltestelle Königsplatz, Rotes Tor oder City Galerie zum Thing. Parken kannst du am besten in der City Galerie.<br><br>Es sind 15 Plätze im Innenraum reserviert, da es Regnen soll. Nach Verfügbarkeit machen wir einen weiteren Tisch auf. Und wenn das Wetter mit macht, sitzen wir raus in den Biergarten.<br>Falls du uns nicht findest, frage einfach nach Queer Augsburg. 🤗",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1692032400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "17"
        },
        {
            _id: {
                $oid: "64de051da9c129001218c3fa"
            },
            id: "WpDub",
            head: "🌻Queergarten🍻<br>Freitag, 18. August<br>ab 18 Uhr im Provino",
            body: "<br>Triff bekannte Gesichter aus Queer Augsburg und anderen queeren Gruppen sowie Initiativen und hab Spaß.<br><br>Wir werden einen Queer Augsburg Tisch haben.<br>🦉<br>Unser Erkennungszeichen ist Owly, eine Plüscheule 🤗 sie wird auf dem Tisch sitzen",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1692374400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "21"
        },
        {
            _id: {
                $oid: "64e35a8ba9c129001218c5be"
            },
            id: "4xpi7",
            head: "🍲Potluck und Meet🖐<br>am Freitag, den 1. September<br>ab 18 Uhr im Riegele Biergarten<br>🤝🦉🥣",
            body: "<br>Nachdem diese Woche irgendwie das TumbleWeed durch die Queer Augsburg Gemeinde tumbled ☹️<br><br>Haben wir kurzfristig beschlossen uns am Freitag, den 1. September im Riegele Biergarten zu treffen🍻 (sofern das Wetter passt, sonst Biergarten zu).<br><br>Dabei ist 'Potluck' angesagt, denn im Riegele Biergarten gilt das bayerische Biergartengesetz 🙌🏿:<br>Essen mitbringen ok 🍽️, Getränke dort kaufen 🍺 ( Pizza o.Ä. bestellen nein) 👎🏼.<br><br>Was ist Potluck?<br>Ganz einfach: Jede*r bringt was zu Essen mit und wir teilen untereinander 🥳.<br><br>Owly, die Plüscheule 🦉, begrüßt Euch wieder als Erkennungszeichen, die ist nämlich ganz happy mit ihrem neuen Job 😅.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1693584000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "13"
        },
        {
            _id: {
                $oid: "64e41005a9c129001218c603"
            },
            id: "7DkHj",
            head: "Vereinsgründung<br>am Samstag, den 23. September<br>in der Innenstadt<br>🏳️‍🌈🏳️‍⚧️",
            body: "Gründe mit uns den Queer Augsburg e.V.!<br><br>Von dem Willen beseelt, ein queerer Impuls für die Augsburger Stadtgesellschaft zu sein, wollen sich lesbische, schwule, trans*, bi+, a_sexuelle, a_romantische, inter* und queere Augsburger*innen sowie ihre Freund*innen und Unterstützer*innen eine Satzung im Geiste der Vielfalt, Offenheit, Transparenz und Teilhabe geben.<br><br>Schreibe uns eine Mail an verein@queer-augsburg.de oder eine Nachricht auf Instagram an @queer_augsburg, wenn du dabei sein willst. Wir schicken dir dann den genauen und Ort und die genaue Zeit, die vorläufige Tagesordnung sowie den derzeitigen Entwurf der Satzung.<br><br>Mit Queer Augsburg wollen wir queeren Menschen in Augsburg eine neue Heimat geben. Gemeinsam erschaffen wir ein buntes, friedliches und vielfältiges Augsburg. Tagtäglich setzen wir uns dafür ein.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1695459600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64f78af9c6a3d20012054b89"
            },
            id: "nrsVY",
            head: "Queer Augsburg goes<br>Into Space<br>🌠🌞🌚⭐✨<br>via Planetarium<br>am Samstag, den 9. September<br>um 17:30 Uhr im Planetarium",
            body: "<br>Wolltet ihr schon immer Mal unsere Erde verlassen und die Unendlichkeit des Universums erkunden, auf weit entfernten Planeten landen und die Sterne aus einer anderen Perspektive beobachten? 🔭 💫🪐🛰️<br><br>Dann zieht euren bunten Weltraumanzug an und seid Teil unserer Expedition ins Sonnensystem im Planetarium Augsburg.<br>👨‍🚀🏳️‍🌈👩‍🚀<br>Wir treffen uns am Samstag, 09.09.2023 um 17:30 Uhr vor dem Planetarium. Reserviere bitte einen eigenen Platz für die Vorstellung um 18 Uhr. Wir können nicht garantieren, dass einer unserer 11 reservierten Plätze noch frei sein wird. Du kannst die Karte vor Ort bezahlen, auch mit Karte.<br><br>Ich (Kübra) freue mich auf alle Kosmonaut*innen auf unserer Reise zu den Planeten unseres Sonnensystems.<br>👽🏳‍🌈👽",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1694273400000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: "8"
        },
        {
            _id: {
                $oid: "64f78b70c6a3d20012054b8b"
            },
            id: "BCEws",
            head: "Bi+ Representation Workshop<br>am Freitag, den 15. September<br>ab 18 Uhr im Projekt-Raum<br>💙💜💖",
            body: "<br>Als Auftakt zur ✨Bi+ Visibility Week✨ wollen wir am Freitag, 15.9.2023 in einem Workshop über mediale Darstellung von Bisexualität reden, uns über positive Vorbilder austauschen und eigene Beispiele erarbeiten.<br><br>✍🏾bringt gerne mit:<br>- Schreibzeug✏🗒<br>- Snacks/Brotzeit und Getränke🥪🍏<br>- ein Beispiel für gute Bi-Repräsentation📺📖<br>(ist keine Pflicht)<br><br>Wir treffen uns um 18 Uhr im Projektraum Rechts-der-Wertach. Wenn möglich, meldet euch per Mail an, damit wir ungefähr einschätzen können, wie viele Leute kommen :)",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1694793600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64f78c37c6a3d20012054b8d"
            },
            id: "9mXK8",
            head: "Strategie- und Richtungstreffen 7<br>💡💡💡💡💡💡💡<br>am Montag, den 11. September<br>ab 18 Uhr auf Zoom",
            body: "<br>  Queer Augsburg wird ein Verein! Dafür brauchen wir eine Satzung. Der Entwurf ist schon fertig und wir wollen ihn mit euch teilen!<br><br>Wir stellen die Mitgliedschaft, die Organe, den Vereinsaufbau sowie die besondere Rolle der transparenzbeauftragten Person vor und wollen deine Meinung und dein Feedback. Lass uns gemeinsam die beste Satzung für Queer Augsburg erarbeiten!<br>🎯💡🦄<br><br>Ab 18 Uhr auf Zoom. Link auf Anfrage. Keine Anmeldung erforderlich.",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1694448000000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        },
        {
            _id: {
                $oid: "64fb3d35c6a3d20012054c68"
            },
            id: "xzupl",
            head: "LOVEPOP - Queer Clubbing auf 2 Floors 🏳️‍🌈👯 am Samtag den 09 August 2023 ab 22:00 Uhr",
            body: "<br><br>Party for open-minded People – Queer | Straight | Whatever<br><br>Mainfloor &amp; Outdoor:<br>Pop, Dance, Black, House &amp; Queer Classics<br>– DJane Catchee (Femme Fatale | Astra Berlin)<br>– DJ Garth Wedam (White Noise Stuttgart | Lamm Augsburg)<br>– DJ NT (Kantine Augsburg | White Noise Stuttgart)<br><br>Basement Floor:<br>Techno, Electro, Minimal by Charlie &amp; die Ravefabrik x Simon Says<br>– ALESSIA CATTANIA (Simon Says Booking)<br>– AUDIO SOLUTION (Simon Says Booking)<br>– OZI (Charlie &amp; die Ravefabrik | Kantine)<br>– KMSUTRA x PEITSCHE<br><br>Mehr Informationen hier:<br>https://www.lovepop.info/lovepop-queer-clubbing-auf-2-floors-rockfabrik/<br><br><br>Es gibt Freikarten! ✨<br>Bitte per mail anfragen.<br>",
            locationOSM: "",
            locationGoogle: "",
            googleCalendar: "",
            date: {
                $numberLong: "1694289600000"
            },
            planned: false,
            registrationRequired: false,
            rLimit: null,
            rClosing: null,
            attendance: null
        }
    ];
    const res = old.map(o => {
        return {
            _id: o.id,
            title: o.head.replaceAll("<br>", "\n").replaceAll("<b>", "").replaceAll("</b>", ""),
            description: o.body
                .replaceAll("<br>", "\n")
                .replaceAll("<b>", "**")
                .replaceAll("</b>", "**"),
            time: parseInt(o.date.$numberLong),
            attendance: o.attendance
                ? typeof o.attendance === "string"
                    ? parseInt(o.attendance)
                    : o.attendance
                : null,
            authority: "Queer Augsburg",
            age_restriction: [],
            location: {
                name: "Augsburg",
                lat: 48.36876,
                lon: 10.89929
            },
            price: [],
            trigger_warning: null,
            rating: null,
            tags: {
                freeform: [],
                common: [],
                queer: []
            }
        };
    });
    console.log(JSON.stringify(res));
};
