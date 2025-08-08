/* tslint:disable */
/* eslint-disable */
export class Md5Calculator {
  free(): void;
  constructor();
  /**
   * 异步计算文件MD5 - 优化版本，减少内存拷贝
   * data: 文件数据的字节数组
   * md5_length: MD5位数（16表示128位的一半，32表示完整128位）
   */
  calculate_md5_async(data: Uint8Array, md5_length: number): Promise<string>;
  /**
   * 设置日志开关
   */
  set_log_enabled(enable: boolean): void;
  /**
   * 获取当前日志设置
   */
  is_log_enabled(): boolean;
  /**
   * 开始增量MD5计算
   */
  start_incremental_md5(session_id: string): void;
  /**
   * 更新增量MD5计算
   */
  update_incremental_md5(session_id: string, data: Uint8Array): boolean;
  /**
   * 完成增量MD5计算并获取结果
   */
  finalize_incremental_md5(session_id: string, md5_length: number): string;
  /**
   * 取消增量MD5计算
   */
  cancel_incremental_md5(session_id: string): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_md5calculator_free: (a: number, b: number) => void;
  readonly md5calculator_new: () => number;
  readonly md5calculator_calculate_md5_async: (a: number, b: number, c: number, d: number) => any;
  readonly md5calculator_set_log_enabled: (a: number, b: number) => void;
  readonly md5calculator_is_log_enabled: (a: number) => number;
  readonly md5calculator_start_incremental_md5: (a: number, b: number, c: number) => void;
  readonly md5calculator_update_incremental_md5: (a: number, b: number, c: number, d: number, e: number) => number;
  readonly md5calculator_finalize_incremental_md5: (a: number, b: number, c: number, d: number) => [number, number];
  readonly md5calculator_cancel_incremental_md5: (a: number, b: number, c: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_2: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly closure25_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure42_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
