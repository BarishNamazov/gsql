/**
 * GSQL Lexer
 *
 * Defines all tokens used in the GSQL language using Chevrotain.
 * Tokens are organized by category for clarity and maintainability.
 */

import { createToken, Lexer } from "chevrotain";

// ============================================================================
// Whitespace & Comments
// ============================================================================

export const WhiteSpace = createToken({
  name: "WhiteSpace",
  pattern: /\s+/,
  group: Lexer.SKIPPED,
});

export const LineComment = createToken({
  name: "LineComment",
  pattern: /\/\/[^\n]*/,
  group: Lexer.SKIPPED,
});

export const BlockComment = createToken({
  name: "BlockComment",
  pattern: /\/\*[\s\S]*?\*\//,
  group: Lexer.SKIPPED,
});

// ============================================================================
// Identifiers (must be defined first for longer_alt references)
// ============================================================================

export const Identifier = createToken({
  name: "Identifier",
  pattern: /[a-zA-Z_][a-zA-Z0-9_]*/,
});

export const TemplateIdentifier = createToken({
  name: "TemplateIdentifier",
  pattern: /\{[a-zA-Z_][a-zA-Z0-9_]*\}/,
});

// ============================================================================
// Keywords (use longer_alt to avoid conflicts)
// ============================================================================

export const Concept = createToken({
  name: "Concept",
  pattern: /concept/,
  longer_alt: Identifier,
});

export const Schema = createToken({
  name: "Schema",
  pattern: /schema/,
  longer_alt: Identifier,
});

export const Mixin = createToken({
  name: "Mixin",
  pattern: /mixin/,
  longer_alt: Identifier,
});

export const Enum = createToken({
  name: "Enum",
  pattern: /enum/,
  longer_alt: Identifier,
});

export const Extension = createToken({
  name: "Extension",
  pattern: /extension/,
  longer_alt: Identifier,
});

export const Function = createToken({
  name: "Function",
  pattern: /function/,
  longer_alt: Identifier,
});

export const Func = createToken({
  name: "Func",
  pattern: /func/,
  longer_alt: Identifier,
});

export const Trigger = createToken({
  name: "Trigger",
  pattern: /trigger/,
  longer_alt: Identifier,
});

export const Index = createToken({
  name: "Index",
  pattern: /index/,
  longer_alt: Identifier,
});

export const Check = createToken({
  name: "Check",
  pattern: /check/,
  longer_alt: Identifier,
});

export const Before = createToken({
  name: "Before",
  pattern: /before/,
  longer_alt: Identifier,
});

export const After = createToken({
  name: "After",
  pattern: /after/,
  longer_alt: Identifier,
});

export const Ondelete = createToken({
  name: "Ondelete",
  pattern: /ondelete/,
  longer_alt: Identifier,
});

export const On = createToken({
  name: "On",
  pattern: /on/,
  longer_alt: Identifier,
});

export const Each = createToken({
  name: "Each",
  pattern: /each/,
  longer_alt: Identifier,
});

export const Row = createToken({
  name: "Row",
  pattern: /row/,
  longer_alt: Identifier,
});

export const Statement = createToken({
  name: "Statement",
  pattern: /statement/,
  longer_alt: Identifier,
});

export const Execute = createToken({
  name: "Execute",
  pattern: /execute/,
  longer_alt: Identifier,
});

export const Unique = createToken({
  name: "Unique",
  pattern: /unique/,
  longer_alt: Identifier,
});

export const Gin = createToken({
  name: "Gin",
  pattern: /gin/,
  longer_alt: Identifier,
});

export const Gist = createToken({
  name: "Gist",
  pattern: /gist/,
  longer_alt: Identifier,
});

export const Btree = createToken({
  name: "Btree",
  pattern: /btree/,
  longer_alt: Identifier,
});

export const Hash = createToken({
  name: "Hash",
  pattern: /hash/,
  longer_alt: Identifier,
});

export const Pkey = createToken({
  name: "Pkey",
  pattern: /pkey/,
  longer_alt: Identifier,
});

export const Nonull = createToken({
  name: "Nonull",
  pattern: /nonull/,
  longer_alt: Identifier,
});

