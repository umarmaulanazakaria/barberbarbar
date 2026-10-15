import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// Harness dapat memakai port terpisah agar backend development tidak dihentikan.
export default defineConfig(({ mode }) => {
const portBackend = Number(loadEnv(mode, ".", "BB_").BB_E2E_BACKEND_PORT ?? 3000);
if (portBackend % 1 !== 0 || portBackend < 1024 || portBackend > 65535) throw new Error("Port backend tidak valid");
const tujuanBackend = `http://127.0.0.1:${portBackend}`;
return {
  plugins:[react(),tailwindcss()],
  server:{port:5173,strictPort:true,proxy:{"/api":{target:tujuanBackend,changeOrigin:true,rewrite:(path)=>path.replace(/^\/api/,"")},"/socket.io":{target:tujuanBackend,ws:true}}}
};
});
