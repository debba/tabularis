use log::{Log, Metadata, Record};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    pub target: Option<String>,
}

#[derive(Debug, Clone)]
pub struct LogBuffer {
    entries: VecDeque<LogEntry>,
    max_size: usize,
    enabled: bool,
}

impl LogBuffer {
    pub fn new(max_size: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(max_size),
            max_size,
            enabled: true,
        }
    }

    pub fn push(&mut self, entry: LogEntry) {
        if !self.enabled {
            return;
        }

        if self.entries.len() >= self.max_size {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }

    pub fn get_entries(&self, limit: Option<usize>, level_filter: Option<String>) -> Vec<LogEntry> {
        let entries: Vec<LogEntry> = self.entries.iter().cloned().collect();

        let filtered = if let Some(filter) = level_filter {
            entries
                .into_iter()
                .filter(|e| e.level.to_lowercase() == filter.to_lowercase())
                .collect()
        } else {
            entries
        };

        if let Some(limit) = limit {
            filtered.into_iter().rev().take(limit).rev().collect()
        } else {
            filtered
        }
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    pub fn set_enabled(&mut self, enabled: bool) {
        self.enabled = enabled;
    }

    pub fn is_enabled(&self) -> bool {
        self.enabled
    }

    pub fn set_max_size(&mut self, size: usize) {
        self.max_size = size;
        // Trim if needed
        while self.entries.len() > self.max_size {
            self.entries.pop_front();
        }
    }

    pub fn get_max_size(&self) -> usize {
        self.max_size
    }
}

pub type SharedLogBuffer = Arc<Mutex<LogBuffer>>;

pub fn create_log_buffer(max_size: usize) -> SharedLogBuffer {
    Arc::new(Mutex::new(LogBuffer::new(max_size)))
}

pub fn format_timestamp() -> String {
    let now = SystemTime::now();
    let datetime = chrono::DateTime::<chrono::Local>::from(now);
    datetime.format("%Y-%m-%d %H:%M:%S%.3f").to_string()
}

/// Custom logger that captures logs to a buffer and outputs to stdout
pub struct CapturingLogger {
    buffer: SharedLogBuffer,
    level: log::LevelFilter,
}

impl CapturingLogger {
    pub fn new(buffer: SharedLogBuffer, level: log::LevelFilter) -> Self {
        Self { buffer, level }
    }
}

impl Log for CapturingLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level() <= self.level
    }

    fn log(&self, record: &Record) {
        if !self.enabled(record.metadata()) {
            return;
        }

        // Format the message
        let message = format!("{}", record.args());
        let timestamp = format_timestamp();
        let level = record.level().to_string();
        let target = record.target().to_string();

        // Print to stderr (visible in terminal)
        eprintln!("[LOG] [{}] [{}] {} - {}", timestamp, level, target, message);

        // Also capture to buffer
        if let Ok(mut buf) = self.buffer.lock() {
            buf.push(LogEntry {
                timestamp,
                level,
                message,
                target: Some(target),
            });
        }
    }

    fn flush(&self) {}
}

/// Initialize the capturing logger
pub fn init_logger(buffer: SharedLogBuffer, level: log::LevelFilter) {
    let logger = CapturingLogger::new(buffer, level);

    // Try to set the logger
    match log::set_boxed_logger(Box::new(logger)) {
        Ok(_) => {
            log::set_max_level(level);
            eprintln!(
                "[Logger] Capturing logger initialized successfully with level: {:?}",
                level
            );
        }
        Err(e) => {
            eprintln!(
                "[Logger] Failed to initialize logger (may already be set): {}",
                e
            );
            // Still try to set the max level
            log::set_max_level(level);
        }
    }
}
