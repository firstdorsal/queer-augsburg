//! Rules of the internal documents. `web/src/documents.ts` mirrors `clean_name`,
//! `derive_title`, `may_read_documents` and the limits; `document_validation_cases.json` is run
//! by both and also pins the close codes.

use crate::place_rules::is_forbidden_char;
use crate::types::{GetDocumentsResponseBody, User, WikiDocumentGroup, WikiDocumentSummary};
use std::collections::{HashMap, HashSet};
use unicode_normalization::{char::is_combining_mark, UnicodeNormalization};

pub const MAX_DOCUMENT_TITLE_CHARS: usize = 200;
pub const MAX_GROUP_NAME_CHARS: usize = 100;
pub const MAX_DOCUMENT_TEXT_CHARS: usize = 100_000;
/// Far above real use; bounds what one request stores.
pub const MAX_IDS_PER_REQUEST: usize = 1_000;

pub const UNTITLED: &str = "Ohne Titel";

#[derive(Debug, PartialEq, Eq)]
pub enum DocumentsAccess {
    Granted,
    LoginRequired,
    Forbidden,
}

/// `user` is the viewer's user record, `logged_in` whether there is a session at all.
pub fn documents_access(logged_in: bool, user: Option<&User>) -> DocumentsAccess {
    match user {
        Some(user) if user.may_read_documents() => DocumentsAccess::Granted,
        _ if !logged_in => DocumentsAccess::LoginRequired,
        _ => DocumentsAccess::Forbidden,
    }
}

/// A title or group name without surrounding space. `what` names it in the German message.
pub fn clean_name(value: &str, max_chars: usize, what: &str) -> Result<String, String> {
    let name = value.trim();
    if name.is_empty() {
        return Err(format!("Bitte {what} angeben."));
    }
    if name.chars().any(is_forbidden_char) {
        return Err(format!("{what} enthält unzulässige Zeichen."));
    }
    if name.chars().count() > max_chars {
        return Err(format!(
            "{what} ist zu lang (höchstens {max_chars} Zeichen)."
        ));
    }
    Ok(name.to_string())
}

/// The text a new document starts with.
pub fn first_text(title: &str, content: &str) -> String {
    format!("# {title}\n\n{content}")
}

/// The first `# ` heading, else the first line with text.
pub fn derive_title(text: &str) -> String {
    let lines = || text.lines().map(str::trim);
    let heading = lines()
        .filter_map(|line| line.strip_prefix("# "))
        .map(|heading| heading.trim().trim_end_matches('#').trim())
        .find(|heading| !heading.is_empty());
    let title = heading.or_else(|| lines().find(|line| !line.trim_matches('#').trim().is_empty()));
    let title: String = title
        .unwrap_or_default()
        .chars()
        .filter(|c| !is_forbidden_char(*c))
        .take(MAX_DOCUMENT_TITLE_CHARS)
        .collect();
    let title = title.trim();
    if title.is_empty() {
        UNTITLED.to_string()
    } else {
        title.to_string()
    }
}

/// Sorts Ä with A and ignores case, which plain code point order does not.
pub fn sort_key(name: &str) -> String {
    name.nfd()
        .filter(|c| !is_combining_mark(*c))
        .collect::<String>()
        .to_lowercase()
}

/// `ids` (alphabetical) with those named in `order` first, in that order. The order is only a
/// wish: unknown ids are skipped and the rest keeps its place, so that a stale or racing
/// order can never lose anything.
pub fn apply_order(ids: Vec<String>, order: &[String]) -> Vec<String> {
    let known: HashSet<&String> = ids.iter().collect();
    let mut seen = HashSet::new();
    let mut ordered: Vec<String> = order
        .iter()
        .filter(|id| known.contains(id) && seen.insert(*id))
        .cloned()
        .collect();
    ordered.extend(ids.iter().filter(|id| !seen.contains(id)).cloned());
    ordered
}

/// A group as stored: `document_order` and the group order are wishes, see `apply_order`.
#[derive(Debug, Clone)]
pub struct StoredGroup {
    pub _id: String,
    pub name: String,
    pub document_order: Vec<String>,
}

/// A live document with the groups it is in.
#[derive(Debug, Clone)]
pub struct ListedDocument {
    pub _id: String,
    pub title: String,
    pub group_ids: Vec<String>,
}

