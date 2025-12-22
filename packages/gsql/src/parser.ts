/**
 * GSQL Parser
 *
 * Builds an Abstract Syntax Tree from GSQL source code using Chevrotain.
 * The parser is designed to be elegant and easy to extend.
 */

import { CstParser } from "chevrotain";
import type { CstNode } from "chevrotain";
import {
  allTokens,
  tokenize,
  // Keywords
  Concept,
  Schema,
  Mixin,
  Enum,
  Extension,
  Func,
  Trigger,
  Index,
  Check,
  Before,
  After,
  On,
  Each,
  Row,
  Statement,
  Execute,
  Where,
  Function,
  Unique,
  Gin,
  Gist,
  Btree,
  Hash,
  Pkey,
  Nonull,
  Default,
  Ref,
  Ondelete,
  Cascade,
  Restrict,
  SetNull,
  SetDefault,
  NoAction,
  Update,
  Insert,
  Delete,
  Return,
  New,
  Old,
  // Data types
  Serial,
  BigSerial,
  Integer,
  Bigint,
  SmallInt,
  Text,
  Varchar,
  Char,
  Boolean,
  Timestamptz,
  Timestamp,
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
  DoublePrecision,
  Bytea,
  // Literals
  StringLiteral,
  NumberLiteral,
  BooleanLiteral,
  NullLiteral,
  // Identifiers
  TemplateIdentifier,
  Identifier,
  // Punctuation
  Arrow,
  DoubleColon,
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
} from "./lexer.ts";
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
  ColumnConstraint,
  CompileError,
  InstantiationTarget,
  TypeArg,
} from "./types.ts";

// ============================================================================
// CST Parser Definition
// ============================================================================

class GSQLCstParser extends CstParser {
  constructor() {
    super(allTokens, {
      recoveryEnabled: true,
      maxLookahead: 3,
    });
    this.performSelfAnalysis();
  }

  // Helper rule: any token that can act as an identifier
  // This allows keywords to be used as identifiers when contextually appropriate
  // (e.g., enum values, column names, function names)
  private anyIdentifier = this.RULE("anyIdentifier", () => {
    this.OR([
      // Regular identifier
      { ALT: () => this.CONSUME(Identifier) },
      // Declaration keywords
      { ALT: () => this.CONSUME(Concept) },
      { ALT: () => this.CONSUME(Schema) },
      { ALT: () => this.CONSUME(Mixin) },
      { ALT: () => this.CONSUME(Enum) },
      { ALT: () => this.CONSUME(Extension) },
      { ALT: () => this.CONSUME(Func) },
      { ALT: () => this.CONSUME(Trigger) },
      // Statement keywords
      { ALT: () => this.CONSUME(Index) },
      { ALT: () => this.CONSUME(Check) },
      { ALT: () => this.CONSUME(Before) },
      { ALT: () => this.CONSUME(After) },
      { ALT: () => this.CONSUME(On) },
      { ALT: () => this.CONSUME(Each) },
      { ALT: () => this.CONSUME(Row) },
      { ALT: () => this.CONSUME(Statement) },
      { ALT: () => this.CONSUME(Execute) },
      { ALT: () => this.CONSUME(Function) },
      { ALT: () => this.CONSUME(Return) },
      { ALT: () => this.CONSUME(New) },
      { ALT: () => this.CONSUME(Old) },
      // Operation keywords
      { ALT: () => this.CONSUME(Update) },
      { ALT: () => this.CONSUME(Insert) },
      { ALT: () => this.CONSUME(Delete) },
      // Constraint keywords
      { ALT: () => this.CONSUME(Unique) },
      { ALT: () => this.CONSUME(Pkey) },
      { ALT: () => this.CONSUME(Nonull) },
      { ALT: () => this.CONSUME(Default) },
      { ALT: () => this.CONSUME(Ref) },
      { ALT: () => this.CONSUME(Ondelete) },
      { ALT: () => this.CONSUME(Cascade) },
      { ALT: () => this.CONSUME(Restrict) },
      { ALT: () => this.CONSUME(SetNull) },
      { ALT: () => this.CONSUME(SetDefault) },
      { ALT: () => this.CONSUME(NoAction) },
      // Index types
      { ALT: () => this.CONSUME(Gin) },
      { ALT: () => this.CONSUME(Gist) },
      { ALT: () => this.CONSUME(Btree) },
      { ALT: () => this.CONSUME(Hash) },
      // Index modifiers
      { ALT: () => this.CONSUME(Where) },
      // Data types
      { ALT: () => this.CONSUME(Serial) },
      { ALT: () => this.CONSUME(BigSerial) },
      { ALT: () => this.CONSUME(Integer) },
      { ALT: () => this.CONSUME(Bigint) },
      { ALT: () => this.CONSUME(SmallInt) },
      { ALT: () => this.CONSUME(Text) },
      { ALT: () => this.CONSUME(Varchar) },
      { ALT: () => this.CONSUME(Char) },
      { ALT: () => this.CONSUME(Boolean) },
      { ALT: () => this.CONSUME(Timestamptz) },
      { ALT: () => this.CONSUME(Timestamp) },
      { ALT: () => this.CONSUME(Date) },
      { ALT: () => this.CONSUME(Time) },
      { ALT: () => this.CONSUME(Jsonb) },
      { ALT: () => this.CONSUME(Json) },
      { ALT: () => this.CONSUME(Uuid) },
      { ALT: () => this.CONSUME(Inet) },
      { ALT: () => this.CONSUME(Citext) },
      { ALT: () => this.CONSUME(Decimal) },
      { ALT: () => this.CONSUME(Numeric) },
      { ALT: () => this.CONSUME(Real) },
      { ALT: () => this.CONSUME(DoublePrecision) },
      { ALT: () => this.CONSUME(Bytea) },
    ]);
  });

