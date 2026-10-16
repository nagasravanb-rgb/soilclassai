#!/usr/bin/env node
/**
 * Evaluate a configured soil image classifier on a held-out, labelled dataset.
 *
 * Dataset layout:
 *   data/soil-validation/
 *     Black Soil/sample-001.jpg
 *     Red Soil/sample-002.jpg
 *     ...
 *
 * The endpoint must accept raw image bytes and return [{label, score}] or
 * {predictions:[{label, score}]}. This script reports observed performance;
 * it does not make the model scientifically valid or representative by itself.
 */
import fs from "node:fs/promises";
import path from "node:path";

const endpoint = process.env.SOIL_CLASSIFIER_ENDPOINT;
const token = process.env.SOIL_CLASSIFIER_TOKEN;
const datasetRoot = path.resolve(process.argv[2] || "data/soil-validation");
const allowed = new Set([".jpg", ".jpeg", ".png", ".webp"]);
if (!endpoint) {
  console.error("Set SOIL_CLASSIFIER_ENDPOINT to your HTTPS inference endpoint.");
  process.exit(2);
}
const parsedEndpoint = new URL(endpoint);
if (parsedEndpoint.protocol !== "https:") {
  console.error("SOIL_CLASSIFIER_ENDPOINT must use HTTPS.");
  process.exit(2);
}

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await walk(full));
    else if (entry.isFile() && allowed.has(path.extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function getTopLabel(data) {
  let items = Array.isArray(data) ? data :
    (data && Array.isArray(data.predictions) ? data.predictions :
    (data && Array.isArray(data.outputs) ? data.outputs : []));
  if (Array.isArray(items[0])) items = items[0];
  const candidates = items.filter(x => x && typeof x === "object" && !Array.isArray(x))
    .map(x => ({
      label: typeof x.label === "string" ? x.label : (typeof x.class === "string" ? x.class : null),
      score: typeof x.score === "number" && Number.isFinite(x.score) ? x.score : -1
    }))
    .filter(x => x.label)
    .sort((a, b) => b.score - a.score);
  return candidates[0]?.label || null;
}

const files = await walk(datasetRoot).catch(err => {
  console.error(`Cannot read dataset folder ${datasetRoot}: ${err.message}`);
  process.exit(2);
});
if (!files.length) {
  console.error("No images found. Put labelled images in one subfolder per ground-truth class.");
  process.exit(2);
}

const labels = new Set(files.map(file => path.relative(datasetRoot, file).split(path.sep)[0]));
const matrix = new Map([...labels].map(actual => [actual, new Map()]));
let correct = 0;
let failed = 0;
for (const [index, file] of files.entries()) {
  const actual = path.relative(datasetRoot, file).split(path.sep)[0];
  try {
    const bytes = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    const headers = { "Content-Type": mime };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(endpoint, { method: "POST", headers, body: bytes, signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 160)}`);
    const predicted = getTopLabel(await response.json());
    if (!predicted) throw new Error("No class label found in classifier response");
    const row = matrix.get(actual);
    row.set(predicted, (row.get(predicted) || 0) + 1);
    if (predicted.toLowerCase().trim() === actual.toLowerCase().trim()) correct++;
    console.log(`[${index + 1}/${files.length}] actual=${actual} predicted=${predicted}`);
  } catch (error) {
    failed++;
    console.error(`[${index + 1}/${files.length}] FAILED ${path.relative(datasetRoot, file)}: ${error.message}`);
  }
  await new Promise(resolve => setTimeout(resolve, 150));
}

const evaluated = files.length - failed;
const accuracy = evaluated ? correct / evaluated : 0;
const perClass = [];
for (const actual of [...labels].sort()) {
  const row = matrix.get(actual);
  const tp = row.get(actual) || 0;
  const support = [...row.values()].reduce((sum, n) => sum + n, 0);
  let predictedAsClass = 0;
  for (const counts of matrix.values()) predictedAsClass += counts.get(actual) || 0;
  const precision = predictedAsClass ? tp / predictedAsClass : 0;
  const recall = support ? tp / support : 0;
  const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  perClass.push({ class: actual, support, precision: +precision.toFixed(4), recall: +recall.toFixed(4), f1: +f1.toFixed(4) });
}
const macroF1 = perClass.length ? perClass.reduce((sum, row) => sum + row.f1, 0) / perClass.length : 0;
console.log("\n=== Held-out classifier evaluation ===");
console.log(JSON.stringify({
  datasetRoot, totalImages: files.length, evaluated, failed,
  correct, accuracy: +accuracy.toFixed(4), macroF1: +macroF1.toFixed(4),
  perClass,
  confusionMatrix: Object.fromEntries([...matrix.entries()].map(([actual, counts]) => [actual, Object.fromEntries(counts)])),
  note: "Use independent field samples and lab-confirmed labels. Report class balance and collection conditions. This score only describes this dataset."
}, null, 2));
if (failed > 0 || evaluated === 0) process.exitCode = 1;
