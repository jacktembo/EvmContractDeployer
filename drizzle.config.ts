import { defineConfig } from "drizzle-kit";
// Load environment variables from .env file (with Replit Secrets taking precedence)
import dotenv from "dotenv";
dotenv.config({ override: false });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
