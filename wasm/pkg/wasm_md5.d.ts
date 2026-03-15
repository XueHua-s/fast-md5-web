/* tslint:disable */
/* eslint-disable */

export class Md5Calculator {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Compute MD5 asynchronously, yielding control periodically for large inputs.
     * `md5_length`: 16 returns the first 16 hex chars, 32 returns the full hash.
     */
    calculate_md5_async(data: Uint8Array, md5_length: number): Promise<string>;
    /**
     * Cancel and discard an active incremental session.
     */
    cancel_incremental_md5(session_id: string): boolean;
    /**
     * Finalize the session and return the hex digest.
     * Returns an empty string and logs a warning if the session does not exist.
     */
    finalize_incremental_md5(session_id: string, md5_length: number): string;
    is_log_enabled(): boolean;
    constructor();
    set_log_enabled(enable: boolean): void;
    /**
     * Begin an incremental (streaming) MD5 session identified by `session_id`.
     */
    start_incremental_md5(session_id: string): void;
    /**
     * Feed data into an active incremental session. Returns true on success.
     */
    update_incremental_md5(session_id: string, data: Uint8Array): boolean;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_md5calculator_free: (a: number, b: number) => void;
    readonly md5calculator_calculate_md5_async: (a: number, b: number, c: number, d: number) => any;
    readonly md5calculator_cancel_incremental_md5: (a: number, b: number, c: number) => number;
    readonly md5calculator_finalize_incremental_md5: (a: number, b: number, c: number, d: number) => [number, number];
    readonly md5calculator_is_log_enabled: (a: number) => number;
    readonly md5calculator_new: () => number;
    readonly md5calculator_set_log_enabled: (a: number, b: number) => void;
    readonly md5calculator_start_incremental_md5: (a: number, b: number, c: number) => void;
    readonly md5calculator_update_incremental_md5: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly wasm_bindgen__closure__destroy__hbc6457d2daf9e841: (a: number, b: number) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h5020b04c164d2087: (a: number, b: number, c: any) => [number, number];
    readonly wasm_bindgen__convert__closures_____invoke__h14d8ccd4327afb37: (a: number, b: number, c: any, d: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
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