  // Top-level program
  public program = this.RULE("program", () => {
    this.MANY(() => {
      this.SUBRULE(this.topLevelDeclaration);
    });
  });

  // Top-level declarations
  private topLevelDeclaration = this.RULE("topLevelDeclaration", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.extensionDecl) },
      { ALT: () => this.SUBRULE(this.functionDecl) },
      { ALT: () => this.SUBRULE(this.conceptDecl) },
      { ALT: () => this.SUBRULE(this.enumDecl) },
      { ALT: () => this.SUBRULE(this.schemaDecl) },
      { ALT: () => this.SUBRULE(this.instantiation) },
      { ALT: () => this.SUBRULE(this.perInstanceIndex) },
    ]);
  });

  // extension citext;
  private extensionDecl = this.RULE("extensionDecl", () => {
    this.CONSUME(Extension);
    this.SUBRULE(this.anyIdentifier);
    this.CONSUME(Semicolon);
  });

  // func name() -> trigger { ... }
  private functionDecl = this.RULE("functionDecl", () => {
    this.CONSUME(Func);
    this.SUBRULE(this.anyIdentifier);
    this.CONSUME(LParen);
    this.CONSUME(RParen);
    this.CONSUME(Arrow);
    this.SUBRULE2(this.anyIdentifier); // return type
    this.SUBRULE(this.functionBody);
  });

  private functionBody = this.RULE("functionBody", () => {
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.functionStatement);
    });
    this.CONSUME(RBrace);
  });

  private functionStatement = this.RULE("functionStatement", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.returnStatement) },
      { ALT: () => this.SUBRULE(this.assignmentStatement) },
    ]);
  });

  private returnStatement = this.RULE("returnStatement", () => {
    this.CONSUME(Return);
    this.OR([
      { ALT: () => this.CONSUME(New) },
      { ALT: () => this.CONSUME(Old) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
    this.CONSUME(Semicolon);
  });

  private assignmentStatement = this.RULE("assignmentStatement", () => {
    this.OR([
      { ALT: () => this.CONSUME(New) },
      { ALT: () => this.CONSUME(Old) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
    this.CONSUME(Dot);
    this.SUBRULE(this.anyIdentifier); // field name
    this.CONSUME(Equals);
    this.SUBRULE(this.functionCallExpr);
    this.CONSUME(Semicolon);
  });

  private functionCallExpr = this.RULE("functionCallExpr", () => {
    this.CONSUME(Identifier);
    this.CONSUME(LParen);
    this.CONSUME(RParen);
  });

  // concept Name<TypeParams> { ... }
  private conceptDecl = this.RULE("conceptDecl", () => {
    this.CONSUME(Concept);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.SUBRULE(this.typeParamList);
    });
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.SUBRULE(this.enumDecl) },
        { ALT: () => this.SUBRULE(this.schemaDecl) },
      ]);
    });
    this.CONSUME(RBrace);
  });

  private typeParamList = this.RULE("typeParamList", () => {
    this.CONSUME(LAngle);
    this.CONSUME(Identifier);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.CONSUME2(Identifier);
    });
    this.CONSUME(RAngle);
  });

  // enum name { value1; value2; ... }
  private enumDecl = this.RULE("enumDecl", () => {
    this.CONSUME(Enum);
    this.SUBRULE(this.anyIdentifier);
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE2(this.anyIdentifier);
      this.CONSUME(Semicolon);
    });
    this.CONSUME(RBrace);
  });

  // schema Name mixin M1, M2 { ... }
  private schemaDecl = this.RULE("schemaDecl", () => {
    this.CONSUME(Schema);
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.SUBRULE(this.mixinList);
    });
    this.CONSUME(LBrace);
    this.MANY(() => {
      this.SUBRULE(this.schemaBodyItem);
    });
    this.CONSUME(RBrace);
  });

  private mixinList = this.RULE("mixinList", () => {
    this.CONSUME(Mixin);
    this.CONSUME(Identifier);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.CONSUME2(Identifier);
    });
  });

  private schemaBodyItem = this.RULE("schemaBodyItem", () => {
    this.OR([
      { ALT: () => this.SUBRULE(this.indexDef) },
      { ALT: () => this.SUBRULE(this.checkDef) },
      { ALT: () => this.SUBRULE(this.triggerDef) },
      { ALT: () => this.SUBRULE(this.columnDef) },
    ]);
  });

  // Column definition: name type constraints;
  private columnDef = this.RULE("columnDef", () => {
    this.SUBRULE(this.columnName);
    this.SUBRULE(this.dataType);
    this.MANY(() => {
      this.SUBRULE(this.columnConstraint);
    });
    this.CONSUME(Semicolon);
  });

  private columnName = this.RULE("columnName", () => {
    this.OR([
      {
        ALT: () => {
          this.CONSUME(TemplateIdentifier);
          this.OPTION(() => {
            this.CONSUME(Identifier); // suffix after template, e.g., {target}_id
          });
        },
      },
      { ALT: () => this.CONSUME2(Identifier) },
    ]);
  });

  private dataType = this.RULE("dataType", () => {
    this.OR([
      { ALT: () => this.CONSUME(Serial) },
      { ALT: () => this.CONSUME(BigSerial) },
      { ALT: () => this.CONSUME(Integer) },
      { ALT: () => this.CONSUME(Bigint) },
      { ALT: () => this.CONSUME(SmallInt) },
      { ALT: () => this.CONSUME(Text) },
      { ALT: () => this.CONSUME(Varchar) },
      { ALT: () => this.CONSUME(Char) },
      { ALT: () => this.CONSUME(Boolean) },
      { ALT: () => this.CONSUME(Timestamptz) },
      { ALT: () => this.CONSUME(Timestamp) },
      { ALT: () => this.CONSUME(Date) },
      { ALT: () => this.CONSUME(Time) },
      { ALT: () => this.CONSUME(Jsonb) },
      { ALT: () => this.CONSUME(Json) },
      { ALT: () => this.CONSUME(Uuid) },
      { ALT: () => this.CONSUME(Inet) },
      { ALT: () => this.CONSUME(Citext) },
      { ALT: () => this.CONSUME(Decimal) },
      { ALT: () => this.CONSUME(Numeric) },
      { ALT: () => this.CONSUME(Real) },
      { ALT: () => this.CONSUME(DoublePrecision) },
      { ALT: () => this.CONSUME(Bytea) },
      { ALT: () => this.CONSUME(Identifier) }, // custom types like enums
    ]);
    this.OPTION(() => {
      this.CONSUME(LParen);
      this.CONSUME(NumberLiteral);
      this.CONSUME(RParen);
    });
  });

  private columnConstraint = this.RULE("columnConstraint", () => {
    this.OR([
      { ALT: () => this.CONSUME(Pkey) },
      { ALT: () => this.CONSUME(Nonull) },
      { ALT: () => this.CONSUME(Unique) },
      { ALT: () => this.SUBRULE(this.defaultConstraint) },
      { ALT: () => this.SUBRULE(this.refConstraint) },
      { ALT: () => this.SUBRULE(this.checkConstraint) },
      { ALT: () => this.SUBRULE(this.onDeleteConstraint) },
    ]);
  });

  private defaultConstraint = this.RULE("defaultConstraint", () => {
    this.CONSUME(Default);
    this.CONSUME(LParen);
    this.SUBRULE(this.defaultValue);
    this.CONSUME(RParen);
  });

  private defaultValue = this.RULE("defaultValue", () => {
    this.OR([
      { ALT: () => this.CONSUME(StringLiteral) },
      { ALT: () => this.CONSUME(NumberLiteral) },
      { ALT: () => this.CONSUME(BooleanLiteral) },
      { ALT: () => this.CONSUME(NullLiteral) },
      { ALT: () => this.SUBRULE(this.functionCallExpr) },
      {
        ALT: () => {
          // Qualified enum value: enum_type::value
          this.SUBRULE(this.anyIdentifier);
          this.CONSUME(DoubleColon);
          this.SUBRULE2(this.anyIdentifier);
        },
      },
      { ALT: () => this.SUBRULE3(this.anyIdentifier) }, // enum value or other keyword
    ]);
  });

  private refConstraint = this.RULE("refConstraint", () => {
    this.CONSUME(Ref);
    this.CONSUME(LParen);
    this.CONSUME(Identifier); // table
    this.CONSUME(Dot);
    this.CONSUME2(Identifier); // column
    this.CONSUME(RParen);
  });

  private checkConstraint = this.RULE("checkConstraint", () => {
    this.CONSUME(Check);
    this.CONSUME(LParen);
    this.SUBRULE(this.checkExpression);
    this.CONSUME(RParen);
  });

  private checkExpression = this.RULE("checkExpression", () => {
    // Consume balanced parentheses with any content
    this.MANY(() => {
      this.OR([
        {
          ALT: () => {
            this.CONSUME(LParen);
            this.SUBRULE(this.checkExpression);
            this.CONSUME(RParen);
          },
        },
        { ALT: () => this.CONSUME(Identifier) },
        { ALT: () => this.CONSUME(TemplateIdentifier) },
        { ALT: () => this.CONSUME(NumberLiteral) },
        { ALT: () => this.CONSUME(StringLiteral) },
        { ALT: () => this.CONSUME(BooleanLiteral) },
        { ALT: () => this.CONSUME(NullLiteral) },
        { ALT: () => this.CONSUME(DoubleColon) },
        { ALT: () => this.CONSUME(Equals) },
        { ALT: () => this.CONSUME(Comma) },
        { ALT: () => this.CONSUME(Dot) },
        { ALT: () => this.CONSUME(LAngle) },
        { ALT: () => this.CONSUME(RAngle) },
      ]);
    });
  });

  private onDeleteConstraint = this.RULE("onDeleteConstraint", () => {
    this.CONSUME(Ondelete);
    this.CONSUME(LParen);
    this.OR([
      { ALT: () => this.CONSUME(Cascade) },
      { ALT: () => this.CONSUME(Restrict) },
      { ALT: () => this.CONSUME(SetNull) },
      { ALT: () => this.CONSUME(SetDefault) },
      { ALT: () => this.CONSUME(NoAction) },
    ]);
    this.CONSUME(RParen);
  });

  // index(col1, col2) unique gin where (condition);
  private indexDef = this.RULE("indexDef", () => {
    this.CONSUME(Index);
    this.CONSUME(LParen);
    this.SUBRULE(this.indexColumnList);
    this.CONSUME(RParen);
    this.MANY(() => {
      this.OR([
        { ALT: () => this.CONSUME(Unique) },
        { ALT: () => this.CONSUME(Gin) },
        { ALT: () => this.CONSUME(Gist) },
        { ALT: () => this.CONSUME(Btree) },
        { ALT: () => this.CONSUME(Hash) },
      ]);
    });
    this.OPTION(() => {
      this.SUBRULE(this.whereClause);
    });
    this.CONSUME(Semicolon);
  });

  // where (expression)
  private whereClause = this.RULE("whereClause", () => {
    this.CONSUME(Where);
    this.CONSUME(LParen);
    this.SUBRULE(this.checkExpression);
    this.CONSUME(RParen);
  });

  private indexColumnList = this.RULE("indexColumnList", () => {
    this.SUBRULE(this.indexColumn);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.indexColumn);
    });
  });

  private indexColumn = this.RULE("indexColumn", () => {
    this.OR([
      { ALT: () => this.CONSUME(TemplateIdentifier) },
      { ALT: () => this.CONSUME(Identifier) },
    ]);
    this.OPTION(() => {
      this.CONSUME2(Identifier); // suffix after template
    });
  });

  // check(expression);
  private checkDef = this.RULE("checkDef", () => {
    this.CONSUME(Check);
    this.CONSUME(LParen);
    this.SUBRULE(this.checkExpression);
    this.CONSUME(RParen);
    this.CONSUME(Semicolon);
  });

  // trigger name before update on each row execute function fn();
  private triggerDef = this.RULE("triggerDef", () => {
    this.CONSUME(Trigger);
    this.CONSUME(Identifier); // name
    this.OR([{ ALT: () => this.CONSUME(Before) }, { ALT: () => this.CONSUME(After) }]);
    this.OR2([
      { ALT: () => this.CONSUME(Update) },
      { ALT: () => this.CONSUME(Insert) },
      { ALT: () => this.CONSUME(Delete) },
    ]);
    this.CONSUME(On);
    this.CONSUME(Each);
    this.OR3([{ ALT: () => this.CONSUME(Row) }, { ALT: () => this.CONSUME(Statement) }]);
    this.CONSUME(Execute);
    this.CONSUME(Function);
    this.CONSUME2(Identifier); // function name
    this.CONSUME(LParen);
    this.CONSUME(RParen);
    this.CONSUME(Semicolon);
  });

  // table_name = ConceptName<Type1, Type2>;
  // Or: table1, table2 = ConceptName<Type>;
  // Or: table1[alias], table2 = ConceptName<Type[alias]>;
  private instantiation = this.RULE("instantiation", () => {
    this.SUBRULE(this.instantiationTargetList);
    this.CONSUME(Equals);
    this.SUBRULE(this.conceptReference);
    this.CONSUME(Semicolon);
  });

  private instantiationTargetList = this.RULE("instantiationTargetList", () => {
    this.SUBRULE(this.instantiationTarget);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.instantiationTarget);
    });
  });

  private instantiationTarget = this.RULE("instantiationTarget", () => {
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LBracket);
      this.CONSUME2(Identifier);
      this.CONSUME(RBracket);
    });
  });

  private conceptReference = this.RULE("conceptReference", () => {
    this.CONSUME(Identifier); // concept name
    this.OPTION(() => {
      this.CONSUME(LAngle);
      this.SUBRULE(this.typeArgList);
      this.CONSUME(RAngle);
    });
  });

  private typeArgList = this.RULE("typeArgList", () => {
    this.SUBRULE(this.typeArg);
    this.MANY(() => {
      this.CONSUME(Comma);
      this.SUBRULE2(this.typeArg);
    });
  });

  private typeArg = this.RULE("typeArg", () => {
    this.CONSUME(Identifier);
    this.OPTION(() => {
      this.CONSUME(LBracket);
      this.CONSUME2(Identifier);
      this.CONSUME(RBracket);
    });
  });

  // index(table, column) unique where (condition);
  private perInstanceIndex = this.RULE("perInstanceIndex", () => {
    this.CONSUME(Index);
    this.CONSUME(LParen);
    this.CONSUME(Identifier); // table
    this.CONSUME(Comma);
    this.CONSUME2(Identifier); // column
    this.MANY(() => {
      this.CONSUME2(Comma);
      this.CONSUME3(Identifier);
    });
    this.CONSUME(RParen);
    this.MANY2(() => {
      this.OR([
        { ALT: () => this.CONSUME(Unique) },
        { ALT: () => this.CONSUME(Gin) },
        { ALT: () => this.CONSUME(Gist) },
        { ALT: () => this.CONSUME(Btree) },
        { ALT: () => this.CONSUME(Hash) },
      ]);
    });
    this.OPTION(() => {
      this.SUBRULE(this.whereClause);
    });
    this.CONSUME(Semicolon);
  });
}

