/**
 * GSQL Code Generator
 *
 * Transforms the AST into PostgreSQL-compatible SQL.
 * Handles concept instantiation, mixin resolution, and template expansion.
 */

import type {
  GSQLProgram,
  TopLevelDeclaration,
  ExtensionDecl,
  FunctionDecl,
  SchemaDecl,
  ConceptDecl,
  EnumDecl,
  Instantiation,
  PerInstanceIndex,
  SchemaBodyItem,
  ColumnDef,
  IndexDef,
  CheckDef,
  TriggerDef,
} from "./types.ts";

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert PascalCase or camelCase to snake_case
 *
 * Examples:
 * - "MyTarget" -> "my_target"
 * - "Author" -> "author"
 * - "UserID" -> "user_id"
 * - "HTTPServer" -> "http_server"
 * - "myVariableName" -> "my_variable_name"
 *
 * Handles edge cases:
 * - Consecutive uppercase letters: splits before lowercase (HTTPServer -> http_server)
 * - Mixed case: inserts underscores between transitions (myVarName -> my_var_name)
 */
function toSnakeCase(str: string): string {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2") // Handle consecutive caps (HTTPServer -> HTTP_Server)
    .replace(/([a-z\d])([A-Z])/g, "$1_$2") // Handle camelCase transitions (myVar -> my_Var)
    .toLowerCase();
}

// ============================================================================
// Generator Context
// ============================================================================

interface GeneratorContext {
  /** Map of concept names to their definitions */
  concepts: Map<string, ConceptDecl>;

  /** Map of schema names to their definitions (for mixins) */
  schemas: Map<string, SchemaDecl>;

  /** Map of enum names to their definitions */
  enums: Map<string, EnumDecl>;

  /** Map of table names to their resolved schema names (for references) */
  tableToSchema: Map<string, string>;

  /** Template substitutions for current instantiation */
  templateSubs: Map<string, string>;

  /** Generated enum SQL */
  enumSql: string[];

  /** Generated table SQL */
  tableSql: string[];

  /** Generated index SQL */
  indexSql: string[];

  /** Generated trigger SQL */
  triggerSql: string[];

  /** Extension SQL */
  extensionSql: string[];

  /** Function SQL */
  functionSql: string[];

  /** Per-instance index SQL (added at the end) */
  perInstanceIndexSql: string[];

  /** Track which enums have been generated */
  generatedEnums: Set<string>;

  /** Track which tables have been generated */
  generatedTables: Set<string>;
}

function createContext(): GeneratorContext {
  return {
    concepts: new Map(),
    schemas: new Map(),
    enums: new Map(),
    tableToSchema: new Map(),
    templateSubs: new Map(),
    enumSql: [],
    tableSql: [],
    indexSql: [],
    triggerSql: [],
    extensionSql: [],
    functionSql: [],
    perInstanceIndexSql: [],
    generatedEnums: new Set(),
    generatedTables: new Set(),
  };
}

// ============================================================================
// First Pass: Collect Definitions
// ============================================================================

function collectDefinitions(ast: GSQLProgram, ctx: GeneratorContext): void {
  for (const decl of ast.declarations) {
    switch (decl.type) {
      case "ConceptDecl":
        ctx.concepts.set(decl.name, decl);
        break;
      case "SchemaDecl":
        ctx.schemas.set(decl.name, decl);
        break;
      case "EnumDecl":
        ctx.enums.set(decl.name, decl);
        break;
    }
  }
}

// ============================================================================
// Template Expansion
// ============================================================================

function expandTemplate(name: string, ctx: GeneratorContext): string {
  const templateMatch = name.match(/^\{([^}]+)\}(.*)$/);
  if (templateMatch) {
    const [, param, suffix] = templateMatch;
    let replacement: string | undefined;
    for (const [key, value] of ctx.templateSubs) {
      if (key === param) {
        replacement = value;
        break;
      }
    }
    return (replacement ?? toSnakeCase(param ?? "")) + (suffix ?? "");
  }
  return name;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function expandCheckExpression(expr: string, ctx: GeneratorContext): string {
  let result = expr;

  for (const [param, value] of ctx.templateSubs) {
    const escapedParam = escapeRegExp(param);
    const pattern = new RegExp(`\\{${escapedParam}\\}`, "g");
    result = result.replace(pattern, value);
  }

  result = result.replace(/(\w+)::(\w+)/g, "'$2'::$1");

  return result;
}

