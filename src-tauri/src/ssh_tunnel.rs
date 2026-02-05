use async_trait::async_trait;
use russh::client;
use russh_keys::key;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::net::{TcpListener, TcpStream};
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::OnceLock;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    mpsc, Arc, Mutex,
};
use std::thread;
use std::time::{Duration, Instant};
use tokio::io::copy_bidirectional;
use tokio::runtime::Runtime;
use tokio::sync::Mutex as TokioMutex;

#[derive(Clone)]
enum TunnelBackend {
    Russh(Arc<AtomicBool>),
    SystemSsh(Arc<Mutex<Child>>),
}

#[derive(Clone)]
struct RusshClientHandler;

#[async_trait]
impl client::Handler for RusshClientHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        _server_public_key: &key::PublicKey,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }
}

#[derive(Clone)]
pub struct SshTunnel {
    pub local_port: u16,
    backend: TunnelBackend,
}

pub static TUNNELS: OnceLock<Mutex<HashMap<String, SshTunnel>>> = OnceLock::new();

pub fn get_tunnels() -> &'static Mutex<HashMap<String, SshTunnel>> {
    TUNNELS.get_or_init(|| Mutex::new(HashMap::new()))
}

impl SshTunnel {
    pub fn new(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_password: Option<&str>,
        ssh_key_file: Option<&str>,
        ssh_key_passphrase: Option<&str>,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<Self, String> {
        let ssh_password = ssh_password.filter(|p| !p.trim().is_empty());
        let use_system_ssh = system_ssh_available();
        println!(
            "[SSH Tunnel] New Request: Host={}, Port={}, User={}, SystemAvailable={}",
            ssh_host, ssh_port, ssh_user, use_system_ssh
        );

        let local_port = {
            let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| {
                let err = format!("Failed to find free local port: {}", e);
                eprintln!("[SSH Tunnel Error] {}", err);
                err
            })?;
            listener.local_addr().unwrap().port()
        };
        println!("[SSH Tunnel] Assigned Local Port: {}", local_port);

        if use_system_ssh {
            Self::new_system_ssh(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_key_file,
                remote_host,
                remote_port,
                local_port,
            )
            .map_err(|e| {
                eprintln!("[SSH Tunnel Error] System SSH failed: {}", e);
                e
            })
        } else {
            Self::new_russh(
                ssh_host,
                ssh_port,
                ssh_user,
                ssh_password,
                ssh_key_file,
                ssh_key_passphrase,
                remote_host,
                remote_port,
                local_port,
            )
            .map_err(|e| {
                eprintln!("[SSH Tunnel Error] Russh failed: {}", e);
                e
            })
        }
    }

