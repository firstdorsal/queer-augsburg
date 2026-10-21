// Same normalization as server/src/place_rules.rs `place_name_key` and web/src/places.ts
// `placeNameKey`; all three are tested against server/src/place_key_cases.json.
// Whitespace = Unicode White_Space (what Rust's split_whitespace uses; JS \s differs).
const WHITESPACE = new RegExp(
    "[\\t-\\r \\u0085\\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000]+"
);
const APOSTROPHES = new RegExp("[\\u2018\\u2019\\u02BC\\u00B4`]", "g");

const nameKey = (name) =>
    name
        .normalize("NFC")
        .replace(APOSTROPHES, "'")
        .split(WHITESPACE)
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

module.exports = { nameKey };
