use actix_cors::Cors;
use actix_web::{http::header, middleware::Logger, App, HttpServer};
use notes_backend::{auth::JwtConfig, configure_app, db};

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let _ = dotenvy::dotenv();
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    let database_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:notes.db".into());
    let port: u16 = std::env::var("PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(8080);
    let jwt = JwtConfig::from_env();

    let pool = db::init_pool(&database_url)
        .await
        .unwrap_or_else(|e| panic!("failed to open database {database_url}: {e}"));

    log::info!("listening on 0.0.0.0:{port}");
    HttpServer::new(move || {
        let cors = Cors::default()
            .allowed_origin("http://localhost:5173")
            .allowed_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
            .allowed_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT])
            .max_age(3600);
        App::new()
            .wrap(Logger::default())
            .wrap(cors)
            .configure(configure_app(pool.clone(), jwt.clone()))
    })
    .bind(("0.0.0.0", port))?
    .run()
    .await
}