// ============================================================================
// CST to AST Visitor
// ============================================================================

const parserInstance = new GSQLCstParser();

function extractImage(node: CstNode, tokenType: string): string {
  const tokens = node.children[tokenType];
  if (tokens && tokens.length > 0) {
    const token = tokens[0];
    if (token && "image" in token) {
      return token.image;
    }
  }
  return "";
}

function extractAllImages(node: CstNode, tokenType: string): string[] {
  const tokens = node.children[tokenType];
  if (!tokens) return [];
  return tokens.map((t) => ("image" in t ? t.image : "")).filter((s) => s !== "");
}

function extractChild(node: CstNode, childName: string): CstNode | undefined {
  const children = node.children[childName];
  const firstChild = children?.[0];
  if (firstChild && "children" in firstChild) {
    return firstChild;
  }
  return undefined;
}

function extractChildren(node: CstNode, childName: string): CstNode[] {
  const children = node.children[childName];
  if (!children) return [];
  return children.filter((c): c is CstNode => "children" in c);
}

// Extract image from anyIdentifier rule (which can match many token types)
function extractAnyIdentifier(node: CstNode): string {
  const anyIdNodes = extractChildren(node, "anyIdentifier");
  const anyIdNode = anyIdNodes[0];
  if (anyIdNode) {
    // Look through all children of anyIdentifier for a token with an image
    for (const key of Object.keys(anyIdNode.children)) {
      const tokens = anyIdNode.children[key];
      const firstToken = tokens?.[0];
      if (firstToken && "image" in firstToken) {
        return firstToken.image;
      }
    }
  }
  return "";
}

