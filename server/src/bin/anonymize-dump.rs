//! `anonymize-dump <input> <output> [--database <name>]…`: copies a mongodump directory
//! with every personal value replaced by generated mock data (`migrate::anonymize`). Prints
//! counts only. Without `--database` the two known databases are taken.

#![forbid(unsafe_code)]

use backend::migrate::anonymize::{anonymize_dump, DATABASES};
use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str = "usage: anonymize-dump <input dir> <output dir> [--database <name>]…";

fn parse_args() -> Result<(PathBuf, PathBuf, Vec<String>), &'static str> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut positional = Vec::new();
    let mut databases = Vec::new();
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--database" {
            i += 1;
            databases.push(args.get(i).ok_or(USAGE)?.clone());
        } else {
            positional.push(PathBuf::from(&args[i]));
        }
        i += 1;
    }
    if positional.len() != 2 {
        return Err(USAGE);
    }
    if databases.is_empty() {
        databases = DATABASES.iter().map(|d| d.to_string()).collect();
    }
    let output = positional.pop().ok_or(USAGE)?;
    let input = positional.pop().ok_or(USAGE)?;
    Ok((input, output, databases))
}

fn main() -> ExitCode {
    std::panic::set_hook(Box::new(|info| {
        let location = info
            .location()
            .map_or_else(|| "unknown location".to_string(), |l| l.to_string());
        eprintln!("anonymize-dump: panicked at {location}");
    }));
    let (input, output, databases) = match parse_args() {
        Ok(parsed) => parsed,
        Err(usage) => {
            eprintln!("{usage}");
            return ExitCode::from(2);
        }
    };
    match anonymize_dump(&input, &output, &databases) {
        Ok(report) => {
            print!("{}", report.render());
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("{e}");
            ExitCode::from(1)
        }
    }
}
