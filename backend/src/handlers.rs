use crate::auth::{create_token, hash_password, verify_password, AuthUser, JwtConfig};
use crate::errors::ApiError;
use crate::models::*;
use actix_web::{web, HttpResponse};
use sqlx::SqlitePool;

pub fn configure(cfg: &mut web::ServiceConfig) {
    cfg.service(
        web::scope("/api")
            .route("/auth/register", web::post().to(register))
            .route("/auth/login", web::post().to(login))
            .route("/auth/me", web::get().to(me))
            .route("/notes", web::get().to(list_notes))
            .route("/notes", web::post().to(create_note))
            .route("/notes/{id}", web::get().to(get_note))
            .route("/notes/{id}", web::put().to(update_note))
            .route("/notes/{id}", web::delete().to(delete_note)),
    );
}

async fn register(
    pool: web::Data<SqlitePool>,
    jwt: web::Data<JwtConfig>,
    body: web::Json<Credentials>,
) -> Result<HttpResponse, ApiError> {
    let username = body.username.trim();
    if username.chars().count() < 3 {
        return Err(ApiError::BadRequest("Username must be at least 3 characters".into()));
    }
    if body.password.chars().count() < 8 {
        return Err(ApiError::BadRequest("Password must be at least 8 characters".into()));
    }
    let hash = hash_password(&body.password)?;
    let res = sqlx::query("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)")
        .bind(username)
        .bind(&hash)
        .bind(chrono::Utc::now())
        .execute(pool.get_ref())
        .await;
    let id = match res {
        Ok(r) => r.last_insert_rowid(),
        Err(sqlx::Error::Database(e)) if e.is_unique_violation() => {
            return Err(ApiError::Conflict("Username already taken".into()))
        }
        Err(e) => return Err(e.into()),
    };
    let token = create_token(&jwt, id)?;
    Ok(HttpResponse::Created().json(AuthResponse { token, user: UserOut { id, username: username.to_string() } }))
}

async fn login(
    pool: web::Data<SqlitePool>,
    jwt: web::Data<JwtConfig>,
    body: web::Json<Credentials>,
) -> Result<HttpResponse, ApiError> {
    let bad = || ApiError::Unauthorized("Invalid username or password".into());
    let user: UserRow = sqlx::query_as("SELECT id, username, password_hash FROM users WHERE username = ?")
        .bind(body.username.trim())
        .fetch_optional(pool.get_ref())
        .await?
        .ok_or_else(bad)?;
    if !verify_password(&body.password, &user.password_hash) {
        return Err(bad());
    }
    let token = create_token(&jwt, user.id)?;
    Ok(HttpResponse::Ok().json(AuthResponse { token, user: UserOut { id: user.id, username: user.username } }))
}

async fn me(pool: web::Data<SqlitePool>, auth: AuthUser) -> Result<HttpResponse, ApiError> {
    let user: UserRow = sqlx::query_as("SELECT id, username, password_hash FROM users WHERE id = ?")
        .bind(auth.0)
        .fetch_optional(pool.get_ref())
        .await?
        .ok_or_else(|| ApiError::Unauthorized("User no longer exists".into()))?;
    Ok(HttpResponse::Ok().json(UserOut { id: user.id, username: user.username }))
}

fn escape_like(s: &str) -> String {
    s.replace('\\', "\\\\").replace('%', "\\%").replace('_', "\\_")
}

async fn list_notes(
    pool: web::Data<SqlitePool>,
    auth: AuthUser,
    query: web::Query<NoteQuery>,
) -> Result<HttpResponse, ApiError> {
    let notes: Vec<Note> = match query.q.as_deref().map(str::trim).filter(|q| !q.is_empty()) {
        Some(q) => {
            let pat = format!("%{}%", escape_like(q));
            sqlx::query_as(
                "SELECT id, title, content, created_at, updated_at FROM notes
                 WHERE user_id = ? AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
                 ORDER BY updated_at DESC, id DESC",
            )
            .bind(auth.0)
            .bind(&pat)
            .bind(&pat)
            .fetch_all(pool.get_ref())
            .await?
        }
        None => {
            sqlx::query_as(
                "SELECT id, title, content, created_at, updated_at FROM notes
                 WHERE user_id = ? ORDER BY updated_at DESC, id DESC",
            )
            .bind(auth.0)
            .fetch_all(pool.get_ref())
            .await?
        }
    };
    Ok(HttpResponse::Ok().json(notes))
}

async fn create_note(
    pool: web::Data<SqlitePool>,
    auth: AuthUser,
    body: web::Json<NoteInput>,
) -> Result<HttpResponse, ApiError> {
    let now = chrono::Utc::now();
    let note: Note = sqlx::query_as(
        "INSERT INTO notes (user_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
         RETURNING id, title, content, created_at, updated_at",
    )
    .bind(auth.0)
    .bind(&body.title)
    .bind(&body.content)
    .bind(now)
    .bind(now)
    .fetch_one(pool.get_ref())
    .await?;
    Ok(HttpResponse::Created().json(note))
}

async fn get_note(pool: web::Data<SqlitePool>, auth: AuthUser, id: web::Path<i64>) -> Result<HttpResponse, ApiError> {
    let note: Note = sqlx::query_as(
        "SELECT id, title, content, created_at, updated_at FROM notes WHERE id = ? AND user_id = ?",
    )
    .bind(*id)
    .bind(auth.0)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(HttpResponse::Ok().json(note))
}

async fn update_note(
    pool: web::Data<SqlitePool>,
    auth: AuthUser,
    id: web::Path<i64>,
    body: web::Json<NoteInput>,
) -> Result<HttpResponse, ApiError> {
    let note: Note = sqlx::query_as(
        "UPDATE notes SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?
         RETURNING id, title, content, created_at, updated_at",
    )
    .bind(&body.title)
    .bind(&body.content)
    .bind(chrono::Utc::now())
    .bind(*id)
    .bind(auth.0)
    .fetch_optional(pool.get_ref())
    .await?
    .ok_or(ApiError::NotFound)?;
    Ok(HttpResponse::Ok().json(note))
}

async fn delete_note(pool: web::Data<SqlitePool>, auth: AuthUser, id: web::Path<i64>) -> Result<HttpResponse, ApiError> {
    let r = sqlx::query("DELETE FROM notes WHERE id = ? AND user_id = ?")
        .bind(*id)
        .bind(auth.0)
        .execute(pool.get_ref())
        .await?;
    if r.rows_affected() == 0 {
        return Err(ApiError::NotFound);
    }
    Ok(HttpResponse::NoContent().finish())
}
