import { MongoClient } from "https://deno.land/x/mongo@v0.33.0/mod.ts";

const client = new MongoClient();

const mongo_uri = Deno.env.get("QA_MONGO_URI");

if (!mongo_uri) {
    throw new Error("Please provide QA_MONGO_URI");
}

await client.connect(mongo_uri);

const db = client.database("queer-augsburg");

const collection = db.collection("users");

const user = {
    admin: false,
    capabilities: [],
    imported_from: "papieranträge_14102024",
};

const new_members = await Deno.readTextFile("./qa-new-members.json");

const new_members_json = JSON.parse(new_members);

// random alphanumeric string
const get_random_string = () => {
    const numbers = crypto.getRandomValues(new Uint8Array(16));

    let random_string = "";

    for (let i = 0; i < numbers.length; i++) {
        random_string += String.fromCharCode(65 + (numbers[i] % 26));
    }

    return random_string.toLowerCase();
};

const new_users = new_members_json.map((member_outer: any) => {
    const { member } = member_outer;
    if (member?.approved) {
        member.status = "Approved";
        delete member.approved;
    }

    member.name.passport = member.name.first_name + " " + member.name.last_name;

    return {
        _id: get_random_string(),
        ...user,
        member,
    };
});

await collection.deleteMany({
    imported_from: "papieranträge_14102024",
});

await collection.insertMany(new_users);
