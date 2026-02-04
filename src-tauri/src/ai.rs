use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::config;
use tauri::{AppHandle, Manager};
use std::collections::{HashMap, HashSet};
use std::time::{SystemTime, UNIX_EPOCH};
use std::fs;

// --- Data Structures ---

#[derive(Serialize, Deserialize, Debug)]
pub struct AiGenerateRequest {
    pub provider: String,
    pub model: String,
    pub prompt: String,
    pub schema: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AiExplainRequest {
    pub provider: String,
    pub model: String,
    pub query: String,
    pub language: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AiChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AiChatRequest {
    pub provider: String,
    pub model: String,
    pub system_prompt: String,
    pub messages: Vec<AiChatMessage>,
}

#[derive(Deserialize, Debug)]
struct OllamaTagsResponse {
    models: Vec<OllamaModel>,
}

#[derive(Deserialize, Debug)]
struct OllamaModel {
    name: String,
}

#[derive(Deserialize, Debug)]
struct OpenAiModelList {
    data: Vec<OpenAiModel>,
}

#[derive(Deserialize, Debug)]
struct OpenAiModel {
    id: String,
}

#[derive(Deserialize, Debug)]
struct OpenRouterModelList {
    data: Vec<OpenRouterModel>,
}

#[derive(Deserialize, Debug)]
struct OpenRouterModel {
    id: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct AiModelsCache {
    last_updated: u64,
    models: HashMap<String, Vec<String>>,
}

// --- Helper Functions ---

fn load_default_models() -> HashMap<String, Vec<String>> {
    let yaml_content = include_str!("ai_models.yaml");
    serde_yaml::from_str(yaml_content)
        .unwrap_or_else(|e| {
            println!("Failed to parse models.yaml: {}", e);
            HashMap::new() // Fallback to empty map on critical error (should be caught by tests)
        })
}

fn get_cache_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|p| p.join("ai_models_cache.json"))
}

fn load_cache(app: &AppHandle) -> Option<AiModelsCache> {
    let path = get_cache_path(app)?;
    if path.exists() {
        let content = fs::read_to_string(path).ok()?;
        serde_json::from_str(&content).ok()
    } else {
        None
    }
}

fn save_cache(app: &AppHandle, models: &HashMap<String, Vec<String>>) {
    if let Some(path) = get_cache_path(app) {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
            
        let cache = AiModelsCache {
            last_updated: timestamp,
            models: models.clone(),
        };
        
        if let Ok(content) = serde_json::to_string(&cache) {
            let _ = fs::write(path, content);
        }
    }
}

// --- Fetchers ---

async fn fetch_ollama_models(port: u16) -> Vec<String> {
    let client = Client::new();
    let url = format!("http://localhost:{}/api/tags", port);
    match client.get(&url).send().await {
        Ok(res) => {
            if res.status().is_success() {
                if let Ok(json) = res.json::<OllamaTagsResponse>().await {
                    return json.models.into_iter().map(|m| m.name).collect();
                }
            }
            Vec::new()
        }
        Err(_) => Vec::new(),
    }
}

async fn fetch_openai_models(api_key: &str) -> Vec<String> {
    if api_key.is_empty() { return Vec::new(); }
    let client = Client::new();
    match client
        .get("https://api.openai.com/v1/models")
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await 
    {
        Ok(res) => {
            if res.status().is_success() {
                if let Ok(json) = res.json::<OpenAiModelList>().await {
                    return json.data.into_iter()
                        .map(|m| m.id)
                        .filter(|id| id.starts_with("gpt") || id.starts_with("o1"))
                        .collect();
                }
            }
            Vec::new()
        }
        Err(_) => Vec::new(),
    }
}

async fn fetch_openrouter_models() -> Vec<String> {
    let client = Client::new();
    match client.get("https://openrouter.ai/api/v1/models").send().await {
        Ok(res) => {
            if res.status().is_success() {
                if let Ok(json) = res.json::<OpenRouterModelList>().await {
                    return json.data.into_iter().map(|m| m.id).collect();
                }
            }
            Vec::new()
        }
        Err(_) => Vec::new(),
    }
}

// --- Commands ---

#[tauri::command]
pub fn clear_ai_models_cache(app: AppHandle) -> Result<(), String> {
    if let Some(path) = get_cache_path(&app) {
        if path.exists() {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn get_ai_models(app: AppHandle, force_refresh: bool) -> Result<HashMap<String, Vec<String>>, String> {
    // Load config to get Ollama port
    let app_config = config::load_config_internal(&app);
    let ollama_port = app_config.ai_ollama_port.unwrap_or(11434);

    // 1. Check Cache (if not forced)
    if !force_refresh {
        if let Some(cache) = load_cache(&app) {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
            // 24 hours = 86400 seconds
            if now - cache.last_updated < 86400 {
                let mut cached_models = cache.models;
                
                // Always refresh Ollama as it is local and fast
                let ollama_models = fetch_ollama_models(ollama_port).await;
                // Replace or insert ollama entry
                if !ollama_models.is_empty() {
                    cached_models.insert("ollama".to_string(), ollama_models);
                } else {
                     cached_models.insert("ollama".to_string(), vec![]);
                }
                
                return Ok(cached_models);
            }
        }
    }

    let mut models = load_default_models();
    
    // 1. Ollama (Dynamic)
    let ollama_models = fetch_ollama_models(ollama_port).await;
    if !ollama_models.is_empty() {
        models.insert("ollama".to_string(), ollama_models);
    } 

    // 2. OpenAI (Dynamic if key exists)
    if let Ok(key) = config::get_ai_api_key("openai") {
        let remote_models = fetch_openai_models(&key).await;
        if !remote_models.is_empty() {
            if let Some(static_list) = models.get_mut("openai") {
                 let mut set: HashSet<String> = static_list.iter().cloned().collect();
                 set.extend(remote_models);
                 *static_list = set.into_iter().collect();
                 static_list.sort();
            }
        }
    }

    // 3. OpenRouter (Dynamic public)
    let openrouter_models = fetch_openrouter_models().await;
    if !openrouter_models.is_empty() {
        if let Some(static_list) = models.get_mut("openrouter") {
             let favorites: HashSet<String> = static_list.iter().cloned().collect();
             let mut new_list = static_list.clone(); 
             
             for m in openrouter_models {
                 if !favorites.contains(&m) {
                     new_list.push(m);
                 }
             }
             *static_list = new_list;
        }
    }
    
    // Save to Cache
    save_cache(&app, &models);

    Ok(models)
}

#[tauri::command]
pub async fn generate_ai_query(app: AppHandle, req: AiGenerateRequest) -> Result<String, String> {
    generate_query(app, req).await
}

#[tauri::command]
pub async fn explain_ai_query(app: AppHandle, req: AiExplainRequest) -> Result<String, String> {
    explain_query(app, req).await
}

#[tauri::command]
pub async fn chat_ai_assist(app: AppHandle, req: AiChatRequest) -> Result<String, String> {
    chat_assist(app, req).await
}

// --- Logic Implementation ---

pub async fn generate_query(app: AppHandle, mut req: AiGenerateRequest) -> Result<String, String> {
    // Load config to get Ollama port
    let app_config = config::load_config_internal(&app);
    let ollama_port = app_config.ai_ollama_port.unwrap_or(11434);

    // If no model selected, pick default
    if req.model.is_empty() {
        if req.provider == "ollama" {
             let ollama_models = fetch_ollama_models(ollama_port).await;
             let default = ollama_models.first().ok_or("No Ollama models found. Is Ollama running?")?;
             req.model = default.clone();
        } else {
            let models = load_default_models(); // Use hardcoded defaults for fallback logic
            let default_model = models.get(&req.provider)
                .and_then(|m| m.first())
                .ok_or_else(|| format!("No models found for provider {}", req.provider))?;
            req.model = default_model.clone();
        }
    }

    let client = Client::new();
    
    let raw_prompt = config::get_system_prompt(app);
    let system_prompt = raw_prompt.replace("{{SCHEMA}}", &req.schema);

    let api_key = if req.provider != "ollama" {
        config::get_ai_api_key(&req.provider)?
    } else {
        String::new()
    };

    match req.provider.as_str() {
        "openai" => generate_openai(&client, &api_key, &req, &system_prompt).await,
        "anthropic" => generate_anthropic(&client, &api_key, &req, &system_prompt).await,
        "openrouter" => generate_openrouter(&client, &api_key, &req, &system_prompt).await,
        "ollama" => generate_ollama(&client, &req, &system_prompt, ollama_port).await,
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

pub async fn explain_query(app: AppHandle, mut req: AiExplainRequest) -> Result<String, String> {
    // Load config to get Ollama port
    let app_config = config::load_config_internal(&app);
    let ollama_port = app_config.ai_ollama_port.unwrap_or(11434);

    if req.model.is_empty() {
        if req.provider == "ollama" {
             let ollama_models = fetch_ollama_models(ollama_port).await;
             let default = ollama_models.first().ok_or("No Ollama models found. Is Ollama running?")?;
             req.model = default.clone();
        } else {
            let models = load_default_models();
            let default_model = models.get(&req.provider)
                .and_then(|m| m.first())
                .ok_or_else(|| format!("No models found for provider {}", req.provider))?;
            req.model = default_model.clone();
        }
    }

    let api_key = if req.provider != "ollama" {
        config::get_ai_api_key(&req.provider)?
    } else {
        String::new()
    };

    let client = Client::new();
    let raw_prompt = config::get_explain_prompt(app);
    let system_prompt = raw_prompt.replace("{{LANGUAGE}}", &req.language);

    let prompt = format!(
        "Query:\n\
        {query}\n",
        query = req.query
    );
    
    // Create a generate request wrapper to reuse helper functions
    let gen_req = AiGenerateRequest {
        provider: req.provider.clone(),
        model: req.model.clone(),
        prompt: prompt,
        schema: String::new(),
    };

    match req.provider.as_str() {
        "openai" => generate_openai(&client, &api_key, &gen_req, &system_prompt).await,
        "anthropic" => generate_anthropic(&client, &api_key, &gen_req, &system_prompt).await,
        "openrouter" => generate_openrouter(&client, &api_key, &gen_req, &system_prompt).await,
        "ollama" => generate_ollama(&client, &gen_req, &system_prompt, ollama_port).await,
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

pub async fn chat_assist(app: AppHandle, mut req: AiChatRequest) -> Result<String, String> {
    // Load config to get Ollama port
    let app_config = config::load_config_internal(&app);
    let ollama_port = app_config.ai_ollama_port.unwrap_or(11434);

    if req.model.is_empty() {
        if req.provider == "ollama" {
            let ollama_models = fetch_ollama_models(ollama_port).await;
            let default = ollama_models
                .first()
                .ok_or("No Ollama models found. Is Ollama running?")?;
            req.model = default.clone();
        } else {
            let models = load_default_models();
            let default_model = models
                .get(&req.provider)
                .and_then(|m| m.first())
                .ok_or_else(|| format!("No models found for provider {}", req.provider))?;
            req.model = default_model.clone();
        }
    }

    let api_key = if req.provider != "ollama" {
        config::get_ai_api_key(&req.provider)?
    } else {
        String::new()
    };

    let client = Client::new();

    match req.provider.as_str() {
        "openai" => chat_openai(&client, &api_key, &req).await,
        "anthropic" => chat_anthropic(&client, &api_key, &req).await,
        "openrouter" => chat_openrouter(&client, &api_key, &req).await,
        "ollama" => chat_ollama(&client, &req, ollama_port).await,
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

// --- Provider Implementations ---

async fn generate_openai(client: &Client, api_key: &str, req: &AiGenerateRequest, system_prompt: &str) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.prompt}
        ],
        "temperature": 0.0
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from OpenAI")?;

    Ok(clean_response(content))
}

async fn generate_openrouter(client: &Client, api_key: &str, req: &AiGenerateRequest, system_prompt: &str) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.prompt}
        ],
        "temperature": 0.0
    });

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/debba/tabularis") 
        .header("X-Title", "Tabularis")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("OpenRouter Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from OpenRouter")?;

    Ok(clean_response(content))
}

async fn generate_anthropic(client: &Client, api_key: &str, req: &AiGenerateRequest, system_prompt: &str) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": req.prompt}
        ],
        "max_tokens": 1024,
        "temperature": 0.0
    });

    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["content"][0]["text"]
        .as_str()
        .ok_or("Invalid response format from Anthropic")?;

    Ok(clean_response(content))
}

