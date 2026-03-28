import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/ehr/schema/index.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: "./data/careloop.sqlite",
  },
});
