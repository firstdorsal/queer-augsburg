import { MongoClient } from "npm:mongodb@6.1.0";

const mongo_uri = Deno.env.get("QA_MONGO_URI");

if (!mongo_uri) {
    throw new Error("Please provide QA_MONGO_URI");
}
const mongo_client = new MongoClient(mongo_uri);

await mongo_client.connect();

const db = mongo_client.db("queer-augsburg");

const users_collection = db.collection("users");

// get all member.time_start_ms fields into an array

const member_timestamps = await users_collection.find({}).toArray();

const mt = member_timestamps.flatMap((user) => {
    if (user?.member?.start_time_ms) {
        return [user.member.start_time_ms];
    } else {
        return [];
    }
});
console.log(mt.length);

console.log(JSON.stringify(mt));

await mongo_client.close();