    fn new_system_ssh(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_key_file: Option<&str>,
        remote_host: &str,
        remote_port: u16,
        local_port: u16,
    ) -> Result<Self, String> {
        let mut args = Vec::new();

        #[cfg(debug_assertions)]
        args.push("-v".to_string()); // Verbose mode only in debug

        args.push("-N".to_string()); // No remote command
        args.push("-L".to_string());
        // Explicitly bind to 127.0.0.1 to avoid ambiguity or public binding
        args.push(format!(
            "127.0.0.1:{}:{}:{}",
            local_port, remote_host, remote_port
        ));

        let destination = if !ssh_user.trim().is_empty() {
            format!("{}@{}", ssh_user, ssh_host)
        } else {
            ssh_host.to_string()
        };

        if ssh_port != 22 {
            args.push("-p".to_string());
            args.push(ssh_port.to_string());
        }

        if let Some(key) = ssh_key_file {
            if !key.trim().is_empty() {
                args.push("-i".to_string());
                args.push(key.to_string());
            }
        }

        args.push("-o".to_string());
        args.push("StrictHostKeyChecking=no".to_string());
        args.push("-o".to_string());
        args.push("BatchMode=yes".to_string());

        args.push(destination);

        println!("[SSH Tunnel] Executing: ssh {:?}", args);

        let mut child = Command::new("ssh")
            .args(args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| {
                let err = format!(
                    "Failed to launch system ssh: {}. Ensure 'ssh' is in PATH.",
                    e
                );
                eprintln!("[SSH Tunnel Error] {}", err);
                err
            })?;

        let stdout_log = Arc::new(Mutex::new(Vec::new()));
        let stderr_log = Arc::new(Mutex::new(Vec::new()));

        // Spawn threads to capture and log stdout/stderr in real-time
        if let Some(stdout) = child.stdout.take() {
            let log = stdout_log.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stdout);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        #[cfg(debug_assertions)]
                        println!("[SSH System Out] {}", l);

                        if let Ok(mut g) = log.lock() {
                            g.push(l);
                        }
                    }
                }
            });
        }

        if let Some(stderr) = child.stderr.take() {
            let log = stderr_log.clone();
            thread::spawn(move || {
                let reader = BufReader::new(stderr);
                for line in reader.lines() {
                    if let Ok(l) = line {
                        #[cfg(debug_assertions)]
                        eprintln!("[SSH System Err] {}", l);

                        if let Ok(mut g) = log.lock() {
                            g.push(l);
                        }
                    }
                }
            });
        }

        let child_arc = Arc::new(Mutex::new(child));

        // Wait for the tunnel to become ready (port listening)
        let start = Instant::now();
        let timeout = Duration::from_secs(10);
        let mut ready = false;

        while start.elapsed() < timeout {
            // Check if process is still alive
            {
                let mut c = child_arc.lock().unwrap();
                if let Ok(Some(status)) = c.try_wait() {
                    // Collect captured logs
                    let stdout_content = stdout_log.lock().unwrap().join("\n");
                    let stderr_content = stderr_log.lock().unwrap().join("\n");

                    let err_msg = format!(
                        "SSH process exited prematurely with status: {}.\nStderr: {}\nStdout: {}",
                        status, stderr_content, stdout_content
                    );
                    eprintln!("[SSH Tunnel Error] {}", err_msg);
                    return Err(err_msg);
                }
            }

            // Try connecting to the local port to see if forwarding is active
            match TcpStream::connect(format!("127.0.0.1:{}", local_port)) {
                Ok(_) => {
                    println!(
                        "[SSH Tunnel] Tunnel established successfully on port {}",
                        local_port
                    );
                    ready = true;
                    break;
                }
                Err(_) => {
                    // Not ready yet, wait a bit
                    thread::sleep(Duration::from_millis(100));
                }
            }
        }

        if !ready {
            // If we timed out, kill the process
            if let Ok(mut c) = child_arc.lock() {
                let _ = c.kill();
            }
            return Err("Timed out waiting for SSH tunnel to establish connection.".to_string());
        }

        Ok(Self {
            local_port,
            backend: TunnelBackend::SystemSsh(child_arc),
        })
    }

    fn new_russh(
        ssh_host: &str,
        ssh_port: u16,
        ssh_user: &str,
        ssh_password: Option<&str>,
        ssh_key_file: Option<&str>,
        ssh_key_passphrase: Option<&str>,
        remote_host: &str,
        remote_port: u16,
        local_port: u16,
    ) -> Result<Self, String> {
        println!("[SSH Tunnel] Russh connecting to {}:{}", ssh_host, ssh_port);
        let listener = TcpListener::bind(format!("127.0.0.1:{}", local_port)).map_err(|e| {
            let err = format!("Failed to bind local port {}: {}", local_port, e);
            eprintln!("[SSH Tunnel Error] {}", err);
            err
        })?;

        if let Err(e) = listener.set_nonblocking(true) {
            let err = format!("Failed to set listener nonblocking: {}", e);
            eprintln!("[SSH Tunnel Error] {}", err);
            return Err(err);
        }

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();
        let ssh_host = ssh_host.to_string();
        let ssh_user = ssh_user.to_string();
        let ssh_password = ssh_password.map(|p| p.to_string());
        let ssh_key_file = ssh_key_file.map(|p| p.to_string());
        let ssh_key_passphrase = ssh_key_passphrase.map(|p| p.to_string());
        let remote_host = remote_host.to_string();

        let (ready_tx, ready_rx) = mpsc::channel();

        thread::spawn(move || {
            let runtime = match Runtime::new() {
                Ok(rt) => rt,
                Err(e) => {
                    let err = format!("Failed to start Tokio runtime: {}", e);
                    eprintln!("[SSH Tunnel Error] {}", err);
                    let _ = ready_tx.send(Err(err));
                    return;
                }
            };

            let ready_tx_inner = ready_tx.clone();
            let result = runtime.block_on(async move {
                let config = Arc::new(client::Config::default());
                let addr = format!("{}:{}", ssh_host, ssh_port);

                let mut handle = client::connect(config, addr, RusshClientHandler)
                    .await
                    .map_err(|e| format!("Failed to connect to SSH server: {}", e))?;

                let authenticated = if let Some(key_path) =
                    ssh_key_file.as_deref().filter(|p| !p.trim().is_empty())
                {
                    println!("[SSH Tunnel] Authenticating with key file: {}", key_path);
                    let passphrase = ssh_key_passphrase
                        .as_deref()
                        .filter(|p| !p.trim().is_empty());
                    let key = russh_keys::load_secret_key(Path::new(key_path), passphrase)
                        .map_err(|e| format!("SSH key auth failed: {}", e))?;
                    handle
                        .authenticate_publickey(&ssh_user, Arc::new(key))
                        .await
                        .map_err(|e| format!("SSH key auth failed: {}", e))?
                } else if let Some(pwd) = ssh_password.as_deref().filter(|p| !p.trim().is_empty()) {
                    println!("[SSH Tunnel] Authenticating with password");
                    handle
                        .authenticate_password(&ssh_user, pwd)
                        .await
                        .map_err(|e| format!("SSH password auth failed: {}", e))?
                } else {
                    let err = "No SSH credentials provided for russh".to_string();
                    eprintln!("[SSH Tunnel Error] {}", err);
                    let _ = ready_tx_inner.send(Err(err.clone()));
                    return Err(err);
                };

                if !authenticated {
                    let err = "SSH authentication failed".to_string();
                    eprintln!("[SSH Tunnel Error] {}", err);
                    let _ = ready_tx_inner.send(Err(err.clone()));
                    return Err(err);
                }

                let listener = tokio::net::TcpListener::from_std(listener)
                    .map_err(|e| format!("Failed to configure async listener: {}", e))?;

                let handle = Arc::new(TokioMutex::new(handle));

                let _ = ready_tx_inner.send(Ok(()));

                while running_clone.load(Ordering::Relaxed) {
                    let accept =
                        tokio::time::timeout(Duration::from_millis(200), listener.accept()).await;

                    let (stream, _) = match accept {
                        Ok(Ok(result)) => result,
                        Ok(Err(e)) => {
                            eprintln!(
                                "[SSH Tunnel Error] Failed to accept local connection: {}",
                                e
                            );
                            continue;
                        }
                        Err(_) => continue,
                    };

                    let handle = handle.clone();
                    let r_host = remote_host.clone();
                    tokio::spawn(async move {
                        let handle = handle.lock().await;
                        let channel = match handle
                            .channel_open_direct_tcpip(
                                r_host,
                                u32::from(remote_port),
                                "127.0.0.1",
                                0,
                            )
                            .await
                        {
                            Ok(c) => c,
                            Err(e) => {
                                eprintln!("[SSH Tunnel Error] Failed to open SSH channel: {}", e);
                                return;
                            }
                        };
                        drop(handle);

                        let mut stream = stream;
                        let mut channel_stream = channel.into_stream();
                        if let Err(e) = copy_bidirectional(&mut stream, &mut channel_stream).await {
                            eprintln!("[SSH Tunnel Error] Forwarding failed: {}", e);
                        }
                    });
                }

                Ok(())
            });

            if let Err(err) = result {
                let _ = ready_tx.send(Err(err));
            }
        });

        match ready_rx.recv_timeout(Duration::from_secs(10)) {
            Ok(Ok(())) => Ok(Self {
                local_port,
                backend: TunnelBackend::Russh(running),
            }),
            Ok(Err(err)) => Err(err),
            Err(_) => Err("Timed out waiting for Russh tunnel to initialize".to_string()),
        }
    }

    pub fn stop(&self) {
        match &self.backend {
            TunnelBackend::Russh(running) => {
                running.store(false, Ordering::Relaxed);
            }
            TunnelBackend::SystemSsh(child) => {
                if let Ok(mut c) = child.lock() {
                    let _ = c.kill();
                }
            }
        }
    }
}