pub fn arrange_documents(
    mut groups: Vec<StoredGroup>,
    group_order: &[String],
    mut documents: Vec<ListedDocument>,
) -> GetDocumentsResponseBody {
    documents.sort_by_cached_key(|document| (sort_key(&document.title), document._id.clone()));
    groups.sort_by_cached_key(|group| (sort_key(&group.name), group._id.clone()));

    let known_groups: HashSet<&str> = groups.iter().map(|group| group._id.as_str()).collect();
    let mut members: HashMap<&str, Vec<String>> = HashMap::new();
    let mut ungrouped_ids = Vec::new();
    for document in &documents {
        let mut in_a_group = false;
        for group_id in &document.group_ids {
            if known_groups.contains(group_id.as_str()) {
                in_a_group = true;
                members
                    .entry(group_id.as_str())
                    .or_default()
                    .push(document._id.clone());
            }
        }
        if !in_a_group {
            ungrouped_ids.push(document._id.clone());
        }
    }

    let group_ids = groups.iter().map(|group| group._id.clone()).collect();
    let display_order = apply_order(group_ids, group_order);
    let mut by_id: HashMap<&str, &StoredGroup> = groups
        .iter()
        .map(|group| (group._id.as_str(), group))
        .collect();
    let arranged = display_order
        .iter()
        .filter_map(|id| by_id.remove(id.as_str()))
        .map(|group| WikiDocumentGroup {
            _id: group._id.clone(),
            name: group.name.clone(),
            document_ids: apply_order(
                members.remove(group._id.as_str()).unwrap_or_default(),
                &group.document_order,
            ),
        })
        .collect();

    GetDocumentsResponseBody {
        groups: arranged,
        documents: documents
            .into_iter()
            .map(|document| WikiDocumentSummary {
                _id: document._id,
                title: document.title,
            })
            .collect(),
        ungrouped_ids,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::UserCapabilities;
    use serde::Deserialize;

    #[derive(Deserialize)]
    struct NameCase {
        name: String,
        value: String,
        /// The cleaned value, `null` when refused.
        expected: Option<String>,
    }

    #[derive(Deserialize)]
    struct AccessCase {
        name: String,
        capabilities: Vec<UserCapabilities>,
        status: Option<crate::types::MembershipStatus>,
        read: bool,
        edit: bool,
    }

    #[derive(Deserialize)]
    struct TitleCase {
        name: String,
        text: String,
        expected: String,
    }

    #[derive(Deserialize)]
    struct Limits {
        title: usize,
        group_name: usize,
        text: usize,
    }

    #[derive(Deserialize)]
    struct Cases {
        names: Vec<NameCase>,
        titles: Vec<TitleCase>,
        access: Vec<AccessCase>,
        limits: Limits,
        close_codes: HashMap<String, u16>,
    }

    fn cases() -> Cases {
        serde_json::from_str(include_str!("document_validation_cases.json")).unwrap()
    }

    fn member(status: crate::types::MembershipStatus) -> crate::types::InternalMember {
        serde_json::from_value(serde_json::json!({
            "type": "Active", "natural_person": true, "name": null, "institution": null,
            "pronouns": null,
            "address": {"street": "S", "number": "1", "addition": null, "zip": "86150",
                        "city": "Augsburg", "country": "DE"},
            "email": "a@b.de", "phone": null, "start_time_ms": 1, "end_time_ms": null,
            "status": status, "user_notes": null, "admin_notes": null, "reference": null,
            "approved_charter": true, "approved_privacy": true, "above_18": true,
            "honorary": false
        }))
        .unwrap()
    }

    #[test]
    fn shared_name_cases() {
        for case in cases().names {
            let result = clean_name(&case.value, 20, "der Name").ok();
            assert_eq!(result, case.expected, "{}", case.name);
        }
    }

    #[test]
    fn limits_and_close_codes_match_the_shared_values() {
        use crate::document_rooms::*;
        let cases = cases();
        assert_eq!(cases.limits.title, MAX_DOCUMENT_TITLE_CHARS);
        assert_eq!(cases.limits.group_name, MAX_GROUP_NAME_CHARS);
        assert_eq!(cases.limits.text, MAX_DOCUMENT_TEXT_CHARS);
        let code = |name: &str| cases.close_codes[name];
        assert_eq!(code("badMessage"), CLOSE_BAD_MESSAGE);
        assert_eq!(code("session"), CLOSE_SESSION);
        assert_eq!(code("noPermission"), CLOSE_NO_PERMISSION);
        assert_eq!(code("deleted"), CLOSE_DELETED);
        assert_eq!(code("tooLarge"), CLOSE_TOO_LARGE);
        assert_eq!(code("damaged"), CLOSE_DAMAGED);
    }

    #[test]
    fn shared_title_cases() {
        for case in cases().titles {
            assert_eq!(derive_title(&case.text), case.expected, "{}", case.name);
        }
    }

    #[test]
    fn shared_access_cases() {
        for case in cases().access {
            let user = User {
                id: "u".to_string(),
                member: case.status.map(member),
                capabilities: Some(case.capabilities),
            };
            assert_eq!(user.may_read_documents(), case.read, "{}", case.name);
            assert_eq!(
                user.has_capability(&UserCapabilities::UpdateDocuments),
                case.edit,
                "{}",
                case.name
            );
        }
    }

    #[test]
    fn guests_log_in_and_accounts_without_a_record_are_refused() {
        assert_eq!(
            documents_access(false, None),
            DocumentsAccess::LoginRequired
        );
        assert_eq!(documents_access(true, None), DocumentsAccess::Forbidden);
    }

    #[test]
    fn a_title_is_cut_on_a_character() {
        let long = format!("# {}", "ä".repeat(MAX_DOCUMENT_TITLE_CHARS + 50));
        assert_eq!(
            derive_title(&long).chars().count(),
            MAX_DOCUMENT_TITLE_CHARS
        );
    }

    #[test]
    fn umlauts_sort_with_their_letters() {
        let mut names = vec!["Zoo", "ärger", "Apfel", "Öl"];
        names.sort_by_key(|name| sort_key(name));
        assert_eq!(names, ["Apfel", "ärger", "Öl", "Zoo"]);
    }

    fn ids(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn an_order_is_followed_and_the_rest_keeps_its_place() {
        assert_eq!(
            apply_order(ids(&["a", "b", "c", "d"]), &ids(&["c", "a"])),
            ids(&["c", "a", "b", "d"])
        );
    }

    #[test]
    fn a_stale_order_loses_nothing() {
        assert_eq!(
            apply_order(ids(&["a", "b"]), &ids(&["gone", "b", "b"])),
            ids(&["b", "a"])
        );
    }

    fn document(id: &str, title: &str, groups: &[&str]) -> ListedDocument {
        ListedDocument {
            _id: id.to_string(),
            title: title.to_string(),
            group_ids: ids(groups),
        }
    }

    fn group(id: &str, name: &str, order: &[&str]) -> StoredGroup {
        StoredGroup {
            _id: id.to_string(),
            name: name.to_string(),
            document_order: ids(order),
        }
    }

    #[test]
    fn a_document_can_be_in_several_groups() {
        let body = arrange_documents(
            vec![group("g1", "Eins", &[]), group("g2", "Zwei", &[])],
            &[],
            vec![document("d", "Doc", &["g1", "g2"])],
        );
        assert_eq!(body.groups[0].document_ids, ids(&["d"]));
        assert_eq!(body.groups[1].document_ids, ids(&["d"]));
        assert_eq!(body.documents.len(), 1);
        assert!(body.ungrouped_ids.is_empty());
    }

    #[test]
    fn groups_and_their_documents_follow_their_order_then_the_alphabet() {
        let body = arrange_documents(
            vec![
                group("g1", "Alpha", &["d3"]),
                group("g2", "Beta", &[]),
                group("g3", "Gamma", &[]),
            ],
            &ids(&["g3"]),
            vec![
                document("d1", "A", &["g1"]),
                document("d2", "B", &["g1"]),
                document("d3", "C", &["g1"]),
            ],
        );
        let names: Vec<&str> = body
            .groups
            .iter()
            .map(|group| group.name.as_str())
            .collect();
        assert_eq!(names, ["Gamma", "Alpha", "Beta"]);
        assert_eq!(body.groups[1].document_ids, ids(&["d3", "d1", "d2"]));
    }

    #[test]
    fn a_document_only_in_a_deleted_group_counts_as_ungrouped() {
        let body = arrange_documents(vec![], &[], vec![document("d", "Doc", &["gone"])]);
        assert_eq!(body.ungrouped_ids, ids(&["d"]));
    }
}
