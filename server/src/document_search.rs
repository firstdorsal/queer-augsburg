//! Full-text search: every term must occur in the title or text, as part of a word too, so that
//! "satzung" finds "Vereinssatzung", which MongoDB's `$text` does not.

use crate::document_rules::sort_key;
use regex::{Regex, RegexBuilder};
use std::ops::Range;
use unicode_normalization::UnicodeNormalization;

pub const MAX_TERMS: usize = 5;
pub const MAX_QUERY_CHARS: usize = 100;
pub const MIN_QUERY_CHARS: usize = 2;
pub const SNIPPET_CHARS: usize = 200;
pub const MAX_HITS: usize = 50;

#[derive(Debug, PartialEq, Eq, thiserror::Error)]
pub enum QueryError {
    #[error("Bitte mindestens {MIN_QUERY_CHARS} Zeichen eingeben.")]
    TooShort,
    #[error("Die Suche ist zu lang (höchstens {MAX_QUERY_CHARS} Zeichen).")]
    TooLong,
    #[error("Bitte höchstens {MAX_TERMS} Wörter eingeben.")]
    TooManyTerms,
}

/// The search terms. Control characters separate, otherwise "a\nb" would become one term.
pub fn parse_query(query: &str) -> Result<Vec<String>, QueryError> {
    let query: String = query
        .chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .nfc()
        .collect();
    let query = query.trim();
    let length = query.chars().count();
    if length < MIN_QUERY_CHARS {
        return Err(QueryError::TooShort);
    }
    if length > MAX_QUERY_CHARS {
        return Err(QueryError::TooLong);
    }
    let terms: Vec<String> = query.split_whitespace().map(str::to_owned).collect();
    if terms.len() > MAX_TERMS {
        return Err(QueryError::TooManyTerms);
    }
    Ok(terms)
}

/// One pattern per term, accepting ss for ß and composed or decomposed letters. Running on the
/// original text keeps the offsets right, which normalising the text would not.
pub fn compile_terms(terms: &[String]) -> Result<Vec<Regex>, regex::Error> {
    terms.iter().map(|term| compile_term(term)).collect()
}

fn compile_term(term: &str) -> Result<Regex, regex::Error> {
    let chars: Vec<char> = term.chars().collect();
    let mut pattern = String::new();
    let mut index = 0;
    while index < chars.len() {
        let c = chars[index];
        let next = chars.get(index + 1);
        if matches!(c, 's' | 'S') && matches!(next, Some('s' | 'S')) {
            pattern.push_str("(?:ss|ß)");
            index += 2;
            continue;
        }
        index += 1;
        if matches!(c, 'ß' | 'ẞ') {
            pattern.push_str("(?:ß|ss)");
            continue;
        }
        let composed = c.to_string();
        let decomposed: String = composed.nfd().collect();
        if decomposed == composed {
            pattern.push_str(&regex::escape(&composed));
        } else {
            let (composed, decomposed) = (regex::escape(&composed), regex::escape(&decomposed));
            pattern.push_str(&format!("(?:{composed}|{decomposed})"));
        }
    }
    RegexBuilder::new(&pattern).case_insensitive(true).build()
}

/// `width` characters around `hit`, cut on character boundaries.
fn snippet_range(text: &str, hit: Range<usize>, width: usize) -> Range<usize> {
    let hit_chars = text[hit.clone()].chars().count();
    let before = width.saturating_sub(hit_chars) / 2;
    let start = text[..hit.start]
        .char_indices()
        .rev()
        .take(before)
        .last()
        .map_or(hit.start, |(index, _)| index);
    let end = text[start..]
        .char_indices()
        .nth(width)
        .map_or(text.len(), |(index, _)| start + index);
    start..end
}

#[derive(Debug, PartialEq, Eq)]
pub struct SearchMatch {
    /// All terms occur in the title.
    pub in_title: bool,
    pub snippet: String,
}

pub fn match_document(title: &str, content: &str, terms: &[Regex]) -> Option<SearchMatch> {
    let mut first_hit: Option<Range<usize>> = None;
    for term in terms {
        let hit = term.find(content).map(|found| found.range());
        if hit.is_none() && !term.is_match(title) {
            return None;
        }
        if let Some(hit) = hit {
            if first_hit
                .as_ref()
                .is_none_or(|first| hit.start < first.start)
            {
                first_hit = Some(hit);
            }
        }
    }
    Some(SearchMatch {
        in_title: terms.iter().all(|term| term.is_match(title)),
        snippet: first_hit.map_or(String::new(), |hit| {
            content[snippet_range(content, hit, SNIPPET_CHARS)].to_string()
        }),
    })
}

