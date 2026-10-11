import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// รหัสเวอร์ชันของ build นี้ — ฝังในโค้ด และเขียนเป็น /version.json ให้เว็บที่เปิดค้างไว้เช็คว่ามีของใหม่
const BUILD_ID = process.env.CF_PAGES_COMMIT_SHA?.slice(0, 7) || Date.now().toString(36)

function versionFile(): Plugin {
  return {
    name: 'version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
})
