// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::api::process::{Command, CommandChild, CommandEvent};
use tauri::Manager;

/// Garde en vie le processus sidecar pendant toute la durée de l'app.
struct BackendProcess(Arc<Mutex<Option<CommandChild>>>);

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // En mode debug (tauri dev), le backend tourne déjà séparément via uvicorn.
            // En mode release (bundle .dmg), on démarre le sidecar automatiquement.
            #[cfg(not(debug_assertions))]
            {
                let (mut rx, child) =
                    Command::new_sidecar("echo-backend")
                        .expect("Impossible de trouver le sidecar echo-backend")
                        .spawn()
                        .expect("Impossible de démarrer le backend Echo");

                // Stocke le child pour qu'il reste en vie
                app.manage(BackendProcess(Arc::new(Mutex::new(Some(child)))));

                // Lit stdout/stderr du backend en arrière-plan (logs)
                tauri::async_runtime::spawn(async move {
                    while let Some(event) = rx.recv().await {
                        match event {
                            CommandEvent::Stdout(line) => {
                                println!("[echo-backend] {}", line);
                            }
                            CommandEvent::Stderr(line) => {
                                eprintln!("[echo-backend] {}", line);
                            }
                            CommandEvent::Terminated(status) => {
                                eprintln!(
                                    "[echo-backend] Processus terminé avec le code {:?}",
                                    status.code
                                );
                                break;
                            }
                            _ => {}
                        }
                    }
                });
            }

            Ok(())
        })
        .on_window_event(|event| {
            // Quand la fenêtre se ferme, on tue proprement le backend
            if let tauri::WindowEvent::Destroyed = event.event() {
                if let Some(state) = event.window().try_state::<BackendProcess>() {
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