/// Title hits first, then by title, at most `MAX_HITS`.
pub fn best_hits<T>(mut hits: Vec<(SearchMatch, String, T)>) -> Vec<(SearchMatch, T)> {
    hits.sort_by_cached_key(|(found, title, _)| (!found.in_title, sort_key(title)));
    hits.into_iter()
        .take(MAX_HITS)
        .map(|(found, _, hit)| (found, hit))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn found(query: &str, text: &str) -> bool {
        let terms = compile_terms(&parse_query(query).unwrap()).unwrap();
        match_document("", text, &terms).is_some()
    }

    #[test]
    fn parts_of_words_are_found() {
        assert!(found("satzung", "Die Vereinssatzung"));
    }

    #[test]
    fn case_does_not_matter_for_umlauts() {
        assert!(found("ÄNDERUNG", "die änderung"));
        assert!(found("änderung", "DIE ÄNDERUNG"));
        assert!(found("übung", "ÜBUNG"));
    }

    #[test]
    fn eszett_and_double_s_find_each_other() {
        assert!(found("strasse", "Die Straße"));
        assert!(found("STRASSE", "Die Straße"));
        assert!(found("straße", "DIE STRASSE"));
        assert!(found("Masse", "Maße"));
    }

    #[test]
    fn decomposed_text_and_queries_are_found() {
        let decomposed: String = "Größe der Änderung".nfd().collect();
        assert!(found("änderung", &decomposed));
        assert!(found(&decomposed, "Größe der Änderung"));
    }

    #[test]
    fn regex_characters_are_plain_text() {
        assert!(found("C++", "wir nutzen c++ hier"));
        assert!(!found("a.b", "axb"));
    }

    #[test]
    fn every_term_must_occur_somewhere() {
        let terms = compile_terms(&parse_query("vorstand protokoll").unwrap()).unwrap();
        assert!(match_document("Protokoll", "vom Vorstand", &terms).is_some());
        assert!(match_document("Protokoll", "vom Verein", &terms).is_none());
    }

    #[test]
    fn title_hits_are_marked() {
        let terms = compile_terms(&parse_query("links").unwrap()).unwrap();
        assert!(match_document("Links", "", &terms).unwrap().in_title);
        assert!(!match_document("Andere", "links", &terms).unwrap().in_title);
    }

    #[test]
    fn a_snippet_surrounds_the_hit_and_stops_on_characters() {
        let text = format!("{}Treffer{}", "ä🌈".repeat(300), "ö🌈".repeat(300));
        let terms = compile_terms(&parse_query("treffer").unwrap()).unwrap();
        let snippet = match_document("", &text, &terms).unwrap().snippet;
        assert!(snippet.contains("Treffer"));
        assert_eq!(snippet.chars().count(), SNIPPET_CHARS);
    }

    #[test]
    fn only_a_title_hit_has_no_snippet() {
        let terms = compile_terms(&parse_query("links").unwrap()).unwrap();
        assert_eq!(
            match_document("Links", "anderes", &terms).unwrap().snippet,
            ""
        );
    }

    #[test]
    fn title_hits_come_first_and_the_list_has_a_limit() {
        let hit = |in_title: bool, title: &str| {
            let found = SearchMatch {
                in_title,
                snippet: String::new(),
            };
            (found, title.to_string(), title.to_string())
        };
        let mut hits = vec![hit(false, "Apfel"), hit(true, "Zoo"), hit(true, "Ärger")];
        hits.extend((0..60).map(|n| hit(false, &format!("Rest {n}"))));
        let best = best_hits(hits);
        assert_eq!(best.len(), MAX_HITS);
        let titles: Vec<&str> = best
            .iter()
            .take(3)
            .map(|(_, title)| title.as_str())
            .collect();
        assert_eq!(titles, ["Ärger", "Zoo", "Apfel"]);
    }

    #[test]
    fn queries_have_limits() {
        assert_eq!(parse_query(" a "), Err(QueryError::TooShort));
        assert_eq!(
            parse_query(&"a".repeat(MAX_QUERY_CHARS + 1)),
            Err(QueryError::TooLong)
        );
        assert_eq!(parse_query("a b c d e f"), Err(QueryError::TooManyTerms));
    }

    #[test]
    fn control_characters_separate_terms() {
        assert_eq!(parse_query("satz\nung").unwrap(), ["satz", "ung"]);
    }
}
