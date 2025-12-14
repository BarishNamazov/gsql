/**
 * GSQL CLI
 *
 * Command-line interface for the GSQL compiler.
 * Usage: gsql compile <file.gsql> [-o output.sql]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "./compiler.ts";

interface CLIOptions {
  command: string;
  inputFile: string;
  outputFile: string | null;
  verbose: boolean;
  help: boolean;
  version: boolean;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8")) as {
  version: string;
};
const VERSION = packageJson.version;

const HELP_TEXT = `
GSQL - Generic SQL Compiler
Parametric polymorphism for SQL schemas

Usage:
  gsql compile <file.gsql> [-o output.sql]
  gsql --help
  gsql --version

Commands:
  compile    Compile a GSQL file to SQL

Options:
  -o, --output <file>   Write output to file (default: stdout)
  -v, --verbose         Show verbose output
  -h, --help            Show this help message
  --version             Show version number

Examples:
  gsql compile schema.gsql
  gsql compile schema.gsql -o schema.sql
  gsql compile schema.gsql > schema.sql
`;

class ArgParser {
  private index = 0;

  constructor(private args: string[]) {}

  current(): string | undefined {
    return this.args[this.index];
  }

  next(): string | undefined {
    this.index++;
    return this.args[this.index];
  }

  advance(): void {
    this.index++;
  }

  hasMore(): boolean {
    return this.index < this.args.length;
  }
}

function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = {
    command: "",
    inputFile: "",
    outputFile: null,
    verbose: false,
    help: false,
    version: false,
  };

  const parser = new ArgParser(args);

  while (parser.hasMore()) {
    const arg = parser.current();
    if (!arg) {
      parser.advance();
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "--version") {
      options.version = true;
    } else if (arg === "-v" || arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "-o" || arg === "--output") {
      const nextArg = parser.next();
      if (nextArg) {
        options.outputFile = nextArg;
      }
    } else if (!arg.startsWith("-")) {
      if (!options.command) {
        options.command = arg;
      } else if (!options.inputFile) {
        options.inputFile = arg;
      }
    }
    parser.advance();
  }

  return options;
}

function formatError(message: string, line?: number, column?: number): string {
  let result = `Error: ${message}`;
  if (line !== undefined && column !== undefined) {
    result = `Error [${line}:${column}]: ${message}`;
  }
  return result;
}

function main(): void {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (options.version) {
    console.log(`gsql version ${VERSION}`);
    process.exit(0);
  }

  if (!options.command) {
    console.error("Error: No command specified");
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (options.command !== "compile") {
    console.error(`Error: Unknown command '${options.command}'`);
    console.log(HELP_TEXT);
    process.exit(1);
  }

  if (!options.inputFile) {
    console.error("Error: No input file specified");
    console.log(HELP_TEXT);
    process.exit(1);
  }

  const inputPath = resolve(process.cwd(), options.inputFile);

  if (!existsSync(inputPath)) {
    console.error(`Error: File not found: ${options.inputFile}`);
    process.exit(1);
  }

  let source: string;
  try {
    source = readFileSync(inputPath, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error reading file: ${message}`);
    process.exit(1);
  }

  if (options.verbose) {
    console.error(`Compiling ${basename(inputPath)}...`);
  }

  const result = compile(source);

  if (!result.success) {
    for (const error of result.errors) {
      console.error(
        formatError(error.message, error.location?.start.line, error.location?.start.column)
      );
    }
    process.exit(1);
  }

  if (options.outputFile) {
    const outputPath = resolve(process.cwd(), options.outputFile);
    try {
      writeFileSync(outputPath, result.sql ?? "");
      if (options.verbose) {
        console.error(`Output written to ${options.outputFile}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Error writing file: ${message}`);
      process.exit(1);
    }
  } else {
    console.log(result.sql);
  }
}

main();
