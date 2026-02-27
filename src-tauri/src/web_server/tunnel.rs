use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TunnelStatus {
    pub running: bool,
    pub url: Option<String>,
}

struct TunnelState {
    child: Child,
    url: String,
}

pub struct TunnelHandle {
    inner: Arc<Mutex<Option<TunnelState>>>,
}

impl TunnelHandle {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(None)),
        }
    }

    pub fn is_running(&self) -> bool {
        self.inner.lock().unwrap().is_some()
    }

    pub fn url(&self) -> Option<String> {
        self.inner.lock().unwrap().as_ref().map(|s| s.url.clone())
    }

    pub fn stop(&self) {
        let mut guard = self.inner.lock().unwrap();
        if let Some(mut state) = guard.take() {
            let _ = state.child.kill();
            let _ = state.child.wait();
        }
    }

    pub fn store(&self, child: Child, url: String) {
        let mut guard = self.inner.lock().unwrap();
        if let Some(mut old) = guard.take() {
            let _ = old.child.kill();
            let _ = old.child.wait();
        }
        *guard = Some(TunnelState { child, url });
    }
}

impl Default for TunnelHandle {
    fn default() -> Self {
        Self::new()
    }
}

fn is_cloudflared_available() -> bool {
    Command::new("cloudflared")
        .arg("version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}

fn extract_tunnel_url(line: &str) -> Option<String> {
    let start = line.find("https://")?;
    let rest = &line[start..];
    let end = rest
        .find(|c: char| c.is_whitespace() || c == '|')
        .unwrap_or(rest.len());
    let candidate = rest[..end].trim().to_string();
    if candidate.contains(".trycloudflare.com") || candidate.contains(".cfargotunnel.com") {
        Some(candidate)
    } else {
        None
    }
}

/// Start a Cloudflare quick tunnel pointing at the given local port.
/// Returns the child process and the public URL once cloudflared reports it.
pub async fn start(port: u16) -> Result<(Child, String), String> {
    if !is_cloudflared_available() {
        return Err(
            "cloudflared not found in PATH. Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/".to_string(),
        );
    }

    let mut child = Command::new("cloudflared")
        .args(["tunnel", "--url", &format!("http://localhost:{}", port)])
        .stderr(Stdio::piped())
        .stdout(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start cloudflared: {}", e))?;

    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture cloudflared stderr".to_string())?;

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();

    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        let mut tx_opt = Some(tx);
        for line in reader.lines() {
            match line {
                Ok(line) => {
                    if tx_opt.is_some() {
                        if let Some(url) = extract_tunnel_url(&line) {
                            if let Some(t) = tx_opt.take() {
                                let _ = t.send(Ok(url));
                            }
                        }
                    }
                    // Keep reading to drain the stderr pipe
                }
                Err(e) => {
                    if let Some(t) = tx_opt.take() {
                        let _ = t.send(Err(format!("Error reading cloudflared output: {}", e)));
                    }
                    return;
                }
            }
        }
        if let Some(t) = tx_opt.take() {
            let _ = t.send(Err(
                "cloudflared exited without providing a tunnel URL".to_string(),
            ));
        }
    });

    let url = tokio::time::timeout(tokio::time::Duration::from_secs(30), rx)
        .await
        .map_err(|_| {
            "Timeout: cloudflared did not provide a URL within 30 seconds".to_string()
        })?
        .map_err(|_| "Tunnel channel disconnected".to_string())??;

    Ok((child, url))
}
