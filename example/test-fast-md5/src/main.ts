import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import { WasmInit, Md5Calculator, Md5CalculatorPool } from 'fast-md5-web'

declare global {
  interface Window {
    __FAST_MD5_WEB__?: {
      WasmInit: typeof WasmInit
      Md5Calculator: typeof Md5Calculator
      Md5CalculatorPool: typeof Md5CalculatorPool
    }
  }
}

window.__FAST_MD5_WEB__ = {
  WasmInit,
  Md5Calculator,
  Md5CalculatorPool,
}

createApp(App).mount('#app')
