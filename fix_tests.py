import re

content = open("src-tauri/src/commands.rs").read()

content = re.sub(r'#\[test\]\s+fn test_(mysql_url_basic|postgres_url_basic|sqlite_url|url_encoding_special_chars|default_ports|no_password|unsupported_driver|remote_host|non_ssh_params_unchanged|ssh_params_require_host|ssh_params_require_user|ssh_params_require_key_or_password|ssh_params_returns_local_port|ssh_params_maps_to_localhost)\(\)', r'#[tokio::test]\n        async fn test_\1()', content)

content = content.replace("build_connection_url(&params).unwrap()", "build_connection_url(&params).await.unwrap()")
content = content.replace("build_connection_url(&mysql_params).unwrap()", "build_connection_url(&mysql_params).await.unwrap()")
content = content.replace("build_connection_url(&pg_params).unwrap()", "build_connection_url(&pg_params).await.unwrap()")
content = content.replace("assert!(result.is_err())", "assert!(result.await.is_err())")
content = content.replace("assert_eq!(result.unwrap_err(), \"Unsupported driver\")", "assert_eq!(result.await.unwrap_err(), \"Unsupported driver\")")

open("src-tauri/src/commands.rs", "w").write(content)