function extractAllAnyIdentifiers(node: CstNode): string[] {
  const anyIdNodes = extractChildren(node, "anyIdentifier");
  const result: string[] = [];
  for (const anyIdNode of anyIdNodes) {
    for (const key of Object.keys(anyIdNode.children)) {
      const tokens = anyIdNode.children[key];
      const firstToken = tokens?.[0];
      if (firstToken && "image" in firstToken) {
        result.push(firstToken.image);
        break;
      }
    }
  }
  return result;
}

class CstToAstVisitor {
  visit(cst: CstNode): GSQLProgram {
    const declarations: TopLevelDeclaration[] = [];
    const topLevelDecls = extractChildren(cst, "topLevelDeclaration");

    for (const decl of topLevelDecls) {
      const parsed = this.visitTopLevelDeclaration(decl);
      if (parsed) {
        declarations.push(parsed);
      }
    }

    return {
      type: "Program",
      declarations,
    };
  }

  private visitTopLevelDeclaration(node: CstNode): TopLevelDeclaration | null {
    const extension = extractChild(node, "extensionDecl");
    if (extension) return this.visitExtensionDecl(extension);

    const func = extractChild(node, "functionDecl");
    if (func) return this.visitFunctionDecl(func);

    const concept = extractChild(node, "conceptDecl");
    if (concept) return this.visitConceptDecl(concept);

    const enumDecl = extractChild(node, "enumDecl");
    if (enumDecl) return this.visitEnumDecl(enumDecl);

    const schema = extractChild(node, "schemaDecl");
    if (schema) return this.visitSchemaDecl(schema);

    const instantiation = extractChild(node, "instantiation");
    if (instantiation) return this.visitInstantiation(instantiation);

    const perInstanceIndex = extractChild(node, "perInstanceIndex");
    if (perInstanceIndex) return this.visitPerInstanceIndex(perInstanceIndex);

    return null;
  }

