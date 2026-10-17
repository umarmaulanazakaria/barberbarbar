import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./tests",testMatch:"**/admin-minimal.spec.ts",workers:1,timeout:90000,use:{baseURL:"http://localhost:5173",channel:"chrome",headless:true},outputDir:"test-results/admin-minimal"});
