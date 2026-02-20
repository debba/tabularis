import re

content = open("src-tauri/src/commands.rs").read()

content = re.sub(r'#\[test\]\s+fn test_(unicode_username|password_with_colon|password_with_at_sign|password_with_slash|empty_username_and_password|host_with_port_in_url)\(\)', r'#[tokio::test]\n        async fn test_\1()', content)

content = content.replace("assert!(result.await.is_err())", "assert!(result.is_err())", 2) # for lines 1378 and 1387 where result is not a future

# Fix the assert result move
content = content.replace("assert!(result.await.is_err());\n            assert_eq!(result.await.unwrap_err(), \"Unsupported driver\");", "let err = result.await;\n            assert!(err.is_err());\n            assert_eq!(err.unwrap_err(), \"Unsupported driver\");")

open("src-tauri/src/commands.rs", "w").write(content)
