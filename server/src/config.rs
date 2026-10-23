use anyhow::bail;
use lazy_static::lazy_static;
use serde::{Deserialize, Serialize};
use std::fs::read_to_string;
use url::Url;

const CONFIG_PATH: &str = "/config.yml";
const DEV_CONFIG_PATH: &str = "dev/config.yml";

lazy_static! {
    pub static ref SERVER_CONFIG: ServerConfig = read_config().unwrap();
}

pub fn read_config() -> anyhow::Result<ServerConfig> {
    let config_file = match read_to_string(CONFIG_PATH) {
        Ok(file) => file,
        Err(_) => match {
            println!("Config file not found trying dev path");
            read_to_string(DEV_CONFIG_PATH)
        } {
            Ok(file) => file,
            Err(_) => bail!("Config file not found"),
        },
    };

    let config_file = replace_variables(config_file)?;
    let config: ServerConfig = serde_yaml::from_str(&config_file)?;
    check_ui_origin(&config.ui_origin)?;
    Ok(config)
}

/// Links to meeting pages are built from `uiOrigin` and published (meetings overview, iCal
/// feed), so a typo must stop the server instead of producing wrong links.
fn check_ui_origin(ui_origin: &Url) -> anyhow::Result<()> {
    if !matches!(ui_origin.scheme(), "https" | "http")
        || ui_origin.host_str().is_none()
        || ui_origin.path() != "/"
        || ui_origin.query().is_some()
        || ui_origin.fragment().is_some()
    {
        bail!(
            "uiOrigin must be the website's origin like https://queer-augsburg.de, not {ui_origin}"
        );
    }
    Ok(())
}

pub fn replace_variables(mut config_file: String) -> anyhow::Result<String> {
    let first_config: ConfigVariablePrefix = serde_yaml::from_str(&config_file)?;
    for (key, value) in std::env::vars() {
        config_file = config_file.replace(
            format!("{}{}", first_config.variable_prefix, key).as_str(),
            &value,
        );
    }

    Ok(config_file)
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ConfigVariablePrefix {
    pub variable_prefix: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ServerConfig {
    pub db: DbConfig,
    pub http: HttpConfig,
    pub dev: DevConfig,
    /// The website's origin, e.g. https://queer-augsburg.de.
    pub ui_origin: Url,
    pub service_id: String,
    pub interossea: InterosseaConfig,
    pub services: Vec<Service>,
    pub mail: MailConfig,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub allowed_origins: Vec<String>,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DbConfig {
    pub url: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevConfig {
    pub insecure_skip_interossea: bool,
    pub import_old_meetings: bool,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HttpConfig {
    pub internal_address: String,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InterosseaConfig {
    pub url: String,
    pub assertion_validity_seconds: u64,
}

#[derive(Deserialize, Debug, Serialize, Eq, PartialEq, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MailConfig {
    pub username: String,
    pub password: String,
    pub smtp_server: String,
    pub from_name: String,
    pub from_address: String,
    pub user_agent: String,
    pub reply_to: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ui_origin_must_be_an_origin() {
        for origin in [
            "https://queer-augsburg.de",
            "https://queer-augsburg.de/",
            "http://localhost:20352",
        ] {
            assert!(
                check_ui_origin(&Url::parse(origin).unwrap()).is_ok(),
                "{origin}"
            );
        }
        for origin in [
            "https://queer-augsburg.de/web",
            "https://queer-augsburg.de/?m=1",
            "ftp://queer-augsburg.de",
            "mailto:mail@queer-augsburg.de",
        ] {
            assert!(
                check_ui_origin(&Url::parse(origin).unwrap()).is_err(),
                "{origin}"
            );
        }
    }
}