export const Default = createToken({
  name: "Default",
  pattern: /default/,
  longer_alt: Identifier,
});

export const Ref = createToken({
  name: "Ref",
  pattern: /ref/,
  longer_alt: Identifier,
});

export const Cascade = createToken({
  name: "Cascade",
  pattern: /cascade/,
  longer_alt: Identifier,
});

export const Restrict = createToken({
  name: "Restrict",
  pattern: /restrict/,
  longer_alt: Identifier,
});

export const SetNull = createToken({
  name: "SetNull",
  pattern: /setnull/,
  longer_alt: Identifier,
});

export const SetDefault = createToken({
  name: "SetDefault",
  pattern: /setdefault/,
  longer_alt: Identifier,
});

export const NoAction = createToken({
  name: "NoAction",
  pattern: /noaction/,
  longer_alt: Identifier,
});

export const Update = createToken({
  name: "Update",
  pattern: /update/,
  longer_alt: Identifier,
});

export const Insert = createToken({
  name: "Insert",
  pattern: /insert/,
  longer_alt: Identifier,
});

export const Delete = createToken({
  name: "Delete",
  pattern: /delete/,
  longer_alt: Identifier,
});

export const Return = createToken({
  name: "Return",
  pattern: /return/,
  longer_alt: Identifier,
});

export const New = createToken({
  name: "New",
  pattern: /NEW/,
  longer_alt: Identifier,
});

export const Old = createToken({
  name: "Old",
  pattern: /OLD/,
  longer_alt: Identifier,
});

// ============================================================================
// Data Types
// ============================================================================

export const Serial = createToken({
  name: "Serial",
  pattern: /serial/i,
  longer_alt: Identifier,
});

export const BigSerial = createToken({
  name: "BigSerial",
  pattern: /bigserial/i,
  longer_alt: Identifier,
});

export const Integer = createToken({
  name: "Integer",
  pattern: /integer/i,
  longer_alt: Identifier,
});

export const Bigint = createToken({
  name: "Bigint",
  pattern: /bigint/i,
  longer_alt: Identifier,
});

export const SmallInt = createToken({
  name: "SmallInt",
  pattern: /smallint/i,
  longer_alt: Identifier,
});

export const Text = createToken({
  name: "Text",
  pattern: /text/i,
  longer_alt: Identifier,
});

export const Varchar = createToken({
  name: "Varchar",
  pattern: /varchar/i,
  longer_alt: Identifier,
});

export const Char = createToken({
  name: "Char",
  pattern: /char/i,
  longer_alt: Identifier,
});

export const Boolean = createToken({
  name: "Boolean",
  pattern: /boolean/i,
  longer_alt: Identifier,
});

export const Timestamptz = createToken({
  name: "Timestamptz",
  pattern: /timestamptz/i,
  longer_alt: Identifier,
});

export const Timestamp = createToken({
  name: "Timestamp",
  pattern: /timestamp/i,
  longer_alt: Identifier,
});

export const Date = createToken({
  name: "Date",
  pattern: /date/i,
  longer_alt: Identifier,
});

export const Time = createToken({
  name: "Time",
  pattern: /time/i,
  longer_alt: Identifier,
});

export const Jsonb = createToken({
  name: "Jsonb",
  pattern: /jsonb/i,
  longer_alt: Identifier,
});

export const Json = createToken({
  name: "Json",
  pattern: /json/i,
  longer_alt: Identifier,
});

export const Uuid = createToken({
  name: "Uuid",
  pattern: /uuid/i,
  longer_alt: Identifier,
});

export const Inet = createToken({
  name: "Inet",
  pattern: /inet/i,
  longer_alt: Identifier,
});

export const Citext = createToken({
  name: "Citext",
  pattern: /citext/i,
  longer_alt: Identifier,
});

export const Decimal = createToken({
  name: "Decimal",
  pattern: /decimal/i,
  longer_alt: Identifier,
});

export const Numeric = createToken({
  name: "Numeric",
  pattern: /numeric/i,
  longer_alt: Identifier,
});

export const Real = createToken({
  name: "Real",
  pattern: /real/i,
  longer_alt: Identifier,
});

