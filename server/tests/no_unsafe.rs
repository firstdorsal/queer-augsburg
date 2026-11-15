//! The server's only unsafe code is the allocator, `src/capped_allocator.rs`, plus one `ioctl`
//! statement in the row-hold proxy of `tests/document_search_load.rs`. The `unsafe_code` lint
//! (denied in lib.rs, forbidden in main.rs, the binaries and the other test crates) cannot
//! promise that alone: rustc does not report it inside the expansion of a macro from another
//! crate. An `unsafe` block in a `#[macro_export]` macro of the library, expanded only in
//! main.rs or in a test, passes the deny and every forbid.
//!
//! So this test reads the source itself: every `.rs` file of the package outside `target/`,
//! split into tokens as rustc splits them, so comments and string and character literals are not
//! code. A first line that starts with `#!` and does not open an attribute is a shebang, which
//! rustc drops in any file, a module's too; so does this scan. It fails on
//! - the keyword `unsafe` (blocks, functions, traits, impls, `extern` blocks, `#[unsafe(…)]`
//!   attributes, and macro bodies, which are tokens like any other). Allowed: the allocator,
//!   only while its code equals [`ALLOCATOR_CODE`] token for token, and the `ioctl` statement,
//!   once, token for token;
//! - `no_mangle`, `export_name` and `link_section`, the attributes the lint reports besides
//!   `unsafe`, and `global_asm` and `naked_asm`, assembly without an `unsafe` block, also as
//!   raw identifiers (`r#no_mangle`);
//! - the identifier `include`, wherever it stands, so also in `use core::include as inc;`, and
//!   an attribute `path`, also inside `cfg_attr`: both can bring in code from a file this scan
//!   does not read;
//! - an attribute whose name a macro fills in (`#[$m]`), which can be either;
//! - a `link` attribute, which links a native library, whose code (constructors included) runs
//!   in the process without an `unsafe` token;
//! - a `#[doc = …]` whose value is not a string literal, such as `include_str!(…)`;
//! - a file that opens with `---`, a frontmatter, whose text rustc skips where it accepts one
//!   (not on stable Rust 1.99);
//! - in the library (`src/` without main.rs and `src/bin/`), whose doc comments rustdoc compiles
//!   as doctests: those words, `include`, and `path` followed by `=`, in a doc comment or in a
//!   `#[doc = "…"]` string, read with its escapes resolved.
//!
//! A second test checks what else the build reads: every target of the package, as
//! `cargo metadata` reads Cargo.toml, is one of the scanned files; there is no build script;
//! every dependency comes from crates.io; and the package's `.cargo/` holds only `config.toml`
//! with the one setting in [`CARGO_CONFIG`].
//!
//! What it cannot see:
//! - code that macros and build scripts of dependencies generate, which is trusted as their own
//!   unsafe code is;
//! - safe code that changes the process's memory from outside the language: writing
//!   `/proc/self/mem` with `std::fs` raises the search slots with no `unsafe` token anywhere, in
//!   the library and in a test crate alike, and so could a debugger the process starts on
//!   itself;
//! - what the build environment adds: Cargo configuration outside the package (its parent
//!   directories, `CARGO_HOME`), and `RUSTFLAGS` and the other variables Cargo and rustc read.

#![forbid(unsafe_code)]

use std::path::{Path, PathBuf};

/// Names that mark unsafe code wherever they appear as a token.
const FORBIDDEN: &[&str] = &[
    "unsafe",
    "no_mangle",
    "export_name",
    "link_section",
    "global_asm",
    "naked_asm",
];

/// The allocator, the one file with unsafe code of its own.
const ALLOCATOR: &str = "src/capped_allocator.rs";

/// The allocator's code as reviewed, without its comments. Its `unsafe` is allowed only while
/// the file's tokens equal these: nothing can be added to it, not even a macro, and nothing in
/// the bodies of its `unsafe fn`s (unsafe contexts in this edition) can change unseen. A change
/// to the allocator is a change to this copy.
const ALLOCATOR_CODE: &str = r#"
use std::alloc::{GlobalAlloc, Layout, System};

const MAX_ALLOCATION_BYTES: usize = 256 * 1024 * 1024;

fn too_big(size: usize) -> bool {
    size > MAX_ALLOCATION_BYTES
}

pub struct CappedAllocator;

unsafe impl GlobalAlloc for CappedAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if too_big(layout.size()) {
            return std::ptr::null_mut();
        }
        unsafe { System.alloc(layout) }
    }

    unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {
        unsafe { System.dealloc(pointer, layout) }
    }

    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if too_big(layout.size()) {
            return std::ptr::null_mut();
        }
        unsafe { System.alloc_zeroed(layout) }
    }

    unsafe fn realloc(&self, pointer: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        if too_big(new_size) {
            return std::ptr::null_mut();
        }
        unsafe { System.realloc(pointer, layout, new_size) }
    }
}
"#;

/// The one statement allowed outside it, as tokens, and its file.
const IOCTL_FILE: &str = "tests/document_search_load.rs";
const IOCTL: &[&str] = &[
    "unsafe", "{", "libc", ":", ":", "ioctl", "(", "socket", ",", "libc", ":", ":", "TIOCOUTQ",
    ",", "&", "mut", "unread", ")", "}",
];

/// Where every dependency must come from.
const CRATES_IO: &str = "registry+https://github.com/rust-lang/crates.io-index";

