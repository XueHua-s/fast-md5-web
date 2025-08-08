mod utils;

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
    
    /// 异步计算文件MD5 - 用于Worker中的多任务处理
    /// data: 文件数据的字节数组
    /// md5_length: MD5位数（16表示128位的一半，32表示完整128位）
    #[wasm_bindgen]
    pub async fn calculate_md5_async(&self, data: &[u8], md5_length: usize) -> String {
        let data_len = data.len();
        
        if data_len == 0 {
            return String::new();
        }

        console_log!(self.enable_log, "Starting async MD5 calculation, data length: {}", data_len);

        let mut hasher = Md5::new();
        
        // 对于大文件，分块处理并定期让出控制权
        if data_len > 1024 * 1024 { // 大于1MB的文件
            let chunk_size = 64 * 1024; // 64KB chunks
            
            for chunk in data.chunks(chunk_size) {
                hasher.update(chunk);
                
                // 每处理一个块后让出控制权，避免阻塞主线程
                wasm_bindgen_futures::JsFuture::from(
                    js_sys::Promise::resolve(&JsValue::NULL)
                ).await.unwrap();
            }
        } else {
            hasher.update(&data);
        }
        
        let hash = hasher.finalize();
        let hash_string = format!("{:x}", hash);
        
        let truncated_hash = match md5_length {
            16 => hash_string[..16].to_string(),
            32 => hash_string,
            _ => hash_string[..std::cmp::min(md5_length, hash_string.len())].to_string(),
        };

        console_log!(self.enable_log, "Async MD5 calculation completed: {}", truncated_hash);
        truncated_hash
    }

    /// 设置日志开关
    #[wasm_bindgen]
    pub fn set_log_enabled(&mut self, enable: bool) {
        self.enable_log = enable;
    }

    /// 获取当前日志设置
    #[wasm_bindgen]
    pub fn is_log_enabled(&self) -> bool {
        self.enable_log
    }
}
