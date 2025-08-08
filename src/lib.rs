use wasm_bindgen::prelude::*;
use md5::{Md5, Digest};

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// 日志输出
macro_rules! console_log {
    ($enable:expr, $($t:tt)*) => {
        if $enable {
            log(&format_args!($($t)*).to_string())
        }
    }
}
/// 单任务计算MD5
#[wasm_bindgen]
pub async fn calculate_md5_single_async(data: Vec<u8>, md5_length: usize, enable_log: bool) -> String {
    console_log!(enable_log, "Starting single-task MD5 calculation, data length: {}", data.len());
    
    let mut hasher = Md5::new();
    hasher.update(&data);
    let hash = hasher.finalize();
    let hash_string = format!("{:x}", hash);

    let result = match md5_length {
        16 => hash_string[..16].to_string(),
        32 => hash_string,
        _ => hash_string[..std::cmp::min(md5_length, hash_string.len())].to_string(),
    };

    console_log!(enable_log, "Single-task MD5 calculation completed: {}", result);
    result
}