  private visitExtensionDecl(node: CstNode): ExtensionDecl {
    return {
      type: "ExtensionDecl",
      name: extractAnyIdentifier(node),
    };
  }

  private visitFunctionDecl(node: CstNode): FunctionDecl {
    const identifiers = extractAllAnyIdentifiers(node);
    const name = identifiers[0] ?? "";
    const returnType = identifiers[1] ?? "";

    const bodyNode = extractChild(node, "functionBody");
    let body = "";

    if (bodyNode) {
      const statements = extractChildren(bodyNode, "functionStatement");
      const parts: string[] = [];

      for (const stmt of statements) {
        const returnStmt = extractChild(stmt, "returnStatement");
        if (returnStmt) {
          // Could be New, Old, or Identifier token
          let id = extractImage(returnStmt, "Identifier");
          if (!id) id = extractImage(returnStmt, "New");
          if (!id) id = extractImage(returnStmt, "Old");
          parts.push(`RETURN ${id};`);
        }

        const assignStmt = extractChild(stmt, "assignmentStatement");
        if (assignStmt) {
          // Object could be New, Old, or Identifier
          let obj = extractImage(assignStmt, "Identifier");
          if (!obj) obj = extractImage(assignStmt, "New");
          if (!obj) obj = extractImage(assignStmt, "Old");
          // Field is from anyIdentifier subrule
          const field = extractAnyIdentifier(assignStmt);
          const funcCallNode = extractChild(assignStmt, "functionCallExpr");
          const funcName = funcCallNode ? extractImage(funcCallNode, "Identifier") : "";
          parts.push(`${obj}.${field} := ${funcName}();`);
        }
      }
      body = parts.join("\n    ");
    }

    return {
      type: "FunctionDecl",
      name,
      returnType,
      body,
    };
  }

