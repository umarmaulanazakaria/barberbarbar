import { defineConfig } from "@playwright/test";
export default defineConfig({testDir:"./tests",testMatch:"**/dashboard-final.spec.ts",workers:1,timeout:45000,use:{baseURL:"http://localhost:5173",channel:"chrome",headless:true},outputDir:"test-results/dashboard-final"});
