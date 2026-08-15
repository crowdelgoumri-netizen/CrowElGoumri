/**
 * Integration test server helper — builds a fully-wired Fastify app
 * ready for app.inject() without binding to a port.
 */
import { buildServer } from "../../server.js";

export async function buildTestServer() {
  const app = await buildServer();
  return { app };
}
