import { MongoClient, Double, Long } from "npm:mongodb@6.1.0";

const mongo_uri = Deno.env.get("QA_MONGO_URI");

if (!mongo_uri) {
    throw new Error("Please provide QA_MONGO_URI");
}
const mongo_client = new MongoClient(mongo_uri);

await mongo_client.connect();

const db = mongo_client.db("queer-augsburg");

const users_collection = db.collection("users");

// set the field of member.start_time_ms to the value of  member.start_time_secs with the type of int64

for await (const user of users_collection.find({})) {
    await users_collection.updateOne(
        { _id: user._id },
        {
            $unset: {
                "member.start_time_secs": "",
                "member.end_time_secs": "",
            },
        }
    );
}

await mongo_client.close();
