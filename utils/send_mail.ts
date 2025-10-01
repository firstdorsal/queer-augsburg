import { MongoClient } from "npm:mongodb@6.1.0";
import { SMTPClient, SendConfig } from "https://deno.land/x/denomailer/mod.ts";

const mongo_uri = Deno.env.get("QA_MONGO_URI");

if (!mongo_uri) {
    throw new Error("Please provide QA_MONGO_URI");
}
const mongo_client = new MongoClient(mongo_uri);

await mongo_client.connect();

const db = mongo_client.db("queer-augsburg");

const users_collection = db.collection("users");

const mail_password = Deno.env.get("TRANSPARENZ_MAIL_PASSWORD");

if (!mail_password) {
    throw new Error("Please provide MAIL_PASSWORD");
}

const smtp_client = new SMTPClient({
    connection: {
        hostname: "mx.vindelicum.eu",
        port: 465,
        tls: true,
        auth: {
            username: "transparenz@queer-augsburg.de",
            password: mail_password,
        },
    },
});

const attachment_file_1 = await Deno.readFile(
    "./data/Queer Augsburg Pride 2025.pdf"
);

const content = `Liebes Mitglied von Queer Augsburg e.V.,

es ist so weit: unsere zweite alljährliche Mitgliederversammlung steht an! Ich freue mich auf Berichte unserer Vereinsarbeit im vergangenen Jahr, Neuwahlen des Vorstands und der Beauftragten und Beschlüsse für das neue Jahr. Als Transparenzbeauftragte von Queer Augsburg e.V. darf ich euch somit einladen:

Wann? 18.10.2025, 10.30 Uhr – 12:00 Uhr

Wo? Zoom, Link folgt

Wozu? Mitgliederversammlung 2025

Bitte lest euch die angehängte Tagesordnung einmal durch und meldet euch bis zum 10.10.2024, 19 Uhr bei mir für weitere Anträge oder Fragen. Antwortet hierfür einfach auf diese E-Mail oder schreibt mir auf WhatsApp (+4915168188322).

Vor der Mitgliederversammlung bekommt ihr eine aktualisierte Tagesordnung mit allen bis dahin eingegangenen Anträgen und Kandidaturen.

Wenn ihr gar nicht teilnehmen könnt, könnt ihr euer Stimmrecht bis Dienstag, den 14.10.2025 auf eine andere Person übertragen.

Am Abend nach der Mitgliederversammlung (18.10.2025 ab 19 Uhr) bieten wir für alle Interessierten einen gemeinsamen Besuch der Augsburger Light Nights an. Treffpunkt ist auf der Augsburger Fuggerplatz vor dem Maximilianmuseum.  

Ich freue mich auf euer Kommen und auf einen erfolgreichen Abschluss unseres zweiten Vereinsjahrs!

Liebe Grüße
Julia (sie/ihr)
Transparenzbeauftragte von Queer Augsburg e.V.

Tagesordnungspunkte:

1.Beschluss des Vorstandes über alle bis dann eingegangenen Mitgliedsanträge
2.Begrüßung durch Transparenzperson
3.Feststellung der Beschlussfähigkeit
4.Beschluss der Tagesordnung (Davor können Anträge noch eingereicht werden, danach nur noch nach Zustimmung der Mehrheit)
5.Finanzen 2024 final
6.Finanzen 2025 Stand jetzt
7.Bericht 2024 final
8.Bericht 2025 Stand jetzt
9.Bericht der Transparenzperson über die Arbeit des Vorstands

10.Themen des vergangenen Jahres:
10.1 Raum
10.2 Aktionsplan
10.3 Vernetzung mit der Politik
10.4 Treffen

11.Anträge zur vergangenen Amtszeit
12.Entlastung des alten Vorstandes
13.Wahl der neuen Transparenzperson, Kandidaturen:
13.1 Jerome Petrov
13.2 Gabriel Dehner
13.3. Annabel Welsch

14.Wahl der neuen Finanzperson, Kandidaturen:
14.1 Jerome Petrov

15.Wahl des neuen Vorstandes, Kandidaturen:
15.1 Paul Kunstmann
15.2 Helena Kosch
15.3 Aiden Lane Ziegler

16.PAUSE

17.Ernennung der Beauftragten durch den neuen Vorstand
17.1 Marketing: Benji Kalide
17.2 Recht: Paul Kunstmann, Jerome Petrov
17.3 Digitales und Datenschutz: Paul Hennig
17.4 Vereinsverwaltung: BITTE BEWERBEN :)
17.5 Studierende: Leon Tokan
17.6 Trans: Aiden Lane Zieger, Aurora Schupp, BITTE BEWERBEN :)
17.7 Aro_Ace: Emmanuel Fleischer, Aurora Schupp
17.8 Kultur: Aiden Lane Ziegler
17.9 Disability: Aiden Lane Ziegler
17.10 Öffentlichkeitsarbeit und Vernetzung: Helena Kosch
17.11 Party: Simon Staiger

18.Bestätigung der neuen Beauftragten durch die Mitgliederversammlung

19.Antrag: Ehrenamtspauschale für Senat und Vorstand und Treffensorganisierende
Um Wertschätzung zu zeigen und für zeitlichen und materiellen einen Ausgleich zu bieten, schlägt der alte Vorstand vor, durch die Mitgliederversammlung ermächtigt zu werden, Ehrenamtspauschalen auszuzahlen. Der Testversuch zu den thematischen Treffen ist positiv ausgefallen und soll fortgesetzt werden. Die Pauschalen nach Ermessen des Vorstandes max. 10 Euro pro durchgeführtes Treffen, max. 15 Euro für die Mitwirkung in der diesjährigen Theatergruppe, max. 25 Euro pro Senator*in im Jahr und max. 75 Euro pro Vorstandsmitglied betragen.

20.Bericht und Debatte zu Räumen bzgl. dem runden Tisch zu den Räumen und zur politischen Arbeit von Queer Augsburg e.V.
21.Weitere Anträge für die kommende Amtszeit
22.Schließung der Sitzung
23.Unterschrift des Protokolls durch Transparenzperson und Protokollperson (auch erst nach Fertigstellung) und dann Versand an alle Mitglieder`;

