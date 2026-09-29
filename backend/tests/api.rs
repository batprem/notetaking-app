use actix_web::{http::StatusCode, test, App};
use notes_backend::{auth::JwtConfig, configure_app, db};
use serde_json::{json, Value};

macro_rules! app {
    () => {{
        let pool = db::init_pool("sqlite::memory:").await.unwrap();
        test::init_service(App::new().configure(configure_app(pool, JwtConfig { secret: "test".into() }))).await
    }};
}

macro_rules! call {
    ($app:expr, $method:ident, $uri:expr, $token:expr, $body:expr) => {{
        let mut req = test::TestRequest::$method().uri($uri);
        if let Some(t) = $token {
            req = req.insert_header(("Authorization", format!("Bearer {}", t)));
        }
        let body: Option<Value> = $body;
        if let Some(b) = body {
            req = req.set_json(b);
        }
        let resp = test::call_service(&$app, req.to_request()).await;
        let status = resp.status();
        let bytes = test::read_body(resp).await;
        let json: Value = if bytes.is_empty() { Value::Null } else { serde_json::from_slice(&bytes).unwrap() };
        (status, json)
    }};
}

macro_rules! register {
    ($app:expr, $name:expr) => {{
        let (s, j) = call!($app, post, "/api/auth/register", None::<String>, Some(json!({"username": $name, "password": "password123"})));
        assert_eq!(s, StatusCode::CREATED);
        j["token"].as_str().unwrap().to_string()
    }};
}

#[actix_web::test]
async fn register_and_login() {
    let app = app!();
    let (s, j) = call!(app, post, "/api/auth/register", None::<String>, Some(json!({"username":"alice","password":"password123"})));
    assert_eq!(s, StatusCode::CREATED);
    assert_eq!(j["user"]["username"], "alice");
    assert!(j["token"].is_string());

    // duplicate (case-insensitive)
    let (s, j) = call!(app, post, "/api/auth/register", None::<String>, Some(json!({"username":"ALICE","password":"password123"})));
    assert_eq!(s, StatusCode::CONFLICT);
    assert!(j["error"].is_string());

    // validation
    let (s, _) = call!(app, post, "/api/auth/register", None::<String>, Some(json!({"username":"ab","password":"password123"})));
    assert_eq!(s, StatusCode::BAD_REQUEST);
    let (s, _) = call!(app, post, "/api/auth/register", None::<String>, Some(json!({"username":"bobby","password":"short"})));
    assert_eq!(s, StatusCode::BAD_REQUEST);

    // login
    let (s, j) = call!(app, post, "/api/auth/login", None::<String>, Some(json!({"username":"alice","password":"password123"})));
    assert_eq!(s, StatusCode::OK);
    let token = j["token"].as_str().unwrap().to_string();
    let (s, _) = call!(app, post, "/api/auth/login", None::<String>, Some(json!({"username":"alice","password":"wrongpass1"})));
    assert_eq!(s, StatusCode::UNAUTHORIZED);
    let (s, _) = call!(app, post, "/api/auth/login", None::<String>, Some(json!({"username":"nobody","password":"password123"})));
    assert_eq!(s, StatusCode::UNAUTHORIZED);

    // me
    let (s, j) = call!(app, get, "/api/auth/me", Some(token), None);
    assert_eq!(s, StatusCode::OK);
    assert_eq!(j["username"], "alice");
    let (s, _) = call!(app, get, "/api/auth/me", None::<String>, None);
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}

#[actix_web::test]
async fn notes_crud_and_search() {
    let app = app!();
    let t = register!(app, "alice");

    let (s, n) = call!(app, post, "/api/notes", Some(&t), Some(json!({"title":"Groceries","content":"milk 100% organic"})));
    assert_eq!(s, StatusCode::CREATED);
    let id = n["id"].as_i64().unwrap();
    assert!(n["created_at"].as_str().unwrap().contains('T'));
    call!(app, post, "/api/notes", Some(&t), Some(json!({"title":"Work","content":"meeting notes"})));

    let (_, list) = call!(app, get, "/api/notes", Some(&t), None);
    assert_eq!(list.as_array().unwrap().len(), 2);
    assert_eq!(list[0]["title"], "Work"); // newest first

    let (_, r) = call!(app, get, "/api/notes?q=milk", Some(&t), None);
    assert_eq!(r.as_array().unwrap().len(), 1);
    let (_, r) = call!(app, get, "/api/notes?q=%25", Some(&t), None); // literal '%'
    assert_eq!(r.as_array().unwrap().len(), 1);
    let (_, r) = call!(app, get, "/api/notes?q=_", Some(&t), None); // literal '_'
    assert_eq!(r.as_array().unwrap().len(), 0);

    let (s, n) = call!(app, put, &format!("/api/notes/{id}"), Some(&t), Some(json!({"title":"Groceries2","content":"eggs"})));
    assert_eq!(s, StatusCode::OK);
    assert_eq!(n["title"], "Groceries2");
    let (_, list) = call!(app, get, "/api/notes", Some(&t), None);
    assert_eq!(list[0]["id"], id); // updated -> first

    let (s, n) = call!(app, get, &format!("/api/notes/{id}"), Some(&t), None);
    assert_eq!(s, StatusCode::OK);
    assert_eq!(n["content"], "eggs");

    let (s, _) = call!(app, delete, &format!("/api/notes/{id}"), Some(&t), None);
    assert_eq!(s, StatusCode::NO_CONTENT);
    let (s, _) = call!(app, get, &format!("/api/notes/{id}"), Some(&t), None);
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = call!(app, get, "/api/notes", None::<String>, None);
    assert_eq!(s, StatusCode::UNAUTHORIZED);
}

#[actix_web::test]
async fn ownership_isolation() {
    let app = app!();
    let a = register!(app, "alice");
    let b = register!(app, "bobby");
    let (_, n) = call!(app, post, "/api/notes", Some(&a), Some(json!({"title":"secret","content":"x"})));
    let id = n["id"].as_i64().unwrap();

    let (_, list) = call!(app, get, "/api/notes", Some(&b), None);
    assert!(list.as_array().unwrap().is_empty());
    let (s, _) = call!(app, get, &format!("/api/notes/{id}"), Some(&b), None);
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = call!(app, put, &format!("/api/notes/{id}"), Some(&b), Some(json!({"title":"hax","content":"y"})));
    assert_eq!(s, StatusCode::NOT_FOUND);
    let (s, _) = call!(app, delete, &format!("/api/notes/{id}"), Some(&b), None);
    assert_eq!(s, StatusCode::NOT_FOUND);

    let (s, n) = call!(app, get, &format!("/api/notes/{id}"), Some(&a), None);
    assert_eq!(s, StatusCode::OK);
    assert_eq!(n["title"], "secret");
}