/// Test an SSH connection without creating a tunnel
pub fn test_ssh_connection(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_password: Option<&str>,
    ssh_key_file: Option<&str>,
    ssh_key_passphrase: Option<&str>,
) -> Result<String, String> {
    let ssh_password = ssh_password.filter(|p| !p.trim().is_empty());
    let use_system_ssh = system_ssh_available();
    println!(
        "[SSH Test] Testing connection to {}:{} as {} (SystemAvailable={})",
        ssh_host, ssh_port, ssh_user, use_system_ssh
    );

    if use_system_ssh {
        test_ssh_connection_system(ssh_host, ssh_port, ssh_user, ssh_key_file)
    } else {
        test_ssh_connection_russh(
            ssh_host,
            ssh_port,
            ssh_user,
            ssh_password,
            ssh_key_file,
            ssh_key_passphrase,
        )
    }
}

/// Test SSH connection using system ssh command (supports ~/.ssh/config)
fn test_ssh_connection_system(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_key_file: Option<&str>,
) -> Result<String, String> {
    println!("[SSH Test] Using system SSH (supports ~/.ssh/config)");

    // Create owned strings to avoid lifetime issues
    let port_string = ssh_port.to_string();
    let destination = format!("{}@{}", ssh_user, ssh_host);

    let mut args = vec![
        "-o",
        "BatchMode=yes",
        "-o",
        "ConnectTimeout=10",
        "-o",
        "StrictHostKeyChecking=accept-new",
    ];

    if ssh_port != 22 {
        args.push("-p");
        args.push(&port_string);
    }

    if let Some(key) = ssh_key_file {
        if !key.trim().is_empty() {
            args.push("-i");
            args.push(key);
        }
    }

    args.push(&destination);
    args.push("exit");

    println!("[SSH Test] Executing: ssh {:?}", args);

    let output = Command::new("ssh").args(&args).output().map_err(|e| {
        format!(
            "Failed to execute ssh command: {}. Ensure 'ssh' is in PATH.",
            e
        )
    })?;

    if output.status.success() {
        println!("[SSH Test] Connection successful!");
        Ok(format!(
            "SSH connection to {}@{}:{} established successfully!",
            ssh_user, ssh_host, ssh_port
        ))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let err = format!("SSH connection failed: {}", stderr.trim());
        eprintln!("[SSH Test Error] {}", err);
        Err(err)
    }
}

