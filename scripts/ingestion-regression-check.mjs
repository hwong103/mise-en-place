#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const arg = (name, fallback = "") => {
  const found = process.argv.find((entry) => entry.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};

const baselinePath = arg("--baseline", "tests/fixtures/recipe-ingestion/baseline-report.json");
const currentPath = arg("--current", "coverage/recipe-ingestion-benchmark.json");
const maxDrop = Number(arg("--max-drop", "0.03"));

const loadJson = async (filePath) => JSON.parse(await fs.readFile(path.resolve(filePath), "utf8"));

const run = async () => {
  const baseline = await loadJson(baselinePath);
  const current = await loadJson(currentPath);

  const baselineSuccess = Number(baseline.successRate ?? 0);
  const currentSuccess = Number(current.successRate ?? 0);
  const drop = baselineSuccess - currentSuccess;

  if (drop > maxDrop) {
    console.error(
      `Recipe ingestion success rate regression: baseline=${baselineSuccess.toFixed(4)}, current=${currentSuccess.toFixed(4)}, drop=${drop.toFixed(4)}, allowed=${maxDrop.toFixed(4)}`
    );
    process.exit(1);
  }

  console.log(
    `Recipe ingestion regression check passed: baseline=${baselineSuccess.toFixed(4)}, current=${currentSuccess.toFixed(4)}, drop=${drop.toFixed(4)}`
  );
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
