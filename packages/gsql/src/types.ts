/**
 * AST Type Definitions for GSQL
 *
 * These types define the structure of the Abstract Syntax Tree
 * produced by the parser.
 */

// ============================================================================
// Core Position Types
// ============================================================================

export interface Position {
  line: number;
  column: number;
  offset: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

// ============================================================================
// Base Node Type
// ============================================================================

interface BaseNode {
  location?: SourceLocation;
}

// ============================================================================
// Top-Level Declarations
// ============================================================================

export type TopLevelDeclaration =
  | ExtensionDecl
  | FunctionDecl
  | SchemaDecl
  | ConceptDecl
  | EnumDecl
  | Instantiation
  | PerInstanceIndex;

export interface GSQLProgram extends BaseNode {
  type: "Program";
  declarations: TopLevelDeclaration[];
}

export interface ExtensionDecl extends BaseNode {
  type: "ExtensionDecl";
  name: string;
}

export interface FunctionDecl extends BaseNode {
  type: "FunctionDecl";
  name: string;
  returnType: string;
  body: string;
}

export interface EnumDecl extends BaseNode {
  type: "EnumDecl";
  name: string;
  values: string[];
  conceptScope?: string;
}

export interface SchemaDecl extends BaseNode {
  type: "SchemaDecl";
  name: string;
  mixins: string[];
  members: SchemaBodyItem[];
  conceptScope?: string;
}

export interface ConceptDecl extends BaseNode {
  type: "ConceptDecl";
  name: string;
  typeParams: string[];
  members: (SchemaDecl | EnumDecl)[];
}

export interface Instantiation extends BaseNode {
  type: "Instantiation";
  targets: InstantiationTarget[];
  conceptName: string;
  typeArgs: TypeArg[];
}

export interface InstantiationTarget {
  tableName: string;
  alias?: string;
}

export interface TypeArg {
  tableName: string;
  alias?: string;
}

export interface PerInstanceIndex extends BaseNode {
  type: "PerInstanceIndex";
  tableName: string;
  columns: string[];
  unique?: boolean;
  using?: string;
}

// ============================================================================
// Schema Body Items
// ============================================================================

export type SchemaBodyItem = ColumnDef | IndexDef | CheckDef | TriggerDef;

export interface ColumnDef extends BaseNode {
  type: "ColumnDef";
  name: string;
  dataType: string;
  constraints: ColumnConstraint[];
}

export interface ColumnConstraint {
  type: "PrimaryKey" | "NotNull" | "Unique" | "Default" | "Reference" | "Check" | "OnDelete";
  value?: string;
  table?: string;
  column?: string;
  action?: string;
}

export interface IndexDef extends BaseNode {
  type: "IndexDef";
  columns: string[];
  unique?: boolean;
  using?: string;
}

export interface CheckDef extends BaseNode {
  type: "CheckDef";
  expression: string;
}

export interface TriggerDef extends BaseNode {
  type: "TriggerDef";
  name: string;
  timing: "before" | "after";
  event: string;
  forEach: "row" | "statement";
  executeFunction: string;
}

// ============================================================================
// Compiler Types
// ============================================================================

export interface CompileError {
  message: string;
  location?: SourceLocation;
  severity: "error" | "warning";
}

export interface CompileResult {
  success: boolean;
  sql?: string;
  errors: CompileError[];
  ast?: GSQLProgram;
}