/// The lines of `.cargo/config.toml` that are neither empty nor comments.
const CARGO_CONFIG: &[&str] = &["[env]", r#"CHRONO_TZ_TIMEZONE_FILTER = "^Europe/Berlin$""#];

#[derive(Debug, Clone, PartialEq)]
enum Token {
    /// An identifier or keyword; `raw` for `r#name`, which is never the keyword.
    Ident { text: String, raw: bool },
    /// One punctuation character.
    Punct(char),
    /// A string, byte string, C string or raw string literal, with its content as written;
    /// `raw` when its backslashes are not escapes.
    Str { text: String, raw: bool },
    /// A doc comment's text.
    Doc(String),
    /// A number or a character or byte literal, as written.
    Other(String),
}

struct Lexed {
    token: Token,
    line: usize,
}

struct Lexer<'a> {
    chars: Vec<char>,
    position: usize,
    line: usize,
    source: &'a str,
}

/// rustc's whitespace (Unicode `Pattern_White_Space`), which is not `char::is_whitespace`: it
/// has the two direction marks and lacks, for example, the no-break space.
fn is_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n'
            | '\u{0B}'
            | '\u{0C}'
            | '\r'
            | ' '
            | '\u{85}'
            | '\u{200E}'
            | '\u{200F}'
            | '\u{2028}'
            | '\u{2029}'
    )
}

impl<'a> Lexer<'a> {
    fn new(source: &'a str) -> Self {
        Self {
            chars: source.chars().collect(),
            position: 0,
            line: 1,
            source,
        }
    }

    fn peek(&self, ahead: usize) -> Option<char> {
        self.chars.get(self.position + ahead).copied()
    }

    fn bump(&mut self) -> Option<char> {
        let c = self.peek(0)?;
        self.position += 1;
        if c == '\n' {
            self.line += 1;
        }
        Some(c)
    }

    fn fail(&self, what: &str) -> ! {
        panic!(
            "no_unsafe: cannot read the source at line {}: {what} (file starts {:?})",
            self.line,
            self.source.chars().take(40).collect::<String>()
        )
    }

    /// The next token, past whitespace and the comments that are not doc comments.
    fn next_token(&mut self) -> Option<Lexed> {
        loop {
            let c = self.peek(0)?;
            let line = self.line;
            let token = match c {
                c if is_whitespace(c) => {
                    self.bump();
                    continue;
                }
                '/' if self.peek(1) == Some('/') => match self.line_comment() {
                    Some(doc) => Token::Doc(doc),
                    None => continue,
                },
                '/' if self.peek(1) == Some('*') => match self.block_comment() {
                    Some(doc) => Token::Doc(doc),
                    None => continue,
                },
                '"' => Token::Str {
                    text: self.quoted(),
                    raw: false,
                },
                '\'' => self.quote_or_lifetime(),
                'r' if self.peek(1) == Some('#') && self.peek(2).is_some_and(is_ident_start) => {
                    self.bump();
                    self.bump();
                    Token::Ident {
                        text: self.ident(),
                        raw: true,
                    }
                }
                'b' | 'c' | 'r' if self.string_prefix().is_some() => {
                    let (prefix_len, raw) = self.string_prefix().unwrap();
                    let mut prefix = String::new();
                    for _ in 0..prefix_len {
                        prefix.extend(self.bump());
                    }
                    if raw {
                        Token::Str {
                            text: self.raw_string(),
                            raw: true,
                        }
                    } else if self.peek(0) == Some('\'') {
                        Token::Other(prefix + &self.char_literal())
                    } else {
                        Token::Str {
                            text: self.quoted(),
                            raw: false,
                        }
                    }
                }
                c if is_ident_start(c) => Token::Ident {
                    text: self.ident(),
                    raw: false,
                },
                c if c.is_ascii_digit() => {
                    let mut text = String::new();
                    while let Some(c) = self.peek(0).filter(|c| c.is_alphanumeric() || *c == '_') {
                        text.push(c);
                        self.bump();
                    }
                    Token::Other(text)
                }
                c => {
                    self.bump();
                    Token::Punct(c)
                }
            };
            return Some(Lexed { token, line });
        }
    }

    /// The length of a literal prefix (`b`, `c`, `br`, `cr`, `r`, then `#`s) before a quote,
    /// and whether the literal is raw.
    fn string_prefix(&self) -> Option<(usize, bool)> {
        let mut at = 0;
        if matches!(self.peek(0), Some('b' | 'c')) {
            at = 1;
        }
        let raw = self.peek(at) == Some('r');
        if raw {
            at += 1;
            let mut hashes = 0;
            while self.peek(at + hashes) == Some('#') {
                hashes += 1;
            }
            return (self.peek(at + hashes) == Some('"')).then_some((at, true));
        }
        match self.peek(at) {
            Some('"') if at == 1 => Some((1, false)),
            Some('\'') if at == 1 && self.peek(0) == Some('b') => Some((1, false)),
            _ => None,
        }
    }

    fn ident(&mut self) -> String {
        let mut text = String::new();
        while let Some(c) = self.peek(0).filter(|c| c.is_alphanumeric() || *c == '_') {
            text.push(c);
            self.bump();
        }
        text
    }

    /// `//…` to the end of the line; the text of a `///` or `//!` doc comment.
    fn line_comment(&mut self) -> Option<String> {
        let doc = matches!(
            (self.peek(2), self.peek(3)),
            (Some('/'), c) if c != Some('/')
        ) || self.peek(2) == Some('!');
        let mut text = String::new();
        while let Some(c) = self.peek(0).filter(|c| *c != '\n') {
            text.push(c);
            self.bump();
        }
        doc.then_some(text)
    }

