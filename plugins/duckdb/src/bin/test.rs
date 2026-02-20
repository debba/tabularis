use duckdb::Connection;
fn main() {
    let conn = Connection::open_in_memory().unwrap();
    conn.execute("INSTALL json; LOAD json;", []).ok(); // In bundled, json is usually built-in or needs load
    let mut stmt = conn.prepare("SELECT to_json(t) FROM (SELECT 1 as id, 'hello' as name, [1, 2, 3] as list) t").unwrap();
    let mut rows = stmt.query([]).unwrap();
    while let Some(row) = rows.next().unwrap() {
        let json_str: String = row.get(0).unwrap();
        println!("{}", json_str);
    }
}