async fn generate_ollama(client: &Client, req: &AiGenerateRequest, system_prompt: &str, port: u16) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": req.prompt}
        ],
        "stream": false,
        "options": {
            "temperature": 0.0
        }
    });

    let url = format!("http://localhost:{}/api/chat", port);
    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama on port {}: {}", port, e))?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Ollama Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from Ollama")?;

    Ok(clean_response(content))
}

fn clean_response(text: &str) -> String {
    let text = text.trim();
    if text.starts_with("```") {
        let mut lines = text.lines();
        lines.next(); // Skip first line
        let mut result = Vec::new();
        for line in lines {
            if line.trim() == "```" {
                break;
            }
            result.push(line);
        }
        return result.join("\n").trim().to_string();
    }
    text.to_string()
}

fn build_chat_messages(system_prompt: &str, messages: &[AiChatMessage]) -> Vec<serde_json::Value> {
    let mut formatted = Vec::with_capacity(messages.len() + 1);
    formatted.push(json!({"role": "system", "content": system_prompt}));
    for msg in messages {
        formatted.push(json!({"role": msg.role, "content": msg.content}));
    }
    formatted
}

async fn chat_openai(client: &Client, api_key: &str, req: &AiChatRequest) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": build_chat_messages(&req.system_prompt, &req.messages),
        "temperature": 0.2
    });

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("OpenAI Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from OpenAI")?;

    Ok(content.trim().to_string())
}