    /// `/* … */`, nested; the text of a `/** */` or `/*! */` doc comment.
    fn block_comment(&mut self) -> Option<String> {
        let doc = (self.peek(2) == Some('*') && !matches!(self.peek(3), Some('*' | '/')))
            || self.peek(2) == Some('!');
        self.bump();
        self.bump();
        let mut depth = 1;
        let mut text = String::new();
        while depth > 0 {
            match (self.peek(0), self.peek(1)) {
                (Some('/'), Some('*')) => {
                    depth += 1;
                    self.bump();
                    self.bump();
                }
                (Some('*'), Some('/')) => {
                    depth -= 1;
                    self.bump();
                    self.bump();
                }
                (Some(c), _) => {
                    text.push(c);
                    self.bump();
                }
                (None, _) => self.fail("unterminated block comment"),
            }
        }
        doc.then_some(text)
    }

    /// `"…"` with escapes; the content as written.
    fn quoted(&mut self) -> String {
        self.bump();
        let mut text = String::new();
        loop {
            match self.bump() {
                Some('\\') => {
                    text.push('\\');
                    if let Some(c) = self.bump() {
                        text.push(c);
                    }
                }
                Some('"') => return text,
                Some(c) => text.push(c),
                None => self.fail("unterminated string"),
            }
        }
    }

    /// `r#…#"…"#…#`, the `r` already taken.
    fn raw_string(&mut self) -> String {
        let mut hashes = 0;
        while self.peek(0) == Some('#') {
            hashes += 1;
            self.bump();
        }
        self.bump();
        let mut text = String::new();
        loop {
            match self.bump() {
                Some('"') if (0..hashes).all(|i| self.peek(i) == Some('#')) => {
                    for _ in 0..hashes {
                        self.bump();
                    }
                    return text;
                }
                Some(c) => text.push(c),
                None => self.fail("unterminated raw string"),
            }
        }
    }

    /// `'x'`, `'\n'`, `'\u{…}'`, the opening quote not yet taken; the literal as written.
    fn char_literal(&mut self) -> String {
        let mut text = String::new();
        text.extend(self.bump());
        let first = self.bump();
        text.extend(first);
        if first == Some('\\') {
            // The escaped character, which may be a quote, then the rest of `\u{…}` or `\x…`.
            text.extend(self.bump());
            while let Some(c) = self.peek(0).filter(|c| *c != '\'') {
                text.push(c);
                self.bump();
            }
        }
        if self.bump() != Some('\'') {
            self.fail("unterminated character literal");
        }
        text.push('\'');
        text
    }

    /// A character literal, or a lifetime or label (`'a`), which is a name and no literal.
    fn quote_or_lifetime(&mut self) -> Token {
        if self.peek(1) == Some('\\') || self.peek(2) == Some('\'') {
            Token::Other(self.char_literal())
        } else {
            self.bump();
            Token::Ident {
                text: format!("'{}", self.ident()),
                raw: false,
            }
        }
    }
}

fn is_ident_start(c: char) -> bool {
    c.is_alphabetic() || c == '_'
}

/// The source as rustc reads it: without a byte order mark, and with a shebang line left out.
/// rustc takes a first line that starts with `#!` for a shebang unless, past whitespace and
/// plain comments, a `[` follows (an inner attribute such as `#![forbid(unsafe_code)]`).
/// Returns the lexer at the start of the code.
fn lexer(source: &str) -> Lexer<'_> {
    let source = source.strip_prefix('\u{FEFF}').unwrap_or(source);
    let mut lexer = Lexer::new(source);
    if let Some(after) = source.strip_prefix("#!") {
        let opens_attribute = Lexer::new(after)
            .next_token()
            .is_some_and(|lexed| lexed.token == Token::Punct('['));
        if !opens_attribute {
            while lexer.peek(0).is_some_and(|c| c != '\n') {
                lexer.bump();
            }
        }
    }
    lexer
}

fn lex(source: &str) -> Vec<Lexed> {
    let mut lexer = lexer(source);
    let mut out = Vec::new();
    while let Some(lexed) = lexer.next_token() {
        out.push(lexed);
    }
    out
}

/// Whether the code opens with `---`, past whitespace only: a frontmatter, which rustc skips.
fn opens_with_frontmatter(source: &str) -> bool {
    let lexer = lexer(source);
    let code: String = lexer.chars[lexer.position..].iter().collect();
    code.trim_start_matches(is_whitespace).starts_with("---")
}

/// The words of a text, each with the text after it.
fn words(text: &str) -> impl Iterator<Item = (&str, &str)> {
    let is_word = |c: char| c.is_alphanumeric() || c == '_';
    text.char_indices()
        .filter(move |(at, c)| is_word(*c) && !text[..*at].ends_with(is_word))
        .map(move |(at, _)| {
            let end = text[at..]
                .find(|c| !is_word(c))
                .map_or(text.len(), |n| at + n);
            (&text[at..end], &text[end..])
        })
}

/// The content of a string literal with its escapes resolved, as rustc reads it.
fn unescape(text: &str) -> String {
    let mut out = String::new();
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('n') => out.push('\n'),
            Some('r') => out.push('\r'),
            Some('t') => out.push('\t'),
            Some('0') => out.push('\0'),
            Some('x') => {
                let hex: String = chars.by_ref().take(2).collect();
                out.extend(u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32));
            }
            Some('u') => {
                let hex: String = chars
                    .by_ref()
                    .skip_while(|c| *c == '{')
                    .take_while(|c| *c != '}')
                    .filter(|c| *c != '_')
                    .collect();
                out.extend(u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32));
            }
            // A line continuation: the line break and the whitespace after it are dropped.
            Some('\n') => {
                while chars
                    .next_if(|c| matches!(c, ' ' | '\t' | '\n' | '\r'))
                    .is_some()
                {}
            }
            Some(other) => out.push(other),
            None => {}
        }
    }
    out
}