  private visitConceptDecl(node: CstNode): ConceptDecl {
    const name = extractImage(node, "Identifier");
    const typeParams: string[] = [];

    const typeParamListNode = extractChild(node, "typeParamList");
    if (typeParamListNode) {
      typeParams.push(...extractAllImages(typeParamListNode, "Identifier"));
    }

    const members: (SchemaDecl | EnumDecl)[] = [];

    const schemas = extractChildren(node, "schemaDecl");
    for (const schema of schemas) {
      const s = this.visitSchemaDecl(schema);
      s.conceptScope = name;
      members.push(s);
    }

    const enums = extractChildren(node, "enumDecl");
    for (const e of enums) {
      const en = this.visitEnumDecl(e);
      en.conceptScope = name;
      members.push(en);
    }

    return {
      type: "ConceptDecl",
      name,
      typeParams,
      members,
    };
  }

  private visitEnumDecl(node: CstNode): EnumDecl {
    const identifiers = extractAllAnyIdentifiers(node);
    const name = identifiers[0] ?? "";
    const values = identifiers.slice(1);

    return {
      type: "EnumDecl",
      name,
      values,
    };
  }

  private visitSchemaDecl(node: CstNode): SchemaDecl {
    const name = extractImage(node, "Identifier");
    const mixins: string[] = [];

    const mixinListNode = extractChild(node, "mixinList");
    if (mixinListNode) {
      mixins.push(...extractAllImages(mixinListNode, "Identifier"));
    }

    const members: SchemaBodyItem[] = [];
    const bodyItems = extractChildren(node, "schemaBodyItem");

    for (const item of bodyItems) {
      const parsed = this.visitSchemaBodyItem(item);
      if (parsed) {
        members.push(parsed);
      }
    }

    return {
      type: "SchemaDecl",
      name,
      mixins,
      members,
    };
  }

  private visitSchemaBodyItem(node: CstNode): SchemaBodyItem | null {
    const column = extractChild(node, "columnDef");
    if (column) return this.visitColumnDef(column);

    const index = extractChild(node, "indexDef");
    if (index) return this.visitIndexDef(index);

    const check = extractChild(node, "checkDef");
    if (check) return this.visitCheckDef(check);

    const trigger = extractChild(node, "triggerDef");
    if (trigger) return this.visitTriggerDef(trigger);

    return null;
  }

  private visitColumnDef(node: CstNode): ColumnDef {
    const colNameNode = extractChild(node, "columnName");
    let name = "";

    if (colNameNode) {
      const template = extractImage(colNameNode, "TemplateIdentifier");
      const id = extractImage(colNameNode, "Identifier");
      name = template ? template + id : id;
    }

    const dataTypeNode = extractChild(node, "dataType");
    let dataType = "";

    if (dataTypeNode) {
      // Get the first token in dataType
      for (const key of Object.keys(dataTypeNode.children)) {
        const tokens = dataTypeNode.children[key];
        const firstToken = tokens?.[0];
        if (firstToken && "image" in firstToken) {
          dataType = firstToken.image;
          break;
        }
      }

      // Check for size parameter
      const sizeTokens = dataTypeNode.children["NumberLiteral"];
      const firstSizeToken = sizeTokens?.[0];
      if (firstSizeToken && "image" in firstSizeToken) {
        dataType += `(${firstSizeToken.image})`;
      }
    }

    const constraints: ColumnConstraint[] = [];
    const constraintNodes = extractChildren(node, "columnConstraint");

    for (const c of constraintNodes) {
      const constraint = this.visitColumnConstraint(c);
      if (constraint) {
        constraints.push(constraint);
      }
    }

    return {
      type: "ColumnDef",
      name,
      dataType,
      constraints,
    };
  }

