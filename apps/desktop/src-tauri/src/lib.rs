use std::{
    ffi::OsStr,
    env, fs,
    path::PathBuf,
    sync::{Mutex, OnceLock},
};
use tauri::Emitter;

#[derive(Clone, serde::Serialize)]
struct OpenFilePayload {
    path: String,
}
static PENDING_OPEN_PATH: OnceLock<Mutex<Option<String>>> = OnceLock::new();

fn pending_open_path() -> &'static Mutex<Option<String>> {
    PENDING_OPEN_PATH.get_or_init(|| Mutex::new(None))
}

fn set_pending_open_path(path: String) {
    if let Ok(mut guard) = pending_open_path().lock() {
        *guard = Some(path);
    }
}

fn take_pending_open_path() -> Option<String> {
    pending_open_path().lock().ok().and_then(|mut guard| guard.take())
}
fn path_to_string(path: &PathBuf) -> String {
    path.as_os_str().to_string_lossy().into_owned()
}

fn first_existing_file_arg_from_iter<I, S>(args: I) -> Option<String>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    args.into_iter().find_map(|arg| {
        let path = PathBuf::from(arg.as_ref());
        let path = PathBuf::from(arg);
        if path.is_file() {
            Some(path_to_string(&path))
        } else {
            None
        }
    })
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|err| format!("Failed to read file at {}: {}", path, err))
}

#[tauri::command]
fn get_launch_file_path() -> Option<String> {
    let arg_path = first_existing_file_arg_from_iter(env::args_os().skip(1));
    arg_path.or_else(take_pending_open_path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = first_existing_file_arg_from_iter(args.iter().skip(1)) {
                set_pending_open_path(path.clone());
                let _ = app.emit("hubble://open-file", OpenFilePayload { path });
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![read_file_text, get_launch_file_path])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(any(target_os = "macos", target_os = "ios"))]
        if let tauri::RunEvent::Opened { urls } = event {
            for url in urls {
                if let Ok(path) = url.to_file_path() {
                    let path_string = path_to_string(&path);
                    set_pending_open_path(path_string.clone());
                    let _ = app_handle.emit(
                        "hubble://open-file",
                        OpenFilePayload { path: path_string },
                    );
                    break;
                }
            }
        }
    });
}