fn token_text(token: &Token) -> String {
    match token {
        Token::Ident { text, .. } => text.clone(),
        Token::Punct(c) => c.to_string(),
        _ => "<literal>".to_string(),
    }
}

/// An identifier's name, raw or not.
fn name(lexed: Option<&Lexed>) -> Option<&str> {
    match lexed.map(|lexed| &lexed.token) {
        Some(Token::Ident { text, .. }) => Some(text),
        _ => None,
    }
}

fn is_punct(lexed: Option<&Lexed>, c: char) -> bool {
    lexed.is_some_and(|lexed| lexed.token == Token::Punct(c))
}

/// The index of the bracket that closes the one at `open`, or the end.
fn closing(tokens: &[Lexed], open: usize) -> usize {
    let mut depth = 0usize;
    for (index, lexed) in tokens.iter().enumerate().skip(open) {
        match lexed.token {
            Token::Punct('(' | '[' | '{') => depth += 1,
            Token::Punct(')' | ']' | '}') => {
                depth -= 1;
                if depth == 0 {
                    return index;
                }
            }
            _ => {}
        }
    }
    tokens.len()
}

/// What one file may have.
#[derive(Clone, Copy, Default)]
struct Rules {
    /// The reviewed code the file must equal for its `unsafe` to be allowed: the allocator's.
    pinned: Option<&'static str>,
    /// How many copies of the `ioctl` statement.
    allowed_ioctl: usize,
    /// Whether its doc comments are compiled as doctests: a file of the library.
    doctests: bool,
}

/// A doc comment or `#[doc]` string of the library, which rustdoc compiles as doctests.
fn check_doc(text: &str, line: usize, what: &str, found: &mut Vec<String>) {
    for (word, after) in words(text) {
        if FORBIDDEN.contains(&word) {
            found.push(format!(
                "{line}: `{word}` in {what}, which rustdoc compiles as a doctest (write prose \
                 about it in a `//` comment)"
            ));
        } else if word == "include" {
            found.push(format!(
                "{line}: `include` in {what}: a doctest could bring in code this scan does not \
                 read"
            ));
        } else if word == "path" && after.trim_start().starts_with('=') {
            found.push(format!(
                "{line}: `path =` in {what}: a doctest could point a module at a file this \
                 scan does not read"
            ));
        }
    }
}

/// The inside of one attribute (`#[` and `]` taken off), or one attribute of a `cfg_attr`.
fn check_attribute(attribute: &[Lexed], line: usize, rules: Rules, found: &mut Vec<String>) {
    if is_punct(attribute.first(), '$') {
        found.push(format!(
            "{line}: an attribute a macro fills in (`#[$…]`), which can be `path` or `doc`"
        ));
        return;
    }
    // `#[unsafe(no_mangle)]`: the `unsafe` is reported as a token, what it wraps read here.
    if name(attribute.first()) == Some("unsafe") && is_punct(attribute.get(1), '(') {
        let close = closing(attribute, 1);
        check_attribute(&attribute[2..close], line, rules, found);
        return;
    }
    let mut at = 0;
    let mut path = Vec::new();
    loop {
        if is_punct(attribute.get(at), ':') && is_punct(attribute.get(at + 1), ':') {
            at += 2;
        }
        match name(attribute.get(at)) {
            Some(segment) => {
                path.push(segment);
                at += 1;
            }
            None => break,
        }
        if !(is_punct(attribute.get(at), ':') && is_punct(attribute.get(at + 1), ':')) {
            break;
        }
    }
    let rest = &attribute[at..];
    match path.as_slice() {
        ["path"] => found.push(format!(
            "{line}: a `path` attribute can point a module at a file this scan does not read"
        )),
        ["link"] => found.push(format!(
            "{line}: a `link` attribute links a native library, code this scan does not read"
        )),
        ["doc"] if is_punct(rest.first(), '=') => match &rest[1..] {
            [Lexed {
                token: Token::Str { text, raw },
                line,
            }] => {
                if rules.doctests {
                    let text = if *raw { text.clone() } else { unescape(text) };
                    check_doc(&text, *line, "a #[doc] string", found);
                }
            }
            _ => found.push(format!(
                "{line}: a `#[doc = …]` whose value is not a string literal: this scan cannot \
                 read what it adds, and rustdoc compiles it as a doctest"
            )),
        },
        ["cfg_attr"] if is_punct(rest.first(), '(') => {
            // `cfg_attr(predicate, attribute, …)`: every attribute after the predicate.
            let inside = &rest[1..closing(rest, 0)];
            let mut elements = Vec::new();
            let (mut start, mut depth) = (0, 0usize);
            for (index, lexed) in inside.iter().enumerate() {
                match lexed.token {
                    Token::Punct('(' | '[' | '{') => depth += 1,
                    Token::Punct(')' | ']' | '}') => depth = depth.saturating_sub(1),
                    Token::Punct(',') if depth == 0 => {
                        elements.push(&inside[start..index]);
                        start = index + 1;
                    }
                    _ => {}
                }
            }
            elements.push(&inside[start..]);
            for element in elements.into_iter().skip(1) {
                if !element.is_empty() {
                    check_attribute(element, line, rules, found);
                }
            }
        }
        ["cfg_attr"] => found.push(format!("{line}: a `cfg_attr` this scan cannot read")),
        _ => {}
    }
}

