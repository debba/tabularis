content = open("src-tauri/src/commands.rs").read()

content = content.replace("let result = build_connection_url(&params);", "let result = build_connection_url(&params).await;")
content = content.replace("assert_eq!(result.await.unwrap_err(), \"Unsupported driver\");", "assert_eq!(result.unwrap_err(), \"Unsupported driver\");")
content = content.replace("assert!(result.await.is_err());", "assert!(result.is_err());")

open("src-tauri/src/commands.rs", "w").write(content)
