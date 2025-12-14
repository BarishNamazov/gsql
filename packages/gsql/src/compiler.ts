/**
 * GSQL Compiler
 *
 * Main entry point for compiling GSQL source code to SQL.
 * Provides both high-level and detailed compilation APIs.
 */

import { parse } from "./parser.ts";
import { generate } from "./generator.ts";
import type { CompileResult, CompileError } from "./types.ts";

/**
 * Compile GSQL source code to SQL.
 *
 * @param source - GSQL source code
 * @returns CompileResult with success status, SQL output, errors, and optionally AST
 */
export function compile(source: string): CompileResult {
  const errors: CompileError[] = [];

  const parseResult = parse(source);

  if (parseResult.errors.length > 0) {
    return {
      success: false,
      errors: parseResult.errors,
      ast: parseResult.ast ?? undefined,
    };
  }

  if (!parseResult.ast) {
    errors.push({
      message: "Failed to parse source code",
      severity: "error",
    });
    return { success: false, errors };
  }

  try {
    const sql = generate(parseResult.ast);
    return {
      success: true,
      sql,
      errors: [],
      ast: parseResult.ast,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push({
      message: `Code generation failed: ${message}`,
      severity: "error",
    });
    return { success: false, errors, ast: parseResult.ast };
  }
}

/**
 * Convenience function that returns just the SQL string or throws on error.
 *
 * @param source - GSQL source code
 * @returns Generated SQL
 * @throws Error if compilation fails
 */
export function compileToSQL(source: string): string {
  const result = compile(source);

  if (!result.success || !result.sql) {
    const errorMessages = result.errors.map((e) => e.message).join("\n");
    throw new Error(`Compilation failed:\n${errorMessages}`);
  }

  return result.sql;
}
