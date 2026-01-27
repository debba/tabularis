use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, Runtime};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedQueryMeta {
    pub id: String,
    pub name: String,
    pub filename: String,
    pub connection_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedQuery {
    pub id: String,
    pub name: String,
    pub sql: String,
    pub connection_id: String,
}

fn get_queries_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let config_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    let queries_dir = config_dir.join("saved_queries");
    if !queries_dir.exists() {
        fs::create_dir_all(&queries_dir).map_err(|e| e.to_string())?;
    }
    Ok(queries_dir)
}

fn get_meta_path<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    let dir = get_queries_dir(app)?;
    Ok(dir.join("meta.json"))
}

fn read_meta<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<SavedQueryMeta>, String> {
    let path = get_meta_path(app)?;
    if !path.exists() {
        return Ok(Vec::new());
    }
    let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| e.to_string())
}

fn write_meta<R: Runtime>(app: &AppHandle<R>, meta: &Vec<SavedQueryMeta>) -> Result<(), String> {
    let path = get_meta_path(app)?;
    let content = serde_json::to_string_pretty(meta).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_saved_queries<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
) -> Result<Vec<SavedQuery>, String> {
    let meta_list = read_meta(&app)?;
    let dir = get_queries_dir(&app)?;
    
    let mut results = Vec::new();
    
    for meta in meta_list {
        if meta.connection_id == connection_id {
            let file_path = dir.join(&meta.filename);
            let sql = if file_path.exists() {
                fs::read_to_string(file_path).unwrap_or_default()
            } else {
                String::new()
            };
            
            results.push(SavedQuery {
                id: meta.id,
                name: meta.name,
                sql,
                connection_id: meta.connection_id,
            });
        }
    }
    
    Ok(results)
}

#[tauri::command]
pub async fn save_query<R: Runtime>(
    app: AppHandle<R>,
    connection_id: String,
    name: String,
    sql: String,
) -> Result<SavedQuery, String> {
    let mut meta_list = read_meta(&app)?;
    let dir = get_queries_dir(&app)?;
    
    let id = Uuid::new_v4().to_string();
    let filename = format!("{}.sql", id);
    let file_path = dir.join(&filename);
    
    fs::write(file_path, &sql).map_err(|e| e.to_string())?;
    
    let new_meta = SavedQueryMeta {
        id: id.clone(),
        name: name.clone(),
        filename,
        connection_id: connection_id.clone(),
    };
    
    meta_list.push(new_meta);
    write_meta(&app, &meta_list)?;
    
    Ok(SavedQuery {
        id,
        name,
        sql,
        connection_id,
    })
}

#[tauri::command]
pub async fn update_saved_query<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    name: String,
    sql: String,
) -> Result<SavedQuery, String> {
    let mut meta_list = read_meta(&app)?;
    let dir = get_queries_dir(&app)?;
    
    let idx = meta_list.iter().position(|m| m.id == id).ok_or("Query not found")?;
    
    // Update metadata name
    meta_list[idx].name = name.clone();
    write_meta(&app, &meta_list)?;
    
    // Update SQL file
    let file_path = dir.join(&meta_list[idx].filename);
    fs::write(file_path, &sql).map_err(|e| e.to_string())?;
    
    Ok(SavedQuery {
        id: meta_list[idx].id.clone(),
        name,
        sql,
        connection_id: meta_list[idx].connection_id.clone(),
    })
}

#[tauri::command]
pub async fn delete_saved_query<R: Runtime>(
    app: AppHandle<R>,
    id: String,
) -> Result<(), String> {
    let mut meta_list = read_meta(&app)?;
    let dir = get_queries_dir(&app)?;
    
    let idx = meta_list.iter().position(|m| m.id == id).ok_or("Query not found")?;
    let meta = meta_list.remove(idx);
    
    write_meta(&app, &meta_list)?;
    
    let file_path = dir.join(&meta.filename);
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }
    
    Ok(())
}