/// Test SSH connection using russh (for password authentication)
fn test_ssh_connection_russh(
    ssh_host: &str,
    ssh_port: u16,
    ssh_user: &str,
    ssh_password: Option<&str>,
    ssh_key_file: Option<&str>,
    ssh_key_passphrase: Option<&str>,
) -> Result<String, String> {
    println!("[SSH Test] Using russh for authentication");

    let runtime = Runtime::new().map_err(|e| format!("Failed to start Tokio runtime: {}", e))?;

    let result = runtime.block_on(async {
        let config = Arc::new(client::Config::default());
        let addr = format!("{}:{}", ssh_host, ssh_port);
        let mut handle = client::connect(config, addr, RusshClientHandler)
            .await
            .map_err(|e| {
                format!(
                    "Failed to connect to SSH server {}:{}: {}",
                    ssh_host, ssh_port, e
                )
            })?;

        let authenticated = if let Some(key_path) = ssh_key_file.filter(|p| !p.trim().is_empty()) {
            println!("[SSH Test] Authenticating with key file: {}", key_path);
            let passphrase = ssh_key_passphrase.filter(|p| !p.trim().is_empty());
            let key = russh_keys::load_secret_key(Path::new(key_path), passphrase)
                .map_err(|e| format!("SSH key authentication failed: {}", e))?;
            handle
                .authenticate_publickey(ssh_user, Arc::new(key))
                .await
                .map_err(|e| format!("SSH key authentication failed: {}", e))?
        } else if let Some(pwd) = ssh_password {
            println!("[SSH Test] Authenticating with password");
            handle
                .authenticate_password(ssh_user, pwd)
                .await
                .map_err(|e| format!("SSH password authentication failed: {}", e))?
        } else {
            let err = "No SSH credentials provided for russh".to_string();
            eprintln!("[SSH Test Error] {}", err);
            return Err(err);
        };

        if !authenticated {
            let err = "SSH authentication failed".to_string();
            eprintln!("[SSH Test Error] {}", err);
            return Err(err);
        }

        println!("[SSH Test] Connection successful!");
        Ok(format!(
            "SSH connection to {}@{}:{} established successfully!",
            ssh_user, ssh_host, ssh_port
        ))
    });

    result
}

fn system_ssh_available() -> bool {
    Command::new("ssh")
        .arg("-V")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}
