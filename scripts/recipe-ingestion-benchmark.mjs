#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

const STAGES = ["markdown", "http_html", "rendered_html", "readability"];

const arg = (name, fallback = "") => {
  const found = process.argv.find((entry) => entry.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};

const outputPath = arg("--output", "coverage/recipe-ingestion-benchmark.json");
const fixturePath = arg(
  "--fixture",
  "tests/fixtures/recipe-ingestion/golden-urls.json"
);
const workerUrl = arg("--worker-url", process.env.INGEST_RENDER_WORKER_URL ?? "");
const workerToken = arg("--worker-token", process.env.INGEST_RENDER_WORKER_TOKEN ?? "");

const normalizeText = (value) => value.replace(/\s+/g, " ").trim();
const stripHtml = (value) =>
  normalizeText(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );

const extractSignals = (text) => {
  const lines = text.split(/\r?\n+/).map((line) => line.trim()).filter(Boolean);
  const ingredients = lines.filter((line) => /\b(cup|cups|tbsp|tsp|gram|g|kg|oz|lb|ml|l|pinch)\b/i.test(line)).length;
  const instructions = lines.filter((line) => /\b(mix|stir|bake|cook|add|serve|heat|preheat|simmer|saute)\b/i.test(line)).length;
  const title = lines.find((line) => line.length >= 8 && line.length <= 120) ?? "";
  const score = Math.min(ingredients, 15) * 2 + Math.min(instructions, 15) * 3 + (title ? 6 : 0);

  return {
    title,
    ingredients,
    instructions,
    score,
    success: ingredients > 0 && instructions > 0,
  };
};

const postMarkdownNew = async (url) => {
  const response = await fetch("https://markdown.new/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  if (!response.ok) {
    return null;
  }
  const payload = await response.json();
  if (!payload?.content) {
    return null;
  }
  return {
    content: payload.content,
    title: payload.title,
  };
};

const fetchHtml = async (url) => {
  const response = await fetch(url, {
    headers: { "User-Agent": "MiseEnPlaceBenchmark/1.0" },
    redirect: "follow",
  });
  if (!response.ok) {
    return null;
  }
  return response.text();
};

const fetchRendered = async (url) => {
  if (!workerUrl) {
    return null;
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(workerToken ? { Authorization: `Bearer ${workerToken}` } : {}),
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  return payload?.html ?? null;
};

const parseReadability = (html, url) => {
  const dom = new JSDOM(html, { url });
  const parsed = new Readability(dom.window.document).parse();
  if (!parsed?.textContent) {
    return null;
  }
  return parsed.textContent;
};

const run = async () => {
  const fixture = JSON.parse(await fs.readFile(path.resolve(fixturePath), "utf8"));
  const urls = Array.isArray(fixture.urls) ? fixture.urls : [];

  const results = [];
  const stageWins = Object.fromEntries(STAGES.map((stage) => [stage, 0]));
  let successCount = 0;

  for (const url of urls) {
    const stageSignals = {
      markdown: { score: 0, success: false },
      http_html: { score: 0, success: false },
      rendered_html: { score: 0, success: false },
      readability: { score: 0, success: false },
    };

    let directHtml = "";

    try {
      const markdown = await postMarkdownNew(url);
      if (markdown?.content) {
        stageSignals.markdown = extractSignals(markdown.content);
      }
    } catch {
      // keep default failure signal
    }

    try {
      const html = await fetchHtml(url);
      if (html) {
        directHtml = html;
        stageSignals.http_html = extractSignals(stripHtml(html));
      }
    } catch {
      // keep default failure signal
    }

    if (workerUrl) {
      try {
        const renderedHtml = await fetchRendered(url);
        if (renderedHtml) {
          stageSignals.rendered_html = extractSignals(stripHtml(renderedHtml));
          const readabilityText = parseReadability(renderedHtml, url);
          if (readabilityText) {
            stageSignals.readability = extractSignals(readabilityText);
          }
        }
      } catch {
        // keep default failure signal
      }
    } else if (directHtml) {
      const readabilityText = parseReadability(directHtml, url);
      if (readabilityText) {
        stageSignals.readability = extractSignals(readabilityText);
      }
    }

    const winner = Object.entries(stageSignals)
      .sort((a, b) => b[1].score - a[1].score)[0]?.[0] ?? "markdown";
    stageWins[winner] += 1;

    const passed = Object.values(stageSignals).some((signal) => signal.success);
    if (passed) {
      successCount += 1;
    }

    results.push({
      url,
      winner,
      stages: stageSignals,
      passed,
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalUrls: urls.length,
    successRate: urls.length > 0 ? Number((successCount / urls.length).toFixed(4)) : 0,
    stageWinRate: Object.fromEntries(
      Object.entries(stageWins).map(([stage, wins]) => [
        stage,
        urls.length > 0 ? Number((wins / urls.length).toFixed(4)) : 0,
      ])
    ),
    results,
  };

  const resolvedOutput = path.resolve(outputPath);
  await fs.mkdir(path.dirname(resolvedOutput), { recursive: true });
  await fs.writeFile(resolvedOutput, JSON.stringify(report, null, 2));

  console.log(`Benchmark report written to ${resolvedOutput}`);
  console.log(`Success rate: ${(report.successRate * 100).toFixed(1)}% (${successCount}/${urls.length})`);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
