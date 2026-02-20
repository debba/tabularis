use std::process::{Command, Stdio};
use std::io::{Write, BufReader, BufRead};
use serde_json::json;

fn main() {
    let mut child = Command::new("cargo")
        .args(&["run", "--manifest-path", "plugins/duckdb/Cargo.toml", "--bin", "tabularis-duckdb-plugin"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .spawn()
        .expect("Failed to spawn plugin");

    let mut stdin = child.stdin.take().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");

    // Spawn a thread to read stdout
    std::thread::spawn(move || {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            println!("PLUGIN: {}", line.unwrap());
        }
    });

    let requests = vec![
        json!({
            "jsonrpc": "2.0",
            "method": "execute_query",
            "params": {
                "query": "CREATE TABLE users (id INTEGER, name VARCHAR); INSERT INTO users VALUES (1, 'Alice'), (2, 'Bob');"
            },
            "id": 1
        }),
        json!({
            "jsonrpc": "2.0",
            "method": "get_tables",
            "params": {},
            "id": 2
        }),
        json!({
            "jsonrpc": "2.0",
            "method": "execute_query",
            "params": {
                "query": "SELECT * FROM users;"
            },
            "id": 3
        }),
        json!({
            "jsonrpc": "2.0",
            "method": "execute_query",
            "params": {
                "query": "SELECT [1, 2, 3] as lst, {'a': 1, 'b': 2} as strct;"
            },
            "id": 4
        })
    ];

    for req in requests {
        let mut req_str = serde_json::to_string(&req).unwrap();
        req_str.push('\n');
        println!("SENDING: {}", req_str.trim());
        stdin.write_all(req_str.as_bytes()).unwrap();
        stdin.flush().unwrap();
        std::thread::sleep(std::time::Duration::from_millis(500));
    }
    
    drop(stdin);
    child.wait().unwrap();
}
