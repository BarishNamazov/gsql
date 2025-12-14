#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "..", "test", "fixtures");
const outputFile = join(__dirname, "..", "playground", "examples.json");

interface Example {
  id: string;
  name: string;
  description: string;
  code: string;
}

function extractDescription(code: string): string {
  const lines = code.split("\n");
  for (const line of lines) {
    if (line.startsWith("// GSQL Example:")) {
      return line.replace("// GSQL Example:", "").trim();
    }
  }
  return "";
}

function formatName(filename: string): string {
  return filename
    .replace(".gsql", "")
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const examples: Example[] = [];

const files = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".gsql"))
  .sort();

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
