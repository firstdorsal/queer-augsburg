//! The destructor half of the test guards: `db_support::TestSchema` (a schema per test) and
//! `migrate_support::TestDb` (a database per test, with its roles). Every test crate that uses
//! one of them declares `mod drop_guard;` beside it.

#![allow(dead_code)]

use std::future::Future;

/// For a guard whose test panicked or returned before it removed what it made. A destructor
/// cannot await, and the test's runtime, whose thread this is, cannot run anything while it
/// waits, so `removal` runs on a thread and runtime of its own and this one waits for it.
///
/// `removal` says what it removed. If it fails, `subject` (what is left) and the error fail the
/// test: by a panic, or, while the test is already unwinding, printed, since a second panic
/// would abort the whole test binary.
pub fn remove_after_test<F, Fut>(subject: &str, removal: F)
where
    F: FnOnce() -> Fut + Send + 'static,
    Fut: Future<Output = Result<String, sqlx::Error>>,
{
    let removal = std::thread::spawn(move || {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(removal())
    })
    .join();
    let error = match removal {
        Ok(Ok(removed)) => {
            eprintln!("{removed}");
            return;
        }
        Ok(Err(error)) => error.to_string(),
        Err(_) => "the removal panicked".to_string(),
    };
    let message = format!("{subject} is left behind: {error}");
    if std::thread::panicking() {
        eprintln!("{message}");
    } else {
        panic!("{message}");
    }
}
