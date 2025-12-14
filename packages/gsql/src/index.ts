/**
 * GSQL - Generic SQL Compiler
 *
 * A compiler for GSQL, bringing parametric polymorphism to SQL schemas.
 * Compiles GSQL source to PostgreSQL-compatible SQL.
 */

export { compile, compileToSQL } from "./compiler.ts";
export { parse } from "./parser.ts";
export { generate } from "./generator.ts";
export type { GSQLProgram, CompileResult, CompileError } from "./types.ts";
