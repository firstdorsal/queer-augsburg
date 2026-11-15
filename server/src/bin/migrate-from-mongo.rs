//! `migrate-from-mongo migrate|verify --config <file>`: the MongoDB → Postgres migration
//! of research-postgres §4, from a mongodump directory into the database of `DATABASE_URL`.
//! Prints the report (counts, rule names, digests; never a value) and exits 0 only on the
//! line `MIGRATION VERIFIED …`.

#![forbid(unsafe_code)]

use backend::migrate::config::Config;
use backend::migrate::{run, Mode};
use std::path::PathBuf;
use std::process::ExitCode;

const USAGE: &str =
    "usage: migrate-from-mongo <migrate|verify> --config <file>   (DATABASE_URL set)";

fn parse_args() -> Result<(Mode, PathBuf), &'static str> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let mut mode = None;
    let mut config = None;
    let mut i = 0;
    while i < args.len() {
        match args[i].as_str() {
            "migrate" => mode = Some(Mode::Migrate),
            "verify" => mode = Some(Mode::Verify),
            "--config" => {
                i += 1;
                config = args.get(i).map(PathBuf::from);
            }
            _ => return Err(USAGE),
        }
        i += 1;
    }
    match (mode, config) {
        (Some(mode), Some(config)) => Ok((mode, config)),
        _ => Err(USAGE),
    }
}

fn main() -> ExitCode {
    // A panic message can quote data; only where it happened is printed.
    std::panic::set_hook(Box::new(|info| {
        let location = info
            .location()
            .map_or_else(|| "unknown location".to_string(), |l| l.to_string());
        eprintln!("migrate-from-mongo: panicked at {location}");
    }));

    let (mode, config_path) = match parse_args() {
        Ok(parsed) => parsed,
        Err(usage) => {
            eprintln!("{usage}");
            return ExitCode::from(2);
        }
    };
    let Ok(database_url) = std::env::var("DATABASE_URL") else {
        eprintln!("DATABASE_URL is not set");
        return ExitCode::from(2);
    };
    let config = match Config::load(&config_path) {
        Ok(config) => config,
        Err(e) => {
            eprintln!("{e}");
            println!("MIGRATION FAILED");
            return ExitCode::from(1);
        }
    };

    let runtime = match tokio::runtime::Builder::new_multi_thread()
        .enable_all()
        .build()
    {
        Ok(runtime) => runtime,
        Err(_) => {
            eprintln!("cannot start the runtime");
            return ExitCode::from(1);
        }
    };
    match runtime.block_on(run(&config, &database_url, mode)) {
        Ok(report) => {
            print!("{}", report.render());
            if report.verified {
                ExitCode::SUCCESS
            } else {
                ExitCode::from(1)
            }
        }
        Err(failure) => {
            eprintln!("{failure}");
            println!("MIGRATION FAILED");
            ExitCode::from(1)
        }
    }
}
