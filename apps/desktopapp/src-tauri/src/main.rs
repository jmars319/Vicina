#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    Manager, Runtime,
};

const APP_NAME: &str = "Vicina by tenra";
const MENU_SETTINGS: &str = "settings";
const MENU_CLOSE_WINDOW: &str = "close-window";
const MENU_QUIT: &str = "quit";

fn main() {
    let app = tauri::Builder::default()
        .menu(build_app_menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            MENU_SETTINGS => {
                let _ = show_main_window(app);
            }
            MENU_CLOSE_WINDOW => {
                let _ = close_main_window(app);
            }
            MENU_QUIT => app.exit(0),
            _ => {}
        })
        .on_window_event(|window, event| {
            if window.label() == "main" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("failed to build Vicina by tenra desktopapp");

    app.run(|app_handle, event| match event {
        #[cfg(target_os = "macos")]
        tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } => {
            let _ = show_main_window(app_handle);
        }
        _ => {}
    });
}

fn build_app_menu<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = Submenu::with_items(
        app,
        APP_NAME,
        true,
        &[
            &MenuItem::with_id(app, MENU_SETTINGS, "Settings...", true, Some("CmdOrCtrl+,"))?,
            &PredefinedMenuItem::separator(app)?,
            &MenuItem::with_id(
                app,
                MENU_CLOSE_WINDOW,
                "Close Window",
                true,
                Some("CmdOrCtrl+W"),
            )?,
            &MenuItem::with_id(app, MENU_QUIT, "Quit", true, Some("CmdOrCtrl+Q"))?,
        ],
    )?;

    Menu::with_items(app, &[&app_menu])
}

fn show_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

fn close_main_window<R: Runtime>(app: &tauri::AppHandle<R>) -> tauri::Result<()> {
    if let Some(window) = app.get_webview_window("main") {
        window.hide()?;
    }

    Ok(())
}