  private visitColumnConstraint(node: CstNode): ColumnConstraint | null {
    if (node.children["Pkey"]) return { type: "PrimaryKey" };
    if (node.children["Nonull"]) return { type: "NotNull" };
    if (node.children["Unique"]) return { type: "Unique" };

    const defaultNode = extractChild(node, "defaultConstraint");
    if (defaultNode) {
      const valueNode = extractChild(defaultNode, "defaultValue");
      let value = "";

      if (valueNode) {
        const strLit = extractImage(valueNode, "StringLiteral");
        const numLit = extractImage(valueNode, "NumberLiteral");
        const boolLit = extractImage(valueNode, "BooleanLiteral");
        const nullLit = extractImage(valueNode, "NullLiteral");
        const funcCall = extractChild(valueNode, "functionCallExpr");
        const doubleColon = extractImage(valueNode, "DoubleColon");
        const anyIds = extractAllAnyIdentifiers(valueNode);

        if (strLit) value = strLit;
        else if (numLit) value = numLit;
        else if (boolLit) value = boolLit;
        else if (nullLit) value = nullLit;
        else if (funcCall) value = extractImage(funcCall, "Identifier") + "()";
        else if (doubleColon && anyIds.length === 2 && anyIds[0] && anyIds[1]) {
          // Qualified enum value: type::value
          value = `${anyIds[0]}::${anyIds[1]}`;
        } else if (anyIds.length > 0 && anyIds[0]) value = anyIds[0];
      }

      return { type: "Default", value };
    }

    const refNode = extractChild(node, "refConstraint");
    if (refNode) {
      const ids = extractAllImages(refNode, "Identifier");
      return { type: "Reference", table: ids[0] ?? "", column: ids[1] ?? "" };
    }

    const checkNode = extractChild(node, "checkConstraint");
    if (checkNode) {
      const exprNode = extractChild(checkNode, "checkExpression");
      const value = exprNode ? this.reconstructCheckExpression(exprNode) : "";
      return { type: "Check", value };
    }

    const onDeleteNode = extractChild(node, "onDeleteConstraint");
    if (onDeleteNode) {
      const actionMap: Record<string, string> = {
        Cascade: "CASCADE",
        Restrict: "RESTRICT",
        SetNull: "SET NULL",
        SetDefault: "SET DEFAULT",
        NoAction: "NO ACTION",
      };
      for (const [key, action] of Object.entries(actionMap)) {
        if (onDeleteNode.children[key]) {
          return { type: "OnDelete", action };
        }
      }
    }

    return null;
  }

  private reconstructCheckExpression(node: CstNode): string {
    // Collect all tokens/nodes with their positions
    const tokens: {
      image: string;
      startOffset: number;
      isParenExpr: boolean;
    }[] = [];

    for (const key of Object.keys(node.children)) {
      const children = node.children[key];
      if (!children) continue;

      for (const child of children) {
        if ("image" in child && "startOffset" in child) {
          // It's a token
          const startOffset = typeof child.startOffset === "number" ? child.startOffset : 0;
          tokens.push({
            image: child.image,
            startOffset,
            isParenExpr: false,
          });
        } else if ("children" in child && key === "checkExpression") {
          // It's a nested checkExpression - recursively reconstruct it
          // Note: The LParen and RParen tokens from the grammar rule are collected
          // separately as tokens in the parent, so we don't wrap the result here
          const inner = this.reconstructCheckExpression(child);
          if (inner) {
            // Get the position from the first token in the child
            let minOffset = Infinity;
            for (const childKey of Object.keys(child.children)) {
              const childChildren = child.children[childKey];
              if (childChildren) {
                for (const c of childChildren) {
                  if ("startOffset" in c && typeof c.startOffset === "number") {
                    minOffset = Math.min(minOffset, c.startOffset);
                  }
                }
              }
            }
            tokens.push({
              image: inner,
              startOffset: minOffset === Infinity ? 0 : minOffset,
              isParenExpr: false,
            });
          }
        }
      }
    }

    // Sort tokens by their position in the source
    tokens.sort((a, b) => a.startOffset - b.startOffset);

    // Join tokens intelligently - add spaces only where needed
    let result = "";
    for (let i = 0; i < tokens.length; i++) {
      const current = tokens[i];
      const prev = i > 0 ? tokens[i - 1] : null;

      if (!current) continue;
      const currentImage = current.image;

      // Tokens that should not have a space before them
      const noSpaceBefore = [")", ",", ".", "::", ">", "<"];
      // Tokens that should not have a space after them
      const noSpaceAfter = ["(", ".", "::"];

      // Add space if needed
      if (prev && !current.isParenExpr) {
        const prevImage = prev.image;
        const prevLastChar = prevImage[prevImage.length - 1] ?? "";

        // Special case: if prev is > or < and current is =, don't add space (for >=, <=)
        const isCompoundOperator = (prevImage === ">" || prevImage === "<") && currentImage === "=";
        // Add space before comparison operators (unless making a compound one)
        const isOperatorStart =
          (currentImage === ">" || currentImage === "<") &&
          !noSpaceAfter.includes(prevImage) &&
          prevLastChar !== "(";

        const needsSpace =
          (!noSpaceBefore.includes(currentImage) &&
            !noSpaceAfter.includes(prevImage) &&
            prevLastChar !== "(" &&
            !isCompoundOperator) ||
          isOperatorStart;

        if (needsSpace) {
          result += " ";
        }
      } else if (prev && current.isParenExpr) {
        // For parenthesized expressions, add space unless previous ends with (
        const prevImage = prev.image;
        const prevLastChar = prevImage[prevImage.length - 1] ?? "";
        if (prevLastChar !== "(") {
          result += " ";
        }
      }
      result += currentImage;
    }

    return result;
  }

