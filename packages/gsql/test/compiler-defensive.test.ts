/**
 * Tests for defensive code paths in the compiler
 * Uses mocking to test error handling that's not reachable through normal usage
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

describe("Compiler Defensive Code Paths", () => {
  let originalParse: any;
  let originalGenerate: any;

  beforeEach(async () => {
    // Store original functions
    const parserModule = await import("../src/parser.ts");
    const generatorModule = await import("../src/generator.ts");
    originalParse = parserModule.parse;
    originalGenerate = generatorModule.generate;
  });

  afterEach(() => {
    // Restore original functions
    vi.restoreAllMocks();
  });

  test("handles null AST with no parse errors (defensive code path)", async () => {
    // Dynamically import to avoid caching issues
    const { parse } = await import("../src/parser.ts");

    // Mock parse to return null AST with no errors (shouldn't happen normally)
    vi.spyOn(await import("../src/parser.ts"), "parse").mockReturnValue({
      ast: null,
      errors: [],
    });

    const { compile } = await import("../src/compiler.ts");

    const result = compile("test");

    // Should have error about failed parse
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain("Failed to parse");
  });

  test("handles generator throwing an error (defensive code path)", async () => {
    // Mock generate to throw an error
    vi.spyOn(await import("../src/generator.ts"), "generate").mockImplementation(() => {
      throw new Error("Simulated generator error");
    });

    const { compile } = await import("../src/compiler.ts");

    const result = compile(`
      schema Test {
        id serial pkey;
      }
      test = Test;
    `);

    // Should catch the error and return it in the compile result
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain("Code generation failed");
    expect(result.errors[0]?.message).toContain("Simulated generator error");
  });

  test("handles generator throwing non-Error object", async () => {
    // Mock generate to throw a non-Error object
    vi.spyOn(await import("../src/generator.ts"), "generate").mockImplementation(() => {
      throw "String error";
    });

    const { compile } = await import("../src/compiler.ts");

    const result = compile(`
      schema Test {
        id serial pkey;
      }
      test = Test;
    `);

    // Should catch and convert to string
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]?.message).toContain("Code generation failed");
    expect(result.errors[0]?.message).toContain("String error");
  });
});
