pub mod auth;
pub mod db;
pub mod errors;
pub mod handlers;
pub mod models;

use actix_web::{error, web, HttpRequest, HttpResponse};

/// Shared app configuration (state, JSON error handling, routes) used by main and tests.
pub fn configure_app(pool: sqlx::SqlitePool, jwt: auth::JwtConfig) -> impl FnOnce(&mut web::ServiceConfig) {
    move |cfg| {
        let json_cfg = web::JsonConfig::default().error_handler(|err, _req: &HttpRequest| {
            let resp = HttpResponse::BadRequest().json(serde_json::json!({ "error": format!("Invalid request body: {err}") }));
            error::InternalError::from_response(err, resp).into()
        });
        let path_cfg = web::PathConfig::default().error_handler(|err, _req: &HttpRequest| {
            let resp = HttpResponse::NotFound().json(serde_json::json!({ "error": "Not found" }));
            error::InternalError::from_response(err, resp).into()
        });
        cfg.app_data(web::Data::new(pool))
            .app_data(web::Data::new(jwt))
            .app_data(json_cfg)
            .app_data(path_cfg)
            .configure(handlers::configure);
    }
}