  private visitIndexDef(node: CstNode): IndexDef {
    const columns: string[] = [];
    const columnListNode = extractChild(node, "indexColumnList");

    if (columnListNode) {
      const colNodes = extractChildren(columnListNode, "indexColumn");
      for (const col of colNodes) {
        const template = extractImage(col, "TemplateIdentifier");
        const id = extractImage(col, "Identifier");
        columns.push(template ? template + id : id);
      }
    }

    const unique = node.children["Unique"] !== undefined;
    let using: string | undefined;

    if (node.children["Gin"]) using = "gin";
    if (node.children["Gist"]) using = "gist";
    if (node.children["Btree"]) using = "btree";
    if (node.children["Hash"]) using = "hash";

    // Extract where clause
    let where: string | undefined;
    const whereClauseNode = extractChild(node, "whereClause");
    if (whereClauseNode) {
      const exprNode = extractChild(whereClauseNode, "checkExpression");
      if (exprNode) {
        where = this.reconstructCheckExpression(exprNode);
      }
    }

    return {
      type: "IndexDef",
      columns,
      unique,
      using,
      where,
    };
  }

  private visitCheckDef(node: CstNode): CheckDef {
    const exprNode = extractChild(node, "checkExpression");
    const expression = exprNode ? this.reconstructCheckExpression(exprNode) : "";

    return {
      type: "CheckDef",
      expression,
    };
  }

  private visitTriggerDef(node: CstNode): TriggerDef {
    const identifiers = extractAllImages(node, "Identifier");
    const name = identifiers[0] ?? "";
    const executeFunction = identifiers[1] ?? "";

    const timing = node.children["Before"] ? "before" : "after";

    let event = "update";
    if (node.children["Insert"]) event = "insert";
    if (node.children["Delete"]) event = "delete";

    const forEach = node.children["Row"] ? "row" : "statement";

    return {
      type: "TriggerDef",
      name,
      timing,
      event,
      forEach,
      executeFunction,
    };
  }

  private visitInstantiation(node: CstNode): Instantiation {
    const targets: InstantiationTarget[] = [];
    const targetListNode = extractChild(node, "instantiationTargetList");

    if (targetListNode) {
      const targetNodes = extractChildren(targetListNode, "instantiationTarget");
      for (const t of targetNodes) {
        const ids = extractAllImages(t, "Identifier");
        targets.push({
          tableName: ids[0] ?? "",
          alias: ids[1],
        });
      }
    }

    const conceptRefNode = extractChild(node, "conceptReference");
    let conceptName = "";
    const typeArgs: TypeArg[] = [];

    if (conceptRefNode) {
      conceptName = extractImage(conceptRefNode, "Identifier");

      const typeArgListNode = extractChild(conceptRefNode, "typeArgList");
      if (typeArgListNode) {
        const argNodes = extractChildren(typeArgListNode, "typeArg");
        for (const arg of argNodes) {
          const ids = extractAllImages(arg, "Identifier");
          typeArgs.push({
            tableName: ids[0] ?? "",
            alias: ids[1],
          });
        }
      }
    }

    return {
      type: "Instantiation",
      targets,
      conceptName,
      typeArgs,
    };
  }

  private visitPerInstanceIndex(node: CstNode): PerInstanceIndex {
    const identifiers = extractAllImages(node, "Identifier");
    const tableName = identifiers[0] ?? "";
    const columns = identifiers.slice(1);

    const unique = node.children["Unique"] !== undefined;
    let using: string | undefined;

    if (node.children["Gin"]) using = "gin";
    if (node.children["Gist"]) using = "gist";
    if (node.children["Btree"]) using = "btree";
    if (node.children["Hash"]) using = "hash";

    // Extract where clause
    let where: string | undefined;
    const whereClauseNode = extractChild(node, "whereClause");
    if (whereClauseNode) {
      const exprNode = extractChild(whereClauseNode, "checkExpression");
      if (exprNode) {
        where = this.reconstructCheckExpression(exprNode);
      }
    }

    return {
      type: "PerInstanceIndex",
      tableName,
      columns,
      unique,
      using,
      where,
    };
  }
}

// ============================================================================
// Main Parse Function
// ============================================================================

export interface ParseResult {
  ast: GSQLProgram | null;
  errors: CompileError[];
}

export function parse(source: string): ParseResult {
  const lexResult = tokenize(source);
  const errors: CompileError[] = [];

  // Check for lexer errors
  for (const error of lexResult.errors) {
    errors.push({
      message: error.message,
      location: {
        start: { line: error.line ?? 0, column: error.column ?? 0, offset: error.offset },
        end: { line: error.line ?? 0, column: error.column ?? 0, offset: error.offset },
      },
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return { ast: null, errors };
  }

  // Parse tokens
  parserInstance.input = lexResult.tokens;
  const cst = parserInstance.program();

  // Check for parser errors
  for (const error of parserInstance.errors) {
    const token = error.token;
    errors.push({
      message: error.message,
      location: {
        start: {
          line: token.startLine ?? 0,
          column: token.startColumn ?? 0,
          offset: token.startOffset,
        },
        end: {
          line: token.endLine ?? 0,
          column: token.endColumn ?? 0,
          offset: token.endOffset ?? token.startOffset,
        },
      },
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return { ast: null, errors };
  }

  // Convert CST to AST
  const visitor = new CstToAstVisitor();
  const ast = visitor.visit(cst);

  return { ast, errors };
}
