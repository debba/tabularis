#[cfg(test)]
mod tests {
    use crate::heartbeat::{
        clear_in, heartbeat_path_in, is_alive_in_with_age, write_now_in, Heartbeat,
    };
    use std::time::Duration;
    use tempfile::TempDir;

    #[test]
    fn missing_file_is_not_alive() {
        let tmp = TempDir::new().unwrap();
        assert!(!is_alive_in_with_age(tmp.path(), Duration::from_secs(15)));
    }

    #[test]
    fn fresh_heartbeat_is_alive() {
        let tmp = TempDir::new().unwrap();
        write_now_in(tmp.path()).unwrap();
        assert!(is_alive_in_with_age(tmp.path(), Duration::from_secs(15)));
    }

    #[test]
    fn stale_heartbeat_is_not_alive() {
        let tmp = TempDir::new().unwrap();
        write_now_in(tmp.path()).unwrap();
        // Push mtime 1h into the past — well beyond any reasonable threshold.
        let path = heartbeat_path_in(tmp.path());
        let old = std::time::SystemTime::now()
            .checked_sub(Duration::from_secs(3600))
            .unwrap();
        filetime::set_file_mtime(&path, filetime::FileTime::from_system_time(old)).unwrap();
        assert!(!is_alive_in_with_age(tmp.path(), Duration::from_secs(15)));
    }

    #[test]
    fn write_now_creates_directory_if_missing() {
        let tmp = TempDir::new().unwrap();
        let nested = tmp.path().join("nested").join("config");
        assert!(!nested.exists());
        write_now_in(&nested).unwrap();
        assert!(heartbeat_path_in(&nested).exists());
    }

    #[test]
    fn write_now_persists_pid_and_timestamp() {
        let tmp = TempDir::new().unwrap();
        write_now_in(tmp.path()).unwrap();
        let raw = std::fs::read_to_string(heartbeat_path_in(tmp.path())).unwrap();
        let beat: Heartbeat = serde_json::from_str(&raw).unwrap();
        assert_eq!(beat.pid, std::process::id());
        assert!(!beat.updated_at.is_empty());
    }

    #[test]
    fn clear_removes_existing_file() {
        let tmp = TempDir::new().unwrap();
        write_now_in(tmp.path()).unwrap();
        assert!(heartbeat_path_in(tmp.path()).exists());
        clear_in(tmp.path()).unwrap();
        assert!(!heartbeat_path_in(tmp.path()).exists());
    }

    #[test]
    fn clear_missing_file_is_ok() {
        let tmp = TempDir::new().unwrap();
        clear_in(tmp.path()).unwrap();
    }

    #[test]
    fn write_now_overwrites_existing_file() {
        let tmp = TempDir::new().unwrap();
        write_now_in(tmp.path()).unwrap();
        let first = std::fs::read_to_string(heartbeat_path_in(tmp.path())).unwrap();
        // Sleep is not needed; rfc3339 timestamps differ at ms granularity in
        // practice. We only care that the second write succeeds and the file
        // is still parseable.
        write_now_in(tmp.path()).unwrap();
        let second = std::fs::read_to_string(heartbeat_path_in(tmp.path())).unwrap();
        assert!(serde_json::from_str::<Heartbeat>(&first).is_ok());
        assert!(serde_json::from_str::<Heartbeat>(&second).is_ok());
    }
}
