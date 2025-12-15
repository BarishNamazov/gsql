#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "..", "gsql", "test", "fixtures");
const outputFile = join(__dirname, "..", "examples.json");

function extractDescription(code) {
  const lines = code.split("\n");
  for (const line of lines) {
    if (line.startsWith("// GSQL Example:")) {
      return line.replace("// GSQL Example:", "").trim();
    }
  }
  return "";
}

function formatName(filename) {
  return filename
    .replace(".gsql", "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const examples = [];

const files = [
  "blog-platform.gsql",
  "chat-application.gsql",
  "ecommerce-platform.gsql",
  "exam-system.gsql",
  "task-management.gsql",
];

for (const file of files) {
  const filepath = join(fixturesDir, file);
  const code = readFileSync(filepath, "utf-8");
  const id = basename(file, ".gsql");

  examples.push({
    id,
    name: formatName(id),
    description: extractDescription(code),
    code,
  });
}

writeFileSync(outputFile, JSON.stringify(examples, null, 2));
console.log(`Generated ${examples.length} examples to ${outputFile}`);
