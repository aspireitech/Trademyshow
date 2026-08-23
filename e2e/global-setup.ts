/**
 * Seed the e2e database with the demo and admin accounts.
 *
 * Runs before the server starts, so the admin-only surfaces can actually be
 * exercised in a browser rather than only unit-tested. Every other spec
 * registers its own account with a unique address, so nothing collides with
 * what this creates.
 */
import { seedSandbox } from "../src/lib/seed";

export default async function globalSetup(): Promise<void> {
  process.env.DB_PATH = process.env.DB_PATH ?? "./data/e2e-test.db";
  await seedSandbox();
}
