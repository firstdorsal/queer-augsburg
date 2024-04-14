#[macro_export]
macro_rules! some_or_bail {
    ( $option:expr, $message:expr ) => {{
        if let Some(val) = $option {
            val
        } else {
            anyhow::bail!($message)
        }
    }};
}

#[macro_export]
macro_rules! has_authorized_user_capability_or_error {
    ($res:expr,$db:expr, $auth:expr, $capability:expr ) => {{
        let user_id = match &$auth.authenticated_user {
            Some(user_id) => user_id,
            None => return Ok($res.status(401).body(Body::from("Unauthorized"))?),
        };

        let user = match $db.get_user(user_id).await? {
            Some(user) => user,
            None => return Ok($res.status(404).body(Body::from("User not found"))?),
        };

        match user.capabilities {
            Some(capabilities) => {
                if !capabilities.contains(&$capability) {
                    return Ok($res.status(403).body(Body::from("Not authorized"))?);
                }
            }
            None => {
                return Ok($res.status(403).body(Body::from("Not authorized"))?);
            }
        }
    }};
}
