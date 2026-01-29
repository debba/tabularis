use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use crate::keychain_utils;
use crate::config;
use std::env;
use tauri::AppHandle;

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

use std::collections::HashMap;


fn load_models() -> Result<HashMap<String, Vec<String>>, String> {
    let yaml_content = include_str!("ai_models.yaml");
    serde_yaml::from_str(yaml_content)
        .map_err(|e| format!("Failed to parse models.yaml: {}", e))
}

#[tauri::command]
pub async fn get_ai_models() -> Result<HashMap<String, Vec<String>>, String> {
    load_models()
}


#[tauri::command]
pub async fn generate_ai_query(app: AppHandle, req: AiGenerateRequest) -> Result<String, String> {
    generate_query(app, req).await
}

#[tauri::command]
pub async fn explain_ai_query(app: AppHandle, req: AiExplainRequest) -> Result<String, String> {
    explain_query(app, req).await
}

pub async fn generate_query(app: AppHandle, mut req: AiGenerateRequest) -> Result<String, String> {
    if req.model.is_empty() {
        let models = load_models()?;
        let default_model = models.get(&req.provider)
            .and_then(|m| m.first())
            .ok_or_else(|| format!("No models found for provider {}", req.provider))?;
        req.model = default_model.clone();
    }

    let api_key = get_api_key(&req.provider)?;
    let client = Client::new();
    
    // Load system prompt
    let raw_prompt = config::get_system_prompt(app);
    let system_prompt = raw_prompt.replace("{{SCHEMA}}", &req.schema);

    match req.provider.as_str() {
        "openai" => generate_openai(&client, &api_key, &req, &system_prompt).await,
        "anthropic" => generate_anthropic(&client, &api_key, &req, &system_prompt).await,
        "openrouter" => generate_openrouter(&client, &api_key, &req, &system_prompt).await,
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

pub async fn explain_query(app: AppHandle, mut req: AiExplainRequest) -> Result<String, String> {
    if req.model.is_empty() {
        let models = load_models()?;
        let default_model = models.get(&req.provider)
            .and_then(|m| m.first())
            .ok_or_else(|| format!("No models found for provider {}", req.provider))?;
        req.model = default_model.clone();
    }

    let api_key = get_api_key(&req.provider)?;
    let client = Client::new();
    
    // Load explain prompt
    let raw_prompt = config::get_explain_prompt(app);
    let system_prompt = raw_prompt.replace("{{LANGUAGE}}", &req.language);

    let prompt = format!(
        "Query:\n\
        {query}\n",
        query = req.query
    );

    match req.provider.as_str() {
        "openai" | "openrouter" => {
            let url = if req.provider == "openai" {
                "https://api.openai.com/v1/chat/completions"
            } else {
                "https://openrouter.ai/api/v1/chat/completions"
            };
            
            let body = json!({
                "model": req.model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.0
            });

            let mut request_builder = client
                .post(url)
                .header("Authorization", format!("Bearer {}", api_key))
                .json(&body);
                
            if req.provider == "openrouter" {
                request_builder = request_builder
                    .header("HTTP-Referer", "https://github.com/debba/tabularis")
                    .header("X-Title", "Tabularis");
            }

            let res = request_builder.send().await.map_err(|e| e.to_string())?;

            if !res.status().is_success() {
                let error_text = res.text().await.unwrap_or_default();
                return Err(format!("{} Error: {}", req.provider, error_text));
            }

            let json: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;
            let content = json["choices"][0]["message"]["content"]
                .as_str()
                .ok_or("Invalid response format")?;

            Ok(content.to_string())
        }
        "anthropic" => {
            let body = json!({
                "model": req.model,
                "system": system_prompt,
                "messages": [
                    {"role": "user", "content": prompt}
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
                .ok_or("Invalid response format")?;

            Ok(content.to_string())
        }
        _ => Err(format!("Unsupported provider: {}", req.provider)),
    }
}

fn get_api_key(provider: &str) -> Result<String, String> {
    // 1. Try Env Var
    let env_var = match provider {
        "openai" => "OPENAI_API_KEY",
        "anthropic" => "ANTHROPIC_API_KEY",
        "openrouter" => "OPENROUTER_API_KEY",
        _ => "",
    };
    
    if !env_var.is_empty() {
        if let Ok(key) = env::var(env_var) {
            if !key.is_empty() {
                return Ok(key);
            }
        }
    }

    // 2. Try Keychain
    keychain_utils::get_ai_key(provider).map_err(|_| format!("API Key for {} not found in Keychain or Environment", provider))
}

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
        // OpenRouter requires Referer and specific headers for tracking
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

fn clean_response(text: &str) -> String {
    // Remove markdown code blocks ```sql ... ``` or ``` ... ```
    let text = text.trim();
    if text.starts_with("```") {
        let mut lines = text.lines();
        lines.next(); // Skip first line (```sql)
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
