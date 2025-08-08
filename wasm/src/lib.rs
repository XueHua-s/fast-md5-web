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
    
    /// 异步计算文件MD5 - 优化版本，减少内存拷贝
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
        
        // 优化的分块处理策略
        if data_len > 512 * 1024 { // 大于512KB的文件使用分块处理
            let chunk_size = if data_len > 10 * 1024 * 1024 {
                256 * 1024 // 大文件使用256KB块
            } else {
                128 * 1024 // 中等文件使用128KB块
            };
            
            let mut processed = 0;
            for chunk in data.chunks(chunk_size) {
                hasher.update(chunk);
                processed += chunk.len();
                
                // 每处理2MB数据后让出控制权，减少让出频率
                if processed % (2 * 1024 * 1024) == 0 {
                    wasm_bindgen_futures::JsFuture::from(
                        js_sys::Promise::resolve(&JsValue::NULL)
                    ).await.unwrap();
                }
            }
        } else {
            // 小文件直接处理，无需让出控制权
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