// ============================================================================
// SQL Generation Helpers
// ============================================================================

function generateEnumSql(enumDecl: EnumDecl, ctx: GeneratorContext): void {
  const name = enumDecl.name;

  if (ctx.generatedEnums.has(name)) return;
  ctx.generatedEnums.add(name);

  // Add to enums map so it can be referenced for default value formatting
  ctx.enums.set(name, enumDecl);

  const values = enumDecl.values.map((v) => `'${v}'`).join(", ");
  ctx.enumSql.push(`DO $$ BEGIN
    CREATE TYPE ${name} AS ENUM (${values});
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;`);
}

function generateColumnSql(col: ColumnDef, ctx: GeneratorContext): string {
  const name = expandTemplate(col.name, ctx);
  const dataType = col.dataType.toUpperCase();

  const parts: string[] = [`    ${name} ${dataType}`];
  const postConstraints: string[] = [];

  for (const constraint of col.constraints) {
    switch (constraint.type) {
      case "PrimaryKey":
        parts.push("PRIMARY KEY");
        break;
      case "NotNull":
        parts.push("NOT NULL");
        break;
      case "Unique":
        parts.push("UNIQUE");
        break;
      case "Default": {
        let defaultValue = constraint.value ?? "NULL";

        // Check if this is an enum type and the default needs formatting
        const enumTypeName = col.dataType.toLowerCase();
        if (ctx.enums.has(enumTypeName)) {
          // This is an enum column
          // Check if the default value is already in the format 'value'::type or type::value
          if (
            !defaultValue.includes("::") &&
            !defaultValue.includes("'") &&
            defaultValue !== "NULL"
          ) {
            // It's a plain enum value identifier, format it as 'value'::type
            defaultValue = `'${defaultValue}'::${enumTypeName}`;
          } else if (defaultValue.includes("::") && !defaultValue.includes("'")) {
            // It's in the format type::value, convert to 'value'::type
            const match = defaultValue.match(/^(\w+)::(\w+)$/);
            if (match?.[1] && match[2]) {
              defaultValue = `'${match[2]}'::${match[1]}`;
            }
          }
        }

        parts.push(`DEFAULT ${defaultValue}`);
        break;
      }
      case "Reference": {
        let tableName = constraint.table ?? "";
        if (ctx.tableToSchema.has(tableName)) {
          tableName = ctx.tableToSchema.get(tableName) ?? tableName;
        }
        postConstraints.push(`REFERENCES ${tableName}(${constraint.column ?? "id"})`);
        break;
      }
      case "Check":
        parts.push(`CHECK (${expandCheckExpression(constraint.value ?? "", ctx)})`);
        break;
      case "OnDelete":
        postConstraints.push(`ON DELETE ${constraint.action ?? "NO ACTION"}`);
        break;
    }
  }

  return [...parts, ...postConstraints].join(" ");
}

function generateIndexSql(tableName: string, index: IndexDef, ctx: GeneratorContext): string {
  const columns = index.columns.map((c) => expandTemplate(c, ctx)).join(", ");
  const columnNames = index.columns.map((c) => expandTemplate(c, ctx)).join("_");
  const indexName = `idx_${tableName}_${columnNames}`;
  const unique = index.unique === true ? "UNIQUE " : "";
  const using = index.using ? `USING ${index.using} ` : "";

  return `CREATE ${unique}INDEX ${indexName} ON ${tableName} ${using}(${columns});`;
}

function generateCheckSql(_tableName: string, check: CheckDef, ctx: GeneratorContext): string {
  const expr = expandCheckExpression(check.expression, ctx);
  return `    CHECK (${expr})`;
}

function generateTriggerSql(
  tableName: string,
  trigger: TriggerDef,
  _ctx: GeneratorContext
): string {
  const timing = trigger.timing.toUpperCase();
  const event = trigger.event.toUpperCase();
  const forEach = trigger.forEach === "row" ? "FOR EACH ROW" : "FOR EACH STATEMENT";

  return `CREATE TRIGGER ${trigger.name}_${tableName}
    ${timing} ${event} ON ${tableName}
    ${forEach} EXECUTE FUNCTION ${trigger.executeFunction}();`;
}

// ============================================================================
// Schema Resolution
// ============================================================================

interface ResolvedSchema {
  tableName: string;
  columns: ColumnDef[];
  indexes: IndexDef[];
  checks: CheckDef[];
  triggers: TriggerDef[];
}

