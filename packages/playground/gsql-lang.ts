import { StreamLanguage } from "@codemirror/language";
import { tokenize } from "@barishnamazov/gsql/src/lexer";
import type { IToken } from "chevrotain";

interface GSQLState {
  tokens: IToken[];
  index: number;
  lineStart: number;
  inEnum: boolean;
  braceDepth: number;
  enumBraceDepth: number;
}

const gsqlLanguage = StreamLanguage.define<GSQLState>({
  name: "gsql",

  startState: () => ({
    tokens: [],
    index: 0,
    lineStart: 0,
    inEnum: false,
    braceDepth: 0,
    enumBraceDepth: 0,
  }),

  token(stream, state) {
    if (stream.sol()) {
      const fullText = stream.string;

      const result = tokenize(fullText);
      state.tokens = result.tokens;
      state.index = 0;
      state.lineStart = stream.pos;
    }

    if (state.index >= state.tokens.length) {
      stream.skipToEnd();
      return null;
    }

    const token = state.tokens[state.index];
    const tokenStart = token?.startOffset;
    const tokenEnd = token?.endOffset;

    if (tokenStart === undefined || tokenEnd === undefined) {
      stream.skipToEnd();
      return null;
    }

    const tokenEndPos = tokenEnd + 1;

    if (tokenStart < stream.pos) {
      state.index++;
      return null;
    }

    if (tokenStart > stream.pos) {
      stream.pos = tokenStart;
      return null;
    }

    stream.pos = tokenEndPos;
    state.index++;

    const tokenType = token?.tokenType.name;
    if (!tokenType) {
      return null;
    }

    // Track enum context
    if (tokenType === "Enum") {
      state.inEnum = true;
      state.enumBraceDepth = state.braceDepth + 1;
    }

    if (tokenType === "LBrace") {
      state.braceDepth++;
    }

    if (tokenType === "RBrace") {
      if (state.inEnum && state.braceDepth === state.enumBraceDepth) {
        state.inEnum = false;
      }
      state.braceDepth--;
    }

    if (tokenType === "LineComment" || tokenType === "BlockComment") {
      return "comment";
    }

    if (tokenType === "StringLiteral") {
      return "string";
    }

    if (tokenType === "NumberLiteral") {
      return "number";
    }

    if (tokenType === "BooleanLiteral" || tokenType === "NullLiteral") {
      return "atom";
    }

    if (tokenType === "TemplateIdentifier") {
      return "typeName";
    }

    const keywords = [
      "Concept",
      "Schema",
      "Mixin",
      "Enum",
      "Extension",
      "Function",
      "Func",
      "Trigger",
      "Index",
      "Check",
      "Before",
      "After",
      "Ondelete",
      "On",
      "Each",
      "Row",
      "Statement",
      "Execute",
      "Unique",
      "Pkey",
      "Nonull",
      "Default",
      "Ref",
      "Cascade",
      "Restrict",
      "SetNull",
      "SetDefault",
      "NoAction",
      "Update",
      "Insert",
      "Delete",
      "Return",
      "New",
      "Old",
    ];

    const dataTypes = [
      "Serial",
      "BigSerial",
      "Integer",
      "Bigint",
      "SmallInt",
      "Text",
      "Varchar",
      "Char",
      "Boolean",
      "Timestamptz",
      "Timestamp",
      "Date",
      "Time",
      "Jsonb",
      "Json",
      "Uuid",
      "Inet",
      "Citext",
      "Decimal",
      "Numeric",
      "Real",
      "DoublePrecision",
      "Bytea",
      "Gin",
      "Gist",
      "Btree",
      "Hash",
    ];

    // If we're inside an enum, treat all keywords and types as identifiers
    if (state.inEnum && (keywords.includes(tokenType) || dataTypes.includes(tokenType))) {
      return "variableName";
    }

    if (keywords.includes(tokenType)) {
      return "keyword";
    }

    if (dataTypes.includes(tokenType)) {
      return "typeName";
    }

    if (tokenType === "Identifier") {
      return "variableName";
    }

    if (
      ["LBrace", "RBrace", "LParen", "RParen", "LBracket", "RBracket", "LAngle", "RAngle"].includes(
        tokenType,
      )
    ) {
      return "bracket";
    }

    if (["Semicolon", "Comma", "Dot", "Equals", "Arrow", "DoubleColon"].includes(tokenType)) {
      return "operator";
    }

    return null;
  },

  blankLine(state) {
    state.tokens = [];
    state.index = 0;
  },
});

export function gsql(): StreamLanguage<GSQLState> {
  return gsqlLanguage;
}