/// The tokens that are code: without doc comments, which are checked on their own.
fn code(tokens: &[Lexed]) -> Vec<(usize, &Token)> {
    tokens
        .iter()
        .filter(|lexed| !matches!(lexed.token, Token::Doc(_)))
        .map(|lexed| (lexed.line, &lexed.token))
        .collect()
}

/// The line of the first token where a file's code and the pinned code differ.
fn first_difference(file: &[Lexed], pinned: &[Lexed]) -> Option<usize> {
    let (file, pinned) = (code(file), code(pinned));
    let differs = file
        .iter()
        .zip(&pinned)
        .find(|((_, a), (_, b))| a != b)
        .map(|((line, _), _)| *line);
    match differs {
        Some(line) => Some(line),
        None if file.len() == pinned.len() => None,
        None if file.len() > pinned.len() => Some(file[pinned.len()].0),
        None => Some(file.last().map_or(1, |(line, _)| *line)),
    }
}

/// Every finding in one file's source, as `line: what`.
fn findings(source: &str, rules: Rules) -> Vec<String> {
    let tokens = lex(source);
    let mut found = Vec::new();
    if opens_with_frontmatter(source) {
        found.push(
            "1: opens with `---`, a frontmatter, whose text rustc skips where it accepts one"
                .to_string(),
        );
    }
    let pinned = match rules.pinned {
        Some(pinned) => match first_difference(&tokens, &lex(pinned)) {
            None => true,
            Some(line) => {
                found.push(format!(
                    "{line}: differs from the reviewed copy in tests/no_unsafe.rs \
                     (ALLOCATOR_CODE), so none of its `unsafe` is allowed"
                ));
                false
            }
        },
        None => false,
    };
    let mut ioctls = 0;
    for (index, lexed) in tokens.iter().enumerate() {
        match &lexed.token {
            Token::Doc(doc) if rules.doctests => {
                check_doc(doc, lexed.line, "a doc comment", &mut found);
            }
            Token::Ident { text, raw } => {
                let forbidden = FORBIDDEN.contains(&text.as_str()) && !(*raw && text == "unsafe");
                if forbidden && !pinned {
                    let statement: Vec<String> = tokens[index..]
                        .iter()
                        .take(IOCTL.len())
                        .map(|lexed| token_text(&lexed.token))
                        .collect();
                    if !raw && statement == IOCTL && ioctls < rules.allowed_ioctl {
                        ioctls += 1;
                    } else {
                        found.push(format!("{}: `{text}`", lexed.line));
                    }
                }
                if text == "include" {
                    found.push(format!(
                        "{}: `include` names the macro that brings in code this scan does not \
                         read, also behind an alias",
                        lexed.line
                    ));
                }
            }
            Token::Punct('#') => {
                let mut open = index + 1;
                if is_punct(tokens.get(open), '!') {
                    open += 1;
                }
                if is_punct(tokens.get(open), '[') {
                    let close = closing(&tokens, open);
                    check_attribute(&tokens[open + 1..close], lexed.line, rules, &mut found);
                }
            }
            _ => {}
        }
    }
    found
}

fn root() -> &'static Path {
    Path::new(env!("CARGO_MANIFEST_DIR"))
}

/// Every `.rs` file of the package at `root` outside `target/`.
fn scanned_files(root: &Path) -> Vec<PathBuf> {
    fn walk(dir: &Path, out: &mut Vec<PathBuf>) {
        for entry in std::fs::read_dir(dir).unwrap() {
            let path = entry.unwrap().path();
            if path.is_dir() {
                walk(&path, out);
            } else if path.extension().is_some_and(|extension| extension == "rs") {
                out.push(path);
            }
        }
    }
    let mut files = Vec::new();
    for entry in std::fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() && path.file_name().is_some_and(|name| name != "target") {
            walk(&path, &mut files);
        } else if path.extension().is_some_and(|extension| extension == "rs") {
            files.push(path);
        }
    }
    files.sort();
    files
}

fn relative(path: &Path) -> String {
    path.strip_prefix(root())
        .unwrap()
        .to_string_lossy()
        .replace('\\', "/")
}

#[test]
fn no_unsafe_code_outside_the_allocator_and_the_one_ioctl() {
    let files = scanned_files(root());
    for expected in [
        ALLOCATOR,
        IOCTL_FILE,
        "src/main.rs",
        "src/lib.rs",
        "tests/no_unsafe.rs",
    ] {
        assert!(
            files.iter().any(|path| relative(path) == expected),
            "{expected} was not scanned"
        );
    }
    let mut report = Vec::new();
    for path in &files {
        let name = relative(path);
        let source = std::fs::read_to_string(path).unwrap();
        let rules = Rules {
            pinned: (name == ALLOCATOR).then_some(ALLOCATOR_CODE),
            allowed_ioctl: usize::from(name == IOCTL_FILE),
            doctests: name.starts_with("src/")
                && name != "src/main.rs"
                && !name.starts_with("src/bin/"),
        };
        for finding in findings(&source, rules) {
            report.push(format!("{name}:{finding}"));
        }
        // The ioctl is seen as code, so the reader did not swallow it (or the rest of its file)
        // as a comment or literal. The allocator's code is compared as a whole.
        if name == IOCTL_FILE {
            let keywords = lex(&source)
                .iter()
                .filter(|lexed| {
                    matches!(&lexed.token, Token::Ident { text, raw: false } if text == "unsafe")
                })
                .count();
            assert_eq!(keywords, 1, "{name}: the ioctl statement");
        }
    }
    assert!(
        report.is_empty(),
        "unsafe code outside {ALLOCATOR} and the ioctl of {IOCTL_FILE}, or code this scan \
         cannot read:\n{}",
        report.join("\n")
    );
}