function resolveMixins(schema: SchemaDecl, ctx: GeneratorContext): SchemaBodyItem[] {
  const items: SchemaBodyItem[] = [];

  for (const mixinName of schema.mixins) {
    const mixin = ctx.schemas.get(mixinName);
    if (mixin) {
      items.push(...resolveMixins(mixin, ctx));
    }
  }

  items.push(...schema.members);

  return items;
}

function resolveSchema(
  schema: SchemaDecl,
  tableName: string,
  ctx: GeneratorContext
): ResolvedSchema {
  const allItems = resolveMixins(schema, ctx);

  const columns: ColumnDef[] = [];
  const indexes: IndexDef[] = [];
  const checks: CheckDef[] = [];
  const triggers: TriggerDef[] = [];

  for (const item of allItems) {
    switch (item.type) {
      case "ColumnDef":
        columns.push(item);
        break;
      case "IndexDef":
        indexes.push(item);
        break;
      case "CheckDef":
        checks.push(item);
        break;
      case "TriggerDef":
        triggers.push(item);
        break;
    }
  }

  return { tableName, columns, indexes, checks, triggers };
}

// ============================================================================
// Table Generation
// ============================================================================

function generateTableSql(resolved: ResolvedSchema, ctx: GeneratorContext): void {
  if (ctx.generatedTables.has(resolved.tableName)) return;
  ctx.generatedTables.add(resolved.tableName);

  const columnsSql = resolved.columns.map((c) => generateColumnSql(c, ctx));
  const checksSql = resolved.checks.map((c) => generateCheckSql(resolved.tableName, c, ctx));

  const allColumnLines = [...columnsSql, ...checksSql];
  const tableBody = allColumnLines.join(",\n");

  ctx.tableSql.push(`CREATE TABLE ${resolved.tableName} (\n${tableBody}\n);`);

  for (const index of resolved.indexes) {
    ctx.indexSql.push(generateIndexSql(resolved.tableName, index, ctx));
  }

  for (const trigger of resolved.triggers) {
    ctx.triggerSql.push(generateTriggerSql(resolved.tableName, trigger, ctx));
  }
}

// ============================================================================
// Declaration Processing
// ============================================================================

function processExtension(decl: ExtensionDecl, ctx: GeneratorContext): void {
  ctx.extensionSql.push(`CREATE EXTENSION IF NOT EXISTS "${decl.name}";`);
}

function processFunction(decl: FunctionDecl, ctx: GeneratorContext): void {
  ctx.functionSql.push(`CREATE OR REPLACE FUNCTION ${decl.name}()
RETURNS TRIGGER AS $$
BEGIN
    ${decl.body}
END;
$$ LANGUAGE plpgsql;`);
}

function processEnum(decl: EnumDecl, ctx: GeneratorContext): void {
  generateEnumSql(decl, ctx);
}

function processStandaloneSchema(decl: SchemaDecl, ctx: GeneratorContext): void {
  // Standalone schemas are stored for mixin resolution
  ctx.schemas.set(decl.name, decl);
}

function processInstantiation(decl: Instantiation, ctx: GeneratorContext): void {
  const concept = ctx.concepts.get(decl.conceptName);

  if (!concept) {
    const schema = ctx.schemas.get(decl.conceptName);
    if (schema) {
      const target = decl.targets[0];
      if (target) {
        const tableName = target.tableName;
        ctx.tableToSchema.set(schema.name, tableName);
        const resolved = resolveSchema(schema, tableName, ctx);
        generateTableSql(resolved, ctx);
      }
    }
    return;
  }

  ctx.templateSubs.clear();
  for (let i = 0; i < concept.typeParams.length; i++) {
    const param = concept.typeParams[i];
    const arg = decl.typeArgs[i];
    if (param && arg) {
      // If alias is provided, use it as-is (preserve case)
      // If no alias, use snake_cased version of the parameter name
      ctx.templateSubs.set(param, arg.alias ?? toSnakeCase(param));
      // Also map the type parameter to the actual table name for foreign key resolution
      ctx.tableToSchema.set(param, arg.tableName);
    }
  }

  // Get the schemas in the concept in order
  const conceptSchemas = concept.members.filter((m): m is SchemaDecl => m.type === "SchemaDecl");

  // Map target names to schema positions
  // First, create schema-to-table mapping
  const schemaToTable = new Map<string, { name: string; alias?: string }>();

  for (let i = 0; i < decl.targets.length && i < conceptSchemas.length; i++) {
    const target = decl.targets[i];
    const schema = conceptSchemas[i];
    if (target && schema) {
      schemaToTable.set(schema.name, { name: target.tableName, alias: target.alias });
      ctx.tableToSchema.set(schema.name, target.tableName);

      // Also add template substitution for self-references like {Assessments}_id
      // If alias is provided, use it as-is. Otherwise, use snake_cased schema name
      if (target.alias) {
        ctx.templateSubs.set(schema.name, target.alias);
      } else {
        ctx.templateSubs.set(schema.name, toSnakeCase(schema.name));
      }
    }
  }

  // Generate enums from concept
  const conceptEnums = concept.members.filter((m): m is EnumDecl => m.type === "EnumDecl");
  for (const e of conceptEnums) {
    generateEnumSql(e, ctx);
  }

  // Generate tables from concept schemas
  for (const schema of conceptSchemas) {
    const mapping = schemaToTable.get(schema.name);
    if (mapping) {
      const resolved = resolveSchema(schema, mapping.name, ctx);
      generateTableSql(resolved, ctx);
    }
  }
}

