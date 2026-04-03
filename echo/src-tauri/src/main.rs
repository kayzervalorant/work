// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(not(debug_assertions))]
use std::sync::Arc;
use std::sync::Mutex;
use tauri::Manager;

// ─── Types ───────────────────────────────────────────────────────────────────

/// Garde le processus backend dev en vie (debug uniquement)
#[cfg(debug_assertions)]
struct BackendDevProcess(Mutex<Option<std::process::Child>>);

/// Garde le sidecar backend en vie (release uniquement)
#[cfg(not(debug_assertions))]
use tauri::api::process::{Command, CommandChild, CommandEvent};

#[cfg(not(debug_assertions))]
struct BackendSidecarProcess(Arc<Mutex<Option<CommandChild>>>);

// ─── Commandes Tauri ─────────────────────────────────────────────────────────

/// Installe Ollama automatiquement sur macOS (télécharge + installe dans ~/Applications)
#[tauri::command]
async fn install_ollama_auto() -> Result<(), String> {
    let script = r#"
        set -e
        TMP=$(mktemp -d)
        trap 'rm -rf "$TMP"' EXIT
        echo "[echo] Téléchargement d'Ollama..."
        curl -fsSL -o "$TMP/Ollama.zip" "https://ollama.com/download/Ollama-darwin.zip"
        echo "[echo] Installation dans ~/Applications..."
        mkdir -p ~/Applications
        unzip -q -o "$TMP/Ollama.zip" -d ~/Applications/
        echo "[echo] Démarrage d'Ollama..."
        open ~/Applications/Ollama.app
    "#;

    let status = std::process::Command::new("bash")
        .args(["-c", script])
        .status()
        .map_err(|e| format!("Erreur système : {}", e))?;

    if status.success() {
        Ok(())
    } else {
        Err("L'installation d'Ollama a échoué. Essayez depuis ollama.com.".to_string())
    }
}

/// Démarre Ollama s'il est déjà installé sur le système
#[tauri::command]
async fn start_ollama_if_installed() -> Result<bool, String> {
    // Cherche Ollama.app dans /Applications ou ~/Applications
    let home = std::env::var("HOME").unwrap_or_default();
    let locations = [
        "/Applications/Ollama.app".to_string(),
        format!("{}/Applications/Ollama.app", home),
    ];

    for path in &locations {
        if std::path::Path::new(path).exists() {
            let _ = std::process::Command::new("open")
                .args(["-a", "Ollama"])
                .spawn();
            return Ok(true);
        }
    }

    // Essaie le binaire CLI s'il est dans le PATH
    if std::process::Command::new("which")
        .arg("ollama")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        let _ = std::process::Command::new("sh")
            .args(["-c", "nohup ollama serve >/dev/null 2>&1 &"])
            .spawn();
        return Ok(true);
    }

    Ok(false)
}

// ─── Main ────────────────────────────────────────────────────────────────────

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            install_ollama_auto,
            start_ollama_if_installed,
        ])
        .setup(|app| {
            // Le backend démarre automatiquement dans les deux modes :
            // - dev     : script bash (gère le venv Python automatiquement)
            // - release : sidecar PyInstaller bundlé dans le .dmg
            #[cfg(debug_assertions)]
            start_backend_dev(app)?;

            #[cfg(not(debug_assertions))]
            start_backend_sidecar(app)?;

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                // Nettoyage propre du backend à la fermeture
                #[cfg(debug_assertions)]
                if let Some(state) = event.window().try_state::<BackendDevProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(mut child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }

                #[cfg(not(debug_assertions))]
                if let Some(state) = event.window().try_state::<BackendSidecarProcess>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(child) = guard.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("Erreur lors du lancement d'Echo");
}

// ─── Démarrage backend (mode développement) ──────────────────────────────────

#[cfg(debug_assertions)]
fn start_backend_dev(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // CARGO_MANIFEST_DIR est baked-in à la compilation → toujours correct en dev
    let script = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Répertoire projet introuvable")?
        .join("scripts")
        .join("start-backend-dev.sh");

    if !script.exists() {
        eprintln!("[echo] Script backend introuvable : {}", script.display());
        return Ok(());
    }

    match std::process::Command::new("bash").arg(&script).spawn() {
        Ok(child) => {
            println!("[echo] Backend démarré automatiquement");
            app.manage(BackendDevProcess(Mutex::new(Some(child))));
        }
        Err(e) => {
            eprintln!("[echo] Impossible de démarrer le backend : {}", e);
        }
    }

    Ok(())
}

// ─── Démarrage sidecar (mode release / .dmg) ─────────────────────────────────

#[cfg(not(debug_assertions))]
fn start_backend_sidecar(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let (mut rx, child) = Command::new_sidecar("echo-backend")
        .expect("Sidecar echo-backend introuvable dans le bundle")
        .spawn()
        .expect("Impossible de démarrer le sidecar echo-backend");

    app.manage(BackendSidecarProcess(Arc::new(Mutex::new(Some(child)))));

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => println!("[echo-backend] {}", line),
                CommandEvent::Stderr(line) => eprintln!("[echo-backend] {}", line),
                CommandEvent::Terminated(status) => {
                    eprintln!("[echo-backend] Terminé avec code {:?}", status.code);
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}