const mail_to_send: SendConfig = {
    from: "transparenz@queer-augsburg.de",
    replyTo: "transparenz@queer-augsburg.de",
    to: "paul@vindelicum.eu",
    subject: "Ladung zu Queer Augsburg Mitgliederversammlung am 18.10.2025",
    // docx "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    // pdf "application/pdf"
    attachments: [
        /*{
            content: attachment_file_1,
            encoding: "binary",
            contentType: "application/pdf",
            filename: "Queer Augsburg Pride 2025.pdf",
        },*/
    ],
    mimeContent: [
        {
            mimeType: 'text/plain; charset="utf-8"',
            content,
        },
    ],
};

const users = await users_collection.find({}).toArray();

const REAL_mail_recipients = users.flatMap((user) => {
    const mail = user?.member?.email;
    if (mail) {
        // && user.member?.status === "Approved"
        return [mail];
    }
    return [];
});

//console.log(mail_recipients);

const TEST_mail_recipients = ["multimunding@gmail.com", "paul@vindelicum.eu"];

const responses = [];
// REAL_mail_recipients

for (const mail of TEST_mail_recipients) {
    mail_to_send.to = mail;

    const res = {
        email: mail,
        success: false,
        error: "",
    };

    await smtp_client
        .send(mail_to_send)
        .catch((err) => {
            console.error(err);
            res.error = err.message;
        })
        .then(() => {
            res.success = true;
        });

    console.log(res);

    responses.push(res);
}

await smtp_client.close();

await mongo_client.close();

await Deno.writeTextFile(
    `./data/mail_responses_${new Date()
        .toISOString()
        .replace(/[:.]/g, "-")}.json`,
    JSON.stringify(responses, null, 2)
);