/// What the build of the package at `root` reads besides its scanned files and crates.io, and
/// how many packages `cargo metadata` listed: a target built from another file, a build script
/// (it could compile and link anything), a dependency from a path or git, and Cargo
/// configuration in the package other than [`CARGO_CONFIG`].
fn build_findings(root: &Path, locked: bool) -> (Vec<String>, usize) {
    let files: Vec<PathBuf> = scanned_files(root)
        .iter()
        .map(|path| path.canonicalize().unwrap())
        .collect();
    let manifest = root.join("Cargo.toml").canonicalize().unwrap();
    let mut command = std::process::Command::new(env!("CARGO"));
    // In the package, as its build runs, so Cargo reads the same configuration.
    command
        .current_dir(root)
        .args(["metadata", "--format-version", "1", "--all-features"]);
    if locked {
        command.arg("--locked");
    }
    let output = command
        .arg("--manifest-path")
        .arg(&manifest)
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "cargo metadata: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    let metadata: serde_json::Value = serde_json::from_slice(&output.stdout).unwrap();
    let packages = metadata["packages"].as_array().unwrap();
    let mut found = Vec::new();
    let mut ours = 0;
    for package in packages {
        let manifest_path = Path::new(package["manifest_path"].as_str().unwrap());
        if manifest_path.canonicalize().ok().as_ref() != Some(&manifest) {
            if package["source"].as_str() != Some(CRATES_IO) {
                found.push(format!(
                    "dependency {} {} comes from {}, not crates.io",
                    package["name"],
                    package["version"],
                    package["source"].as_str().unwrap_or("a path")
                ));
            }
            continue;
        }
        ours += 1;
        for target in package["targets"].as_array().unwrap() {
            let source = target["src_path"].as_str().unwrap();
            let kinds = target["kind"].as_array().unwrap();
            if kinds.iter().any(|kind| kind == "custom-build") {
                found.push(format!("a build script: {source}"));
            } else if !Path::new(source)
                .canonicalize()
                .is_ok_and(|source| files.contains(&source))
            {
                found.push(format!(
                    "target {} is built from {source}, which the scan does not read",
                    target["name"]
                ));
            }
        }
    }
    assert_eq!(ours, 1, "the package itself in cargo metadata");

    let config = root.join(".cargo");
    if config.exists() {
        let mut entries: Vec<String> = std::fs::read_dir(&config)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect();
        entries.sort();
        if entries != ["config.toml"] {
            found.push(format!(".cargo/ holds {entries:?}, not only config.toml"));
        } else {
            let text = std::fs::read_to_string(config.join("config.toml")).unwrap();
            let lines: Vec<&str> = text
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty() && !line.starts_with('#'))
                .collect();
            if lines != CARGO_CONFIG {
                found.push(format!(
                    ".cargo/config.toml sets {lines:?}, not only {CARGO_CONFIG:?}"
                ));
            }
        }
    }
    (found, packages.len())
}

/// The build reads nothing but the scanned files and crates.io.
#[test]
fn the_build_reads_only_the_scanned_files_and_crates_io() {
    let (found, packages) = build_findings(root(), true);
    assert!(
        found.is_empty(),
        "the build reads more than the scanned files and crates.io:\n{}",
        found.join("\n")
    );
    assert!(
        packages > 100,
        "cargo metadata listed only {packages} packages"
    );
}

/// The build check itself, on packages of its own: each of what it looks for is found.
#[test]
fn the_build_check_finds_what_else_a_build_reads() {
    let fixture = |extra: &str| {
        let dir = tempfile::tempdir().unwrap();
        let package = dir.path().join("fixture");
        std::fs::create_dir_all(package.join("src")).unwrap();
        std::fs::write(package.join("src/lib.rs"), "pub fn f() {}\n").unwrap();
        // `[workspace]`: no Cargo.toml above the temporary directory takes it for a member.
        std::fs::write(
            package.join("Cargo.toml"),
            format!(
                "[package]\nname = \"fixture\"\nversion = \"0.1.0\"\nedition = \"2021\"\n\n\
                 [workspace]\n{extra}"
            ),
        )
        .unwrap();
        (dir, package)
    };
    let found = |package: &Path| build_findings(package, false).0;

    let (_dir, plain) = fixture("");
    assert_eq!(found(&plain), Vec::<String>::new());

    let (_dir, build_script) = fixture("");
    std::fs::write(build_script.join("build.rs"), "fn main() {}\n").unwrap();
    let findings = found(&build_script);
    assert_eq!(findings.len(), 1, "{findings:?}");
    assert!(findings[0].starts_with("a build script: "), "{findings:?}");

    let (_dir, text_root) = fixture("\n[[bin]]\nname = \"evil\"\npath = \"src/evil.txt\"\n");
    std::fs::write(text_root.join("src/evil.txt"), "fn main() {}\n").unwrap();
    let findings = found(&text_root);
    assert_eq!(findings.len(), 1, "{findings:?}");
    assert!(
        findings[0].starts_with("target \"evil\" is built from "),
        "{findings:?}"
    );

    let (dir, path_dependency) = fixture("\n[dependencies]\nother = { path = \"../other\" }\n");
    let other = dir.path().join("other");
    std::fs::create_dir_all(other.join("src")).unwrap();
    std::fs::write(other.join("src/lib.rs"), "").unwrap();
    std::fs::write(
        other.join("Cargo.toml"),
        "[package]\nname = \"other\"\nversion = \"0.1.0\"\nedition = \"2021\"\n",
    )
    .unwrap();
    assert_eq!(
        found(&path_dependency),
        ["dependency \"other\" \"0.1.0\" comes from a path, not crates.io"]
    );

    let (_dir, configured) = fixture("");
    std::fs::create_dir(configured.join(".cargo")).unwrap();
    let config = |text: &str| {
        std::fs::write(configured.join(".cargo/config.toml"), text).unwrap();
        found(&configured)
    };
    let known = format!("# A comment.\n\n{}\n", CARGO_CONFIG.join("\n"));
    assert_eq!(config(&known), Vec::<String>::new());
    let findings = config(&format!(
        "{known}\n[build]\nrustflags = [\"-C\", \"link-arg=x.o\"]\n"
    ));
    assert_eq!(findings.len(), 1, "{findings:?}");
    assert!(
        findings[0].starts_with(".cargo/config.toml sets "),
        "{findings:?}"
    );
    std::fs::write(configured.join(".cargo/config"), "").unwrap();
    let findings = found(&configured);
    assert_eq!(findings.len(), 1, "{findings:?}");
    assert!(findings[0].starts_with(".cargo/ holds "), "{findings:?}");
}

