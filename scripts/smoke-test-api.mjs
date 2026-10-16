#!/usr/bin/env node
import { spawn } from "node:child_process";

const port = Number(process.env.SMOKE_TEST_PORT || 3100);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(port)], {
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, GEMINI_API_KEY: "" }
});
let serverOutput = "";
server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });

async function waitForServer() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Next server exited early.\n${serverOutput}`);
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Next server did not start in time.\n${serverOutput}`);
}

async function post(body) {
  return fetch(`${base}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(5000)
  });
}

try {
  await waitForServer();

  const invalidType = await post({ imageData: "data:image/gif;base64,R0lGODlhAQABAIAAAAUEBA==", region: "Andhra Pradesh" });
  if (invalidType.status !== 400) throw new Error(`Unsupported image type expected HTTP 400, got ${invalidType.status}: ${await invalidType.text()}`);
  console.log("PASS: unsupported image type returns HTTP 400");

  const invalidMeasurement = await post({
    imageData: "data:image/jpeg;base64,YQ==",
    region: "Andhra Pradesh",
    measurements: { pH: 20 }
  });
  if (invalidMeasurement.status !== 400) throw new Error(`Invalid pH expected HTTP 400, got ${invalidMeasurement.status}: ${await invalidMeasurement.text()}`);
  console.log("PASS: out-of-range pH returns HTTP 400");

  const missingKey = await post({ imageData: "data:image/jpeg;base64,YQ==", region: "Andhra Pradesh" });
  if (missingKey.status !== 503) throw new Error(`Missing provider key expected HTTP 503, got ${missingKey.status}: ${await missingKey.text()}`);
  const errorBody = await missingKey.json();
  if (typeof errorBody.error !== "string" || !errorBody.error.includes("GEMINI_API_KEY")) {
    throw new Error("Missing provider key response did not explain configuration requirement");
  }
  console.log("PASS: missing Gemini key returns explicit HTTP 503 configuration error");
  console.log("API smoke tests passed.");
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  server.kill("SIGTERM");
  await new Promise(resolve => {
    if (server.exitCode !== null) return resolve();
    const timer = setTimeout(() => { server.kill("SIGKILL"); resolve(); }, 3000);
    server.once("exit", () => { clearTimeout(timer); resolve(); });
  });
}