export const DoublePrecision = createToken({
  name: "DoublePrecision",
  pattern: /double\s+precision/i,
  longer_alt: Identifier,
});

export const Bytea = createToken({
  name: "Bytea",
  pattern: /bytea/i,
  longer_alt: Identifier,
});

// ============================================================================
// Literals
// ============================================================================

export const StringLiteral = createToken({
  name: "StringLiteral",
  pattern: /'(?:[^'\\]|\\.)*'/,
});

export const NumberLiteral = createToken({
  name: "NumberLiteral",
  pattern: /-?\d+(?:\.\d+)?/,
});

export const BooleanLiteral = createToken({
  name: "BooleanLiteral",
  pattern: /true|false/,
  longer_alt: Identifier,
});

export const NullLiteral = createToken({
  name: "NullLiteral",
  pattern: /null/i,
  longer_alt: Identifier,
});

// ============================================================================
// Operators & Punctuation
// ============================================================================

export const Arrow = createToken({
  name: "Arrow",
  pattern: /->/,
});

export const DoubleColon = createToken({
  name: "DoubleColon",
  pattern: /::/,
});

export const LBrace = createToken({
  name: "LBrace",
  pattern: /\{/,
});

export const RBrace = createToken({
  name: "RBrace",
  pattern: /\}/,
});

export const LParen = createToken({
  name: "LParen",
  pattern: /\(/,
});

export const RParen = createToken({
  name: "RParen",
  pattern: /\)/,
});

export const LBracket = createToken({
  name: "LBracket",
  pattern: /\[/,
});

export const RBracket = createToken({
  name: "RBracket",
  pattern: /\]/,
});

export const LAngle = createToken({
  name: "LAngle",
  pattern: /</,
});

export const RAngle = createToken({
  name: "RAngle",
  pattern: />/,
});

export const Semicolon = createToken({
  name: "Semicolon",
  pattern: /;/,
});

export const Comma = createToken({
  name: "Comma",
  pattern: /,/,
});

export const Dot = createToken({
  name: "Dot",
  pattern: /\./,
});

export const Equals = createToken({
  name: "Equals",
  pattern: /=/,
});

// ============================================================================
// Token Array (order matters - more specific patterns first)
// ============================================================================

export const allTokens = [
  // Whitespace and comments (highest priority, skipped)
  WhiteSpace,
  LineComment,
  BlockComment,

  // Multi-character operators
  Arrow,
  DoubleColon,

  // Keywords - longer ones first to avoid prefix matching issues
  Concept,
  Schema,
  Mixin,
  Enum,
  Extension,
  Function,
  Func,
  Trigger,
  Index,
  Check,
  Before,
  After,
  Ondelete,
  On,
  Each,
  Row,
  Statement,
  Execute,
  Unique,
  Gin,
  Gist,
  Btree,
  Hash,
  Pkey,
  Nonull,
  Default,
  Ref,
  SetDefault,
  SetNull,
  Cascade,
  Restrict,
  NoAction,
  Update,
  Insert,
  Delete,
  Return,
  New,
  Old,

  // Data types (longer ones first)
  DoublePrecision,
  Timestamptz,
  Timestamp,
  BigSerial,
  Serial,
  SmallInt,
  Bigint,
  Integer,
  Varchar,
  Char,
  Text,
  Boolean,
  Date,
  Time,
  Jsonb,
  Json,
  Uuid,
  Inet,
  Citext,
  Decimal,
  Numeric,
  Real,
  Bytea,

  // Literals
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  NullLiteral,

  // Template identifier (before regular Identifier)
  TemplateIdentifier,

  // Regular identifier (catch-all)
  Identifier,

  // Punctuation
  LBrace,
  RBrace,
  LParen,
  RParen,
  LBracket,
  RBracket,
  LAngle,
  RAngle,
  Semicolon,
  Comma,
  Dot,
  Equals,
];

// ============================================================================
// Create Lexer Instance
// ============================================================================

export const GSQLLexer = new Lexer(allTokens, {
  ensureOptimizations: true,
});

export function tokenize(input: string): ReturnType<typeof GSQLLexer.tokenize> {
  return GSQLLexer.tokenize(input);
}
