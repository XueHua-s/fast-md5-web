mod utils;

use wasm_bindgen::prelude::*;
use std::sync::{Arc, Mutex};
use md5::{Md5, Digest};
use futures::future::join_all;

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);
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
    task_count: usize,
    enable_log: bool,
}

#[wasm_bindgen]
impl Md5Calculator {
    #[wasm_bindgen(constructor)]
    pub fn new(task_count: usize) -> Md5Calculator {
        utils::set_panic_hook();
        let actual_task_count = if task_count == 0 { 4 } else { task_count };
        Md5Calculator {
            task_count: actual_task_count,
            enable_log: false, // 默认关闭日志
        }
    }
    /// 异步多任务计算文件MD5
    /// data: 文件数据的字节数组
    /// md5_length: MD5位数（16表示128位的一半，32表示完整128位）
    #[wasm_bindgen]
    pub async fn calculate_md5_async(&self, data: &[u8], md5_length: usize) -> String {
        let data_len = data.len();
        
        if data_len == 0 {
            return String::new();
        }

        // 确保任务数不超过数据长度
        let actual_task_count = std::cmp::min(self.task_count, data_len);
        let chunk_size = data_len / actual_task_count;
        let remainder = data_len % actual_task_count;

        console_log!(self.enable_log, "Starting async MD5 calculation, data length: {}, task count: {}", data_len, actual_task_count);

        // 创建共享的结果向量
        let results = Arc::new(Mutex::new(vec![Vec::<u8>::new(); actual_task_count]));
        let mut tasks = vec![];
        let enable_log = self.enable_log;

        // 将数据分片并分配给不同异步任务
        for i in 0..actual_task_count {
            let start = i * chunk_size;
            let end = if i == actual_task_count - 1 {
                start + chunk_size + remainder
            } else {
                start + chunk_size
            };

            let chunk = data[start..end].to_vec();
            let results_clone = Arc::clone(&results);

            let task = async move {
                let mut hasher = Md5::new();
                hasher.update(&chunk);
                let hash_result = hasher.finalize().to_vec();
                
                // 将结果存储到对应位置
                {
                    let mut results_guard = results_clone.lock().unwrap();
                    results_guard[i] = hash_result;
                }
                
                console_log!(enable_log, "Task {} completed, processed data range: {}-{}", i, start, end);
            };

            tasks.push(task);
        }

        // 等待所有异步任务完成
        join_all(tasks).await;

        // 合并所有分片的哈希结果
        let results_guard = results.lock().unwrap();
        let mut final_hasher = Md5::new();
        
        for chunk_hash in results_guard.iter() {
            final_hasher.update(chunk_hash);
        }

        let final_hash = final_hasher.finalize();
        let hash_string = format!("{:x}", final_hash);

        // 根据指定的MD5位数截取结果
        let truncated_hash = match md5_length {
            16 => hash_string[..16].to_string(),  // 128位的一半
            32 => hash_string,                    // 完整的128位
            _ => hash_string[..std::cmp::min(md5_length, hash_string.len())].to_string(),
        };

        console_log!(self.enable_log, "Async MD5 calculation completed: {}", truncated_hash);
        truncated_hash
    }

    /// 同步版本的计算方法（保持向后兼容）
    #[wasm_bindgen]
    pub async fn calculate_md5(&self, data: &[u8], md5_length: usize) -> Result<JsValue, JsValue> {
        let result = self.calculate_md5_async(data, md5_length).await;
        Ok(JsValue::from_str(&result))
    }

    /// 获取当前任务数设置
    #[wasm_bindgen]
    pub fn get_task_count(&self) -> usize {
        self.task_count
    }

    /// 获取当前日志设置
    #[wasm_bindgen]
    pub fn is_log_enabled(&self) -> bool {
        self.enable_log
    }

    /// 设置日志开关
    #[wasm_bindgen]
    pub fn set_log_enabled(&mut self, enable: bool) {
        self.enable_log = enable;
    }
}

/// 单线程计算MD5
#[wasm_bindgen]
pub async fn calculate_md5_single_async(data: &[u8], md5_length: usize, enable_log: bool) -> String {
    console_log!(enable_log, "Starting async single-task MD5 calculation, data length: {}", data.len());
    
    let mut hasher = Md5::new();
    hasher.update(data);
    let hash = hasher.finalize();
    let hash_string = format!("{:x}", hash);

    let result = match md5_length {
        16 => hash_string[..16].to_string(),
        32 => hash_string,
        _ => hash_string[..std::cmp::min(md5_length, hash_string.len())].to_string(),
    };

    console_log!(enable_log, "Async single-task MD5 calculation completed: {}", result);
    result
}