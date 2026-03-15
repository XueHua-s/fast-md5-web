mod utils;

use wasm_bindgen::prelude::*;
use md5::{Md5, Digest};
use std::collections::HashMap;
use std::cell::RefCell;

// WASM is single-threaded; thread_local + RefCell avoids unnecessary Mutex overhead.
thread_local! {
    static HASH_STATES: RefCell<HashMap<String, Md5>> = RefCell::new(HashMap::new());
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

macro_rules! console_log {
    ($enable:expr, $($t:tt)*) => {
        if $enable {
            log(&format_args!($($t)*).to_string())
        }
    }
}

#[wasm_bindgen]
pub struct Md5Calculator {
    enable_log: bool,
}

#[wasm_bindgen]
impl Md5Calculator {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Md5Calculator {
        utils::set_panic_hook();
        Md5Calculator {
            enable_log: false,
        }
    }

    /// Compute MD5 asynchronously, yielding control periodically for large inputs.
    /// `md5_length`: 16 returns the first 16 hex chars, 32 returns the full hash.
    #[wasm_bindgen]
    pub async fn calculate_md5_async(&self, data: &[u8], md5_length: usize) -> String {
        let data_len = data.len();

        console_log!(self.enable_log, "Starting async MD5 calculation, data length: {}", data_len);

        let mut hasher = Md5::new();

        if data_len > 512 * 1024 {
            // Large inputs: chunk and yield every 2 MB to keep the UI responsive.
            let chunk_size = if data_len > 10 * 1024 * 1024 {
                256 * 1024
            } else {
                128 * 1024
            };

            let yield_interval = 2 * 1024 * 1024;
            let mut bytes_since_yield = 0usize;

            for chunk in data.chunks(chunk_size) {
                hasher.update(chunk);
                bytes_since_yield += chunk.len();

                if bytes_since_yield >= yield_interval {
                    bytes_since_yield = 0;
                    wasm_bindgen_futures::JsFuture::from(
                        js_sys::Promise::resolve(&JsValue::NULL)
                    ).await.unwrap();
                }
            }
        } else {
            hasher.update(data);
        }

        let hash = hasher.finalize();
        let hash_string = format!("{:x}", hash);

        let truncated_hash = Self::truncate_hash(&hash_string, md5_length);

        console_log!(self.enable_log, "Async MD5 calculation completed: {}", truncated_hash);
        truncated_hash
    }

    #[wasm_bindgen]
    pub fn set_log_enabled(&mut self, enable: bool) {
        self.enable_log = enable;
    }

    #[wasm_bindgen]
    pub fn is_log_enabled(&self) -> bool {
        self.enable_log
    }

    /// Begin an incremental (streaming) MD5 session identified by `session_id`.
    #[wasm_bindgen]
    pub fn start_incremental_md5(&self, session_id: &str) {
        HASH_STATES.with(|states| {
            states.borrow_mut().insert(session_id.to_string(), Md5::new());
        });
        console_log!(self.enable_log, "Started incremental MD5 session: {}", session_id);
    }

    /// Feed data into an active incremental session. Returns true on success.
    #[wasm_bindgen]
    pub fn update_incremental_md5(&self, session_id: &str, data: &[u8]) -> bool {
        HASH_STATES.with(|states| {
            let mut map = states.borrow_mut();
            if let Some(hasher) = map.get_mut(session_id) {
                hasher.update(data);
                console_log!(self.enable_log, "Updated incremental MD5 session: {}, data length: {}", session_id, data.len());
                true
            } else {
                console_log!(self.enable_log, "Incremental MD5 session not found: {}", session_id);
                false
            }
        })
    }

    /// Finalize the session and return the hex digest.
    /// Returns an empty string and logs a warning if the session does not exist.
    #[wasm_bindgen]
    pub fn finalize_incremental_md5(&self, session_id: &str, md5_length: usize) -> String {
        HASH_STATES.with(|states| {
            let mut map = states.borrow_mut();
            if let Some(hasher) = map.remove(session_id) {
                let hash = hasher.finalize();
                let hash_string = format!("{:x}", hash);
                let truncated_hash = Self::truncate_hash(&hash_string, md5_length);

                console_log!(self.enable_log, "Finalized incremental MD5 session: {}, result: {}", session_id, truncated_hash);
                truncated_hash
            } else {
                console_log!(self.enable_log, "WARNING: Incremental MD5 session not found for finalization: {}", session_id);
                String::new()
            }
        })
    }

    /// Cancel and discard an active incremental session.
    #[wasm_bindgen]
    pub fn cancel_incremental_md5(&self, session_id: &str) -> bool {
        HASH_STATES.with(|states| {
            let removed = states.borrow_mut().remove(session_id).is_some();
            if removed {
                console_log!(self.enable_log, "Cancelled incremental MD5 session: {}", session_id);
            } else {
                console_log!(self.enable_log, "Incremental MD5 session not found for cancellation: {}", session_id);
            }
            removed
        })
    }

    fn truncate_hash(hash_string: &str, md5_length: usize) -> String {
        match md5_length {
            16 => hash_string[..16].to_string(),
            32 => hash_string.to_string(),
            _ => hash_string[..std::cmp::min(md5_length, hash_string.len())].to_string(),
        }
    }
}