async fn chat_openrouter(client: &Client, api_key: &str, req: &AiChatRequest) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": build_chat_messages(&req.system_prompt, &req.messages),
        "temperature": 0.2
    });

    let res = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .header("HTTP-Referer", "https://github.com/debba/tabularis")
        .header("X-Title", "Tabularis")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("OpenRouter Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["choices"][0]["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from OpenRouter")?;

    Ok(content.trim().to_string())
}

async fn chat_anthropic(client: &Client, api_key: &str, req: &AiChatRequest) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "system": req.system_prompt,
        "messages": req.messages,
        "max_tokens": 1024,
        "temperature": 0.2
    });

    let res = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Anthropic Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["content"][0]["text"]
        .as_str()
        .ok_or("Invalid response format from Anthropic")?;

    Ok(content.trim().to_string())
}

async fn chat_ollama(client: &Client, req: &AiChatRequest, port: u16) -> Result<String, String> {
    let body = json!({
        "model": req.model,
        "messages": build_chat_messages(&req.system_prompt, &req.messages),
        "stream": false,
        "options": {
            "temperature": 0.2
        }
    });

    let url = format!("http://localhost:{}/api/chat", port);
    let res = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama on port {}: {}", port, e))?;

    if !res.status().is_success() {
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("Ollama Error: {}", error_text));
    }

    let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
    let content = json["message"]["content"]
        .as_str()
        .ok_or("Invalid response format from Ollama")?;

    Ok(content.trim().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_load_default_models() {
        let models = load_default_models();
        assert!(models.contains_key("openai"));
        assert!(models.contains_key("anthropic"));
        assert!(models.contains_key("openrouter"));
        
        // Check for new futuristic models from yaml
        let openai = models.get("openai").unwrap();
        assert!(openai.contains(&"gpt-5.2".to_string()));
        
        // Ollama is not in yaml, so it shouldn't be here yet
        assert!(!models.contains_key("ollama"));
    }

    #[test]
    fn test_clean_response() {
        let input = "```sql\nSELECT * FROM users;\n```";
        let output = clean_response(input);
        assert_eq!(output, "SELECT * FROM users;");

        let input_no_code = "SELECT * FROM users;";
        let output_no_code = clean_response(input_no_code);
        assert_eq!(output_no_code, "SELECT * FROM users;");
        
        let input_whitespace = "   ```sql\nSELECT 1;\n```   ";
        let output_whitespace = clean_response(input_whitespace);
        assert_eq!(output_whitespace, "SELECT 1;");
    }
}
