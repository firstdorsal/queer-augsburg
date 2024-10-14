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
    throw new Error("Please provide TRANSPARENZ_MAIL_PASSWORD");
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

const attachment_file = await Deno.readFile(
    "./data/tagesordnung_queer_augsburg_2024.docx"
);

const content = `Liebes Mitglied von Queer Augsburg e.V., 

es ist so weit: unsere erste alljährliche Mitgliederversammlung nach Gründung unseres Vereins steht an! Ich freue mich auf Berichte unserer Vereinsarbeit im vergangenen Jahr, Neuwahlen und -beauftragungen unserer Ämter, Beschlüsse für das neue Jahr und ein gemütliches Beisammensein bei Häppchen und Kaffee. Als Transparenzbeauftragte von Queer Augsburg e.V. darf ich euch somit einladen: 

Wann? 02.11.2024, 10.30 Uhr – 15.30 Uhr 

Wo? Kleiner roter Saal im Ulrichseck, Ulrichsplatz 1, 86150 Augsburg (die Beschilderung am Gebäude wird dir am Tag helfen!) 

Wozu? Mitgliederversammlung 2024

Bitte seht euch die angehängte Tagesordnung einmal durch und meldet euch bis zum 02.11.24, 09 Uhr bei mir für weitere Anträge oder Fragen. Antwortet hierfür einfach auf diese E-Mail oder schreibt mir auf WhatsApp (+4915168188322). 

Vor der Mitgliederversammlung bekommt ihr eine aktualisierte Tagesordnung mit allen bis dahin eingegangenen Anträgen und Kandidaturen.

Ihr werdet wahrscheinlich auch digital über Zoom an der Versammlung teilnehmen können. Weitere Infos dazu folgen.

Wenn ihr gar nicht teilnehmen könnt, könnt ihr euer Stimmrecht bis Dienstag, den 29.10. auf eine andere Person übertragen. 

Ich freue mich auf euer Kommen und auf einen erfolgreichen Abschluss unseres Gründungsjahres!

Liebe Grüße 
Julia (sie/ihr)
Transparenzbeauftragte von Queer Augsburg e.V.`;

const mail_to_send: SendConfig = {
    from: "transparenz@queer-augsburg.de",
    replyTo: "transparenz@queer-augsburg.de",
    to: "paul@vindelicum.eu",
    priority: "high",
    subject: "Einladung zur Mitgliederversammlung 2024",
    attachments: [
        {
            content: attachment_file,
            encoding: "binary",
            contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename: "Tagesordnung zur Mitgliederversammlung_Nov2024.docx",
        },
    ],
    mimeContent: [
        {
            mimeType: 'text/plain; charset="utf-8"',
            content,
        },
    ],
};

const users = await users_collection.find({}).toArray();

const mail_recipients = users.flatMap((user) => {
    const mail = user?.member?.email;
    if (mail) {
        return [mail];
    }
    return [];
});

const mail_recipients_test = ["multimunding@gmail.com"];

const responses = [];

for (const mail of mail_recipients_test) {
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
    "./data/mail_responses.json",
    JSON.stringify(responses, null, 2)
);
