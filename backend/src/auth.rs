use crate::errors::ApiError;
use actix_web::{dev::Payload, web, FromRequest, HttpRequest};
use argon2::password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString};
use argon2::Argon2;
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::future::{ready, Ready};

const DEV_SECRET: &str = "dev-insecure-secret-change-me";

#[derive(Clone)]
pub struct JwtConfig {
    pub secret: String,
}

impl JwtConfig {
    pub fn from_env() -> Self {
        let secret = std::env::var("JWT_SECRET").unwrap_or_else(|_| {
            log::warn!("JWT_SECRET not set; using insecure dev default. Do NOT use in production.");
            DEV_SECRET.to_string()
        });
        JwtConfig { secret }
    }
}

#[derive(Serialize, Deserialize)]
struct Claims {
    sub: i64,
    exp: usize,
}

pub fn hash_password(password: &str) -> Result<String, ApiError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| ApiError::Internal(e.to_string()))
}

pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

pub fn create_token(cfg: &JwtConfig, user_id: i64) -> Result<String, ApiError> {
    let exp = (chrono::Utc::now() + chrono::Duration::days(7)).timestamp() as usize;
    encode(
        &Header::default(),
        &Claims { sub: user_id, exp },
        &EncodingKey::from_secret(cfg.secret.as_bytes()),
    )
    .map_err(|e| ApiError::Internal(e.to_string()))
}

/// Extractor: authenticated user id from `Authorization: Bearer <jwt>`.
pub struct AuthUser(pub i64);

impl FromRequest for AuthUser {
    type Error = ApiError;
    type Future = Ready<Result<Self, ApiError>>;

    fn from_request(req: &HttpRequest, _: &mut Payload) -> Self::Future {
        ready(extract(req))
    }
}

fn extract(req: &HttpRequest) -> Result<AuthUser, ApiError> {
    let unauth = || ApiError::Unauthorized("Invalid or missing token".into());
    let cfg = req.app_data::<web::Data<JwtConfig>>().ok_or_else(|| ApiError::Internal("missing JwtConfig".into()))?;
    let header = req.headers().get("Authorization").and_then(|v| v.to_str().ok()).ok_or_else(unauth)?;
    let token = header.strip_prefix("Bearer ").ok_or_else(unauth)?;
    let data = decode::<Claims>(token, &DecodingKey::from_secret(cfg.secret.as_bytes()), &Validation::default())
        .map_err(|_| unauth())?;
    Ok(AuthUser(data.claims.sub))
}
