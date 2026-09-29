use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Deserialize)]
pub struct Credentials {
    pub username: String,
    pub password: String,
}

#[derive(Serialize, Clone)]
pub struct UserOut {
    pub id: i64,
    pub username: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserOut,
}

#[derive(sqlx::FromRow)]
pub struct UserRow {
    pub id: i64,
    pub username: String,
    pub password_hash: String,
}

#[derive(Deserialize)]
pub struct NoteInput {
    pub title: String,
    pub content: String,
}

#[derive(Serialize, sqlx::FromRow)]
pub struct Note {
    pub id: i64,
    pub title: String,
    pub content: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Deserialize)]
pub struct NoteQuery {
    pub q: Option<String>,
}
