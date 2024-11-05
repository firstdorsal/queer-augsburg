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
    "./data/Tagesordnung zur Mitgliederversammlung_Nov2024_final.docx"
);

const content = ``;

const mail_to_send: SendConfig = {
    from: "transparenz@queer-augsburg.de",
    replyTo: "transparenz@queer-augsburg.de",
    to: "paul@vindelicum.eu",
    priority: "high",
    subject:
        "Zoomlink zur digitalen Teilnahme an der Mitgliederversammlung 2024",
    /*   attachments: [
        {
            content: attachment_file,
            encoding: "binary",
            contentType:
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            filename:
                "Tagesordnung zur Mitgliederversammlung_Nov2024_final.docx",
        },
    ],*/
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
        // && user.member?.status === "Approved"
        return [mail];
    }
    return [];
});

//console.log(mail_recipients);

//const mail_recipients_test = ["multimunding@gmail.com"];

const responses = [];

for (const mail of mail_recipients) {
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
    "./data/mail_responses_31102024.json",
    JSON.stringify(responses, null, 2)
);