/// The scan itself: what is code and what is not.
#[test]
fn the_scan_tells_code_from_comments_and_literals() {
    let library = Rules {
        doctests: true,
        ..Rules::default()
    };
    let hits = |source: &str| findings(source, library).len();
    // Not code.
    assert_eq!(hits("// unsafe { x }\nfn f() {}"), 0);
    assert_eq!(hits("/* unsafe /* nested */ unsafe */ fn f() {}"), 0);
    assert_eq!(hits(r#"const S: &str = "unsafe { \" unsafe";"#), 0);
    assert_eq!(hits(r###"const S: &str = r##"unsafe "# unsafe"##;"###), 0);
    assert_eq!(
        hits(r#"const B: &[u8] = b"unsafe"; const C: &core::ffi::CStr = c"unsafe";"#),
        0
    );
    assert_eq!(hits(r#"const Q: char = '"'; const S: &str = "unsafe";"#), 0);
    assert_eq!(
        hits(r"const Q: u8 = b'\''; const S: &str = 'x'.to_string(); // unsafe"),
        0
    );
    assert_eq!(hits(r"const E: char = '\u{1F308}'; /* unsafe */"), 0);
    assert_eq!(hits("#![forbid(unsafe_code)] fn r#unsafe() {}"), 0);
    assert_eq!(
        hits("//// unsafe, four slashes: no doc comment\n/**/ /*** unsafe */"),
        0
    );
    // Code.
    assert_eq!(hits("fn f() { unsafe { g() } }"), 1);
    assert_eq!(
        hits("unsafe fn f() {} unsafe impl Send for X {} unsafe trait T {}"),
        3
    );
    assert_eq!(hits(r#"const Q: char = '"'; fn f() { unsafe {} }"#), 1);
    assert_eq!(hits("fn f<'a>(x: &'a u8) -> u8 { unsafe { *x } }"), 1);
    assert_eq!(
        hits("#[macro_export] macro_rules! trust_me { ($e:expr) => { unsafe { $e } }; }"),
        1
    );
    assert_eq!(hits("#[no_mangle] pub extern \"C\" fn f() {}"), 1);
    assert_eq!(hits("#[r#no_mangle] pub extern \"C\" fn f() {}"), 1);
    assert_eq!(hits("#[unsafe(export_name = \"f\")] fn f() {}"), 2);
    assert_eq!(hits("core::arch::global_asm!(\"nop\");"), 1);
    // A shebang line is left out as rustc leaves it out, in any file; an inner attribute is not
    // one, also when a direction mark (whitespace to rustc) stands before its `[`.
    assert_eq!(hits("#!/x /*\nunsafe fn f() {}\n// */"), 1);
    assert_eq!(hits("\u{FEFF}#!/x /*\nunsafe fn f() {}\n// */"), 1);
    assert_eq!(hits("#!/usr/bin/env x unsafe\nfn f() {}"), 0);
    assert_eq!(hits("#! /* c */ [allow(dead_code)] unsafe fn f() {}"), 1);
    assert_eq!(hits("#!\u{200E}[allow(dead_code)] unsafe fn f() {}"), 1);
    // A frontmatter, also after a shebang; a later `---` is code.
    assert_eq!(hits("---\n/*\n---\nfn f() {}\n// */"), 1);
    assert_eq!(hits("#!/x\n---\n---\nfn f() {}"), 1);
    assert_eq!(hits("fn f() -> i8 { ---1 }"), 0);
    // Code from files this scan does not read.
    assert_eq!(hits("include!(\"other.rs\");"), 1);
    assert_eq!(hits("use core::include as inc; inc!(\"other.txt\");"), 1);
    assert_eq!(hits("fn f() { r#include!(\"other.txt\") }"), 1);
    assert_eq!(hits("const S: &str = include_str!(\"unsafe.txt\");"), 0);
    assert_eq!(hits("#[path = \"../x.rs\"] mod x;"), 1);
    assert_eq!(hits("#[r#path = \"x.txt\"] mod x;"), 1);
    assert_eq!(hits("#[cfg_attr(all(), path = \"x.txt\")] mod x;"), 1);
    assert_eq!(
        hits("#[cfg_attr(unix, cfg_attr(all(), allow(dead_code), path = \"x.txt\"))] mod x;"),
        1
    );
    assert_eq!(hits("#![cfg_attr(all(), path = \"x.txt\")] fn f() {}"), 1);
    assert_eq!(
        hits("macro_rules! m { ($a:meta) => { #[$a] mod y; }; } m!(path = \"x.txt\");"),
        1
    );
    assert_eq!(
        hits("#[utoipa::path(post, path = \"/api/x\")] #[serde(rename = \"path\")] fn f() {}"),
        0
    );
    assert_eq!(
        hits("#[link(name = \"evil\", kind = \"static\")] extern \"C\" {}"),
        1
    );
    assert_eq!(
        hits("#[cfg_attr(unix, link(name = \"evil\"))] extern \"C\" {}"),
        1
    );
    assert_eq!(
        hits("#[link_name = \"f\"] fn f() {} #[x::link] fn g() {}"),
        0
    );
    // Doc comments and `#[doc]` strings: doctests in the library, prose elsewhere.
    let docs = "/// ```\n/// unsafe { f() }\n/// ```\n//! unsafe\n/** unsafe */ /*! unsafe */\n\
                #[doc = \"unsafe { f() }\"] fn g() {}";
    assert_eq!(hits(docs), 5);
    assert_eq!(findings(docs, Rules::default()).len(), 0);
    assert_eq!(hits("#[doc = \"uns\\x61fe { f() }\"] fn g() {}"), 1);
    assert_eq!(hits("#[doc = \"uns\\u{61}fe { f() }\"] fn g() {}"), 1);
    assert_eq!(hits("#[doc = \"uns\\\n      afe { f() }\"] fn g() {}"), 1);
    assert_eq!(hits("#[doc = r\"uns\\x61fe\"] fn g() {}"), 0);
    assert_eq!(hits("#[doc(hidden)] #[doc = \"Plain.\"] fn g() {}"), 0);
    assert_eq!(
        hits("/// ```\n/// include!(\"/abs/x.txt\");\n/// ```\nfn g() {}"),
        1
    );
    assert_eq!(
        hits("/// ```\n/// #[path = \"x.txt\"] mod x;\n/// ```\nfn g() {}"),
        1
    );
    assert_eq!(
        hits("/// The path of the dump, and `include_deleted`.\nfn g() {}"),
        0
    );
    for not_a_literal in [
        "#[doc = include_str!(\"x.md\")] fn g() {}",
        "#[doc = concat!(\"a\", \"b\")] fn g() {}",
        "#[cfg_attr(all(), doc = include_str!(\"x.md\"))] fn g() {}",
        "macro_rules! m { ($d:expr) => { #[doc = $d] fn g() {} }; }",
    ] {
        assert_eq!(hits(not_a_literal), 1, "{not_a_literal}");
        assert_eq!(
            findings(not_a_literal, Rules::default()).len(),
            1,
            "{not_a_literal}"
        );
    }
    // The ioctl statement: allowed once where allowed, exactly as written.
    let ioctl = "let r = unsafe { libc::ioctl(socket, libc::TIOCOUTQ, &mut unread) };";
    let once = Rules {
        allowed_ioctl: 1,
        ..Rules::default()
    };
    assert_eq!(findings(ioctl, once).len(), 0);
    assert_eq!(findings(&format!("{ioctl}\n{ioctl}"), once).len(), 1);
    assert_eq!(findings(ioctl, Rules::default()).len(), 1);
    let other = "let r = unsafe { libc::ioctl(socket, libc::FIONREAD, &mut unread) };";
    assert_eq!(findings(other, once).len(), 1);
    // The allocator: its `unsafe` allowed while its code is the reviewed copy, comments aside;
    // a doc comment of it is still read as a doctest.
    let allocator = Rules {
        pinned: Some(ALLOCATOR_CODE),
        doctests: true,
        ..Rules::default()
    };
    assert_eq!(findings(ALLOCATOR_CODE, allocator).len(), 0);
    let commented = ALLOCATOR_CODE.replace(
        "pub struct CappedAllocator;",
        "/// Refuses large allocations.\n// Global.\npub struct CappedAllocator;",
    );
    assert_eq!(findings(&commented, allocator).len(), 0);
    assert_eq!(
        findings(&format!("/// unsafe\n{ALLOCATOR_CODE}"), allocator).len(),
        1
    );
    // Changed: the difference, then each of its 9 `unsafe`, and any other.
    let appended = format!(
        "{ALLOCATOR_CODE}\n#[macro_export]\nmacro_rules! trust_alloc {{ ($e:expr) => {{ \
         unsafe {{ $e }} }}; }}"
    );
    let found = findings(&appended, allocator);
    assert_eq!(found.len(), 1 + 9 + 1, "{found:?}");
    assert!(found[0].starts_with("39: differs"), "{found:?}");
    let changed = ALLOCATOR_CODE.replace("size > MAX_ALLOCATION_BYTES", "size > 0");
    let found = findings(&changed, allocator);
    assert_eq!(found.len(), 1 + 9, "{found:?}");
    assert!(found[0].starts_with("7: differs"), "{found:?}");
    let body = ALLOCATOR_CODE.replace(
        "unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {",
        "unsafe fn dealloc(&self, pointer: *mut u8, layout: Layout) {\n*pointer = 0;",
    );
    assert_eq!(findings(&body, allocator).len(), 1 + 9);
    let shorter = ALLOCATOR_CODE.replace("pub struct CappedAllocator;", "");
    assert!(findings(&shorter, allocator)[0].contains("differs"));
}