function processPerInstanceIndex(decl: PerInstanceIndex, ctx: GeneratorContext): void {
  const columns = decl.columns.join(", ");
  const indexName = `idx_${decl.tableName}_${decl.columns.join("_")}`;
  const unique = decl.unique === true ? "UNIQUE " : "";
  const using = decl.using ? `USING ${decl.using} ` : "";

  ctx.perInstanceIndexSql.push(
    `CREATE ${unique}INDEX ${indexName} ON ${decl.tableName} ${using}(${columns});`
  );
}

// ============================================================================
// Main Generate Function
// ============================================================================

export function generate(ast: GSQLProgram): string {
  const ctx = createContext();

  // First pass: collect all definitions
  collectDefinitions(ast, ctx);

  // Second pass: process declarations in order
  for (const decl of ast.declarations) {
    processDeclaration(decl, ctx);
  }

  // Assemble final SQL
  const sections: string[] = [];

  if (ctx.extensionSql.length > 0) {
    sections.push(ctx.extensionSql.join("\n\n"));
  }

  if (ctx.functionSql.length > 0) {
    sections.push(ctx.functionSql.join("\n\n"));
  }

  if (ctx.enumSql.length > 0) {
    sections.push(ctx.enumSql.join("\n\n"));
  }

  // Tables with their indexes and triggers interleaved
  const tableWithIndexes: string[] = [];
  for (const table of ctx.tableSql) {
    if (table) {
      tableWithIndexes.push(table);
    }

    // Find matching indexes and triggers (by extracting table name)
    const tableMatch = table.match(/CREATE TABLE (\w+)/);
    if (tableMatch) {
      const tableName = tableMatch[1] ?? "";
      for (const idx of ctx.indexSql) {
        if (idx.includes(` ON ${tableName} `)) {
          tableWithIndexes.push(idx);
        }
      }
      for (const trg of ctx.triggerSql) {
        if (trg.includes(` ON ${tableName}`)) {
          tableWithIndexes.push(trg);
        }
      }
    }
  }

  if (tableWithIndexes.length > 0) {
    sections.push(tableWithIndexes.join("\n\n"));
  }

  // Per-instance indexes at the end
  if (ctx.perInstanceIndexSql.length > 0) {
    sections.push(ctx.perInstanceIndexSql.join("\n\n"));
  }

  return "-- Generated SQL from Schema DSL\n\n" + sections.join("\n\n") + "\n";
}

function processDeclaration(decl: TopLevelDeclaration, ctx: GeneratorContext): void {
  switch (decl.type) {
    case "ExtensionDecl":
      processExtension(decl, ctx);
      break;
    case "FunctionDecl":
      processFunction(decl, ctx);
      break;
    case "EnumDecl":
      processEnum(decl, ctx);
      break;
    case "SchemaDecl":
      processStandaloneSchema(decl, ctx);
      break;
    case "ConceptDecl":
      // Concepts are pre-collected, no processing needed here
      break;
    case "Instantiation":
      processInstantiation(decl, ctx);
      break;
    case "PerInstanceIndex":
      processPerInstanceIndex(decl, ctx);
      break;
  }
}
