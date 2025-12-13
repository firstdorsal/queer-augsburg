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
macro_rules! require_capability {
    ($state:expr, $auth:expr, $capability:expr) => {{
        use axum::http::StatusCode;

        let user_id = match &$auth.authenticated_user {
            Some(user_id) => user_id,
            None => return (StatusCode::UNAUTHORIZED, "Unauthorized").into_response(),
        };

        let user = match $state.db.get_user(user_id).await {
            Ok(Some(user)) => user,
            Ok(None) => return (StatusCode::NOT_FOUND, "User not found").into_response(),
            Err(_) => {
                return (StatusCode::INTERNAL_SERVER_ERROR, "Database error").into_response()
            }
        };

        match user.capabilities {
            Some(capabilities) => {
                if !capabilities.contains(&$capability) {
                    return (StatusCode::FORBIDDEN, "Not authorized").into_response();
                }
            }
            None => {
                return (StatusCode::FORBIDDEN, "Not authorized").into_response();
            }
        }
    }};
}
