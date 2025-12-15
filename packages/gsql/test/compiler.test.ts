/**
 * GSQL Compiler Tests
 *
 * Tests for the GSQL compiler including:
 * - Parser tests
 * - Code generation tests
 * - Real-world example tests
 */

import { describe, test, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, compileToSQL, parse } from "../src/index.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

// Helper to read fixture files
function readFixture(name: string): string {
  return readFileSync(join(FIXTURES_DIR, name), "utf-8");
}

// Get all GSQL fixture files
function getFixtureNames(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((f) => f.endsWith(".gsql"))
    .map((f) => basename(f, ".gsql"));
}

describe("GSQL Parser", () => {
  test("parses empty program", () => {
    const result = parse("");
    expect(result.errors).toHaveLength(0);
    expect(result.ast).not.toBeNull();
    expect(result.ast?.declarations).toHaveLength(0);
  });

  test("parses extension declaration", () => {
    const result = parse("extension citext;");
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    expect(result.ast?.declarations[0]?.type).toBe("ExtensionDecl");
  });

  test("parses function declaration", () => {
    const result = parse(`
      func set_updated_at() -> trigger {
        NEW.updated_at = NOW();
        return NEW;
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    expect(result.ast?.declarations[0]?.type).toBe("FunctionDecl");
  });

  test("parses enum declaration", () => {
    const result = parse(`
      enum user_role {
        admin;
        user;
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("EnumDecl");
    if (decl?.type === "EnumDecl") {
      expect(decl.values).toEqual(["admin", "user"]);
    }
  });

  test("parses schema with columns", () => {
    const result = parse(`
      schema Users {
        id serial pkey;
        email text nonull;
        name varchar(100);
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("SchemaDecl");
    if (decl?.type === "SchemaDecl") {
      expect(decl.members.filter((m) => m.type === "ColumnDef")).toHaveLength(3);
    }
  });

  test("parses schema with mixin", () => {
    const result = parse(`
      schema Timestamps {
        created_at timestamptz;
      }
      schema Users mixin Timestamps {
        id serial pkey;
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(2);
    const userSchema = result.ast?.declarations[1];
    if (userSchema?.type === "SchemaDecl") {
      expect(userSchema.mixins).toContain("Timestamps");
    }
  });

  test("parses concept declaration", () => {
    const result = parse(`
      concept Announcing<Target> {
        schema Announcements {
          id serial pkey;
          {target}_id integer;
        }
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("ConceptDecl");
    if (decl?.type === "ConceptDecl") {
      expect(decl.typeParams).toContain("Target");
      expect(decl.members).toHaveLength(1);
    }
  });

  test("parses instantiation", () => {
    const result = parse(`
      users = Authing;
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast?.declarations).toHaveLength(1);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("Instantiation");
    if (decl?.type === "Instantiation") {
      expect(decl.targets[0]?.tableName).toBe("users");
      expect(decl.conceptName).toBe("Authing");
    }
  });

  test("parses instantiation with type args and aliases", () => {
    const result = parse(`
      post_announcements = Announcing<posts[post], users[author]>;
    `);
    expect(result.errors).toHaveLength(0);
    const decl = result.ast?.declarations[0];
    if (decl?.type === "Instantiation") {
      expect(decl.typeArgs).toHaveLength(2);
      expect(decl.typeArgs[0]?.tableName).toBe("posts");
      expect(decl.typeArgs[0]?.alias).toBe("post");
    }
  });

  test("parses per-instance index", () => {
    const result = parse(`
      index(users, created_at);
    `);
    expect(result.errors).toHaveLength(0);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("PerInstanceIndex");
    if (decl?.type === "PerInstanceIndex") {
      expect(decl.tableName).toBe("users");
      expect(decl.columns).toContain("created_at");
    }
  });

  test("parses per-instance index with unique", () => {
    const result = parse(`
      index(users, email) unique;
    `);
    expect(result.errors).toHaveLength(0);
    const decl = result.ast?.declarations[0];
    if (decl?.type === "PerInstanceIndex") {
      expect(decl.unique).toBe(true);
    }
  });
});

describe("GSQL Code Generator", () => {
  test("generates extension SQL", () => {
    const sql = compileToSQL("extension citext;");
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS "citext"');
  });

  test("generates function SQL", () => {
    const sql = compileToSQL(`
      func set_updated_at() -> trigger {
        NEW.updated_at = NOW();
        return NEW;
      }
    `);
    expect(sql).toContain("CREATE OR REPLACE FUNCTION set_updated_at()");
    expect(sql).toContain("RETURNS TRIGGER");
  });

  test("generates enum SQL", () => {
    const sql = compileToSQL(`
      enum user_role {
        admin;
        user;
      }
    `);
    expect(sql).toContain("CREATE TYPE user_role AS ENUM");
    expect(sql).toContain("'admin'");
    expect(sql).toContain("'user'");
  });

  test("generates enum column with default value", () => {
    const sql = compileToSQL(`
      enum user_role {
        admin;
        user;
      }
      schema Users {
        id serial pkey;
        role user_role nonull default(user);
      }
      users = Users;
    `);
    expect(sql).toContain("role USER_ROLE NOT NULL DEFAULT 'user'::user_role");
  });

  test("generates enum column with qualified default value", () => {
    const sql = compileToSQL(`
      enum status {
        active;
        inactive;
      }
      schema Items {
        id serial pkey;
        status status default(status::active);
      }
      items = Items;
    `);
    expect(sql).toContain("status STATUS DEFAULT 'active'::status");
  });

  test("generates enum in concept with default value", () => {
    const sql = compileToSQL(`
      concept Statusing {
        enum item_status {
          draft;
          published;
        }
        schema Items {
          id serial pkey;
          status item_status nonull default(draft);
        }
      }
      items = Statusing;
    `);
    expect(sql).toContain("CREATE TYPE item_status AS ENUM");
    expect(sql).toContain("status ITEM_STATUS NOT NULL DEFAULT 'draft'::item_status");
  });

  test("generates CHECK constraint with comparison operators", () => {
    const sql = compileToSQL(`
      schema Test {
        id serial pkey;
        points integer;
        check(points is null or points >= 0);
      }
      test = Test;
    `);
    expect(sql).toContain("CHECK (points is null or points >= 0)");
  });

  test("generates CHECK constraint with enum references", () => {
    const sql = compileToSQL(`
      enum status {
        active;
        inactive;
      }
      schema Test {
        id serial pkey;
        status status;
        check(status = status::active);
      }
      test = Test;
    `);
    expect(sql).toContain("CHECK (status = 'active'::status)");
  });

  test("generates CHECK constraint with enum IN clause", () => {
    const sql = compileToSQL(`
      enum status {
        active;
        pending;
        inactive;
      }
      schema Test {
        id serial pkey;
        status status;
        check(status in (status::active, status::pending));
      }
      test = Test;
    `);
    expect(sql).toContain("CHECK (status in (('active'::status, 'pending'::status)))");
  });

  test("generates complex CHECK constraint with AND/OR", () => {
    const sql = compileToSQL(`
      schema Test {
        id serial pkey;
        min_value integer;
        max_value integer;
        check((min_value is null and max_value is null) or (min_value < max_value));
      }
      test = Test;
    `);
    expect(sql).toContain(
      "CHECK (((min_value is null and max_value is null)) or ((min_value < max_value)))"
    );
  });

  test("generates CHECK constraint with nested conditions", () => {
    const sql = compileToSQL(`
      enum reg_type {
        free;
        password;
      }
      schema Registration {
        id serial pkey;
        type reg_type;
        password text;
        check(
          (type = reg_type::password and password is not null)
          or
          (type = reg_type::free and password is null)
        );
      }
      registration = Registration;
    `);
    expect(sql).toContain(
      "CHECK (((type = 'password'::reg_type and password is not null)) or ((type = 'free'::reg_type and password is null)))"
    );
  });

  test("generates table with primary key", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
      }
      users = Users;
    `);
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("id SERIAL PRIMARY KEY");
  });

  test("generates table with constraints", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
        email text nonull;
        score integer default(0);
      }
      users = Users;
    `);
    expect(sql).toContain("email TEXT NOT NULL");
    expect(sql).toContain("score INTEGER DEFAULT 0");
  });

  test("generates foreign key references", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
      }
      schema Posts {
        id serial pkey;
        author_id integer ref(users.id);
      }
      users = Users;
      posts = Posts;
    `);
    expect(sql).toContain("REFERENCES users(id)");
  });

  test("generates indexes", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
        email text;
        index(email) unique;
      }
      users = Users;
    `);
    expect(sql).toContain("CREATE UNIQUE INDEX");
    expect(sql).toContain("idx_users_email");
  });

  test("generates triggers", () => {
    const sql = compileToSQL(`
      func set_updated_at() -> trigger {
        NEW.updated_at = NOW();
        return NEW;
      }
      schema Users {
        id serial pkey;
        trigger set_updated_at before update on each row execute function set_updated_at();
      }
      users = Users;
    `);
    expect(sql).toContain("CREATE TRIGGER set_updated_at_users");
    expect(sql).toContain("BEFORE UPDATE ON users");
  });

  test("expands template variables", () => {
    const sql = compileToSQL(`
      concept Announcing<Target> {
        schema Announcements {
          id serial pkey;
          {Target}_id integer;
        }
      }
      schema Posts {
        id serial pkey;
      }
      posts = Posts;
      post_announcements = Announcing<posts[post]>;
    `);
    expect(sql).toContain("post_id INTEGER");
  });

  test("expands template variables with alias preserving case", () => {
    const sql = compileToSQL(`
      concept Announcing<Target> {
        schema Announcements {
          id serial pkey;
          {Target}_id integer;
        }
      }
      schema Exams {
        id serial pkey;
      }
      exams = Exams;
      exam_announcements = Announcing<exams[examLOL]>;
    `);
    expect(sql).toContain("examLOL_id INTEGER");
  });

  test("expands template variables without alias using snake_case", () => {
    const sql = compileToSQL(`
      concept Announcing<Target, Author> {
        schema Announcements {
          id serial pkey;
          {Target}_id integer;
          {Author}_id integer;
        }
      }
      schema Exams {
        id serial pkey;
      }
      schema Authors {
        id serial pkey;
      }
      exams = Exams;
      authors = Authors;
      announcements = Announcing<exams[examLOL], authors>;
    `);
    expect(sql).toContain("examLOL_id INTEGER");
    expect(sql).toContain("author_id INTEGER");
  });

  test("expands self-reference template variables", () => {
    const sql = compileToSQL(`
      concept Assessing<Author> {
        schema Assessments {
          id serial pkey;
          {Author}_id integer;
        }
        schema Questions {
          id serial pkey;
          {Assessments}_id integer;
        }
      }
      schema Users {
        id serial pkey;
      }
      users = Users;
      exams[exam], questions = Assessing<users>;
    `);
    expect(sql).toContain("CREATE TABLE exams");
    expect(sql).toContain("author_id INTEGER");
    expect(sql).toContain("exam_id INTEGER");
  });

  test("generates per-instance indexes", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
        created_at timestamptz;
      }
      users = Users;
      index(users, created_at);
    `);
    expect(sql).toContain("CREATE INDEX idx_users_created_at ON users (created_at)");
  });

  test("generates per-instance indexes with gin", () => {
    const sql = compileToSQL(`
      schema Users {
        id serial pkey;
        tags jsonb;
      }
      users = Users;
      index(users, tags) gin;
    `);
    expect(sql).toContain("USING gin");
    expect(sql).toContain("ON users");
  });
});

describe("Real-World Examples", () => {
  const fixtures = getFixtureNames();

  for (const fixtureName of fixtures) {
    describe(fixtureName, () => {
      test("parses without errors", () => {
        const source = readFixture(`${fixtureName}.gsql`);
        const result = parse(source);
        expect(result.errors).toHaveLength(0);
        expect(result.ast).not.toBeNull();
      });

      test("compiles without errors", () => {
        const source = readFixture(`${fixtureName}.gsql`);
        const result = compile(source);
        expect(result.success).toBe(true);
        expect(result.errors).toHaveLength(0);
        expect(result.sql).toBeDefined();
      });

      test("generates valid SQL structure", () => {
        const source = readFixture(`${fixtureName}.gsql`);
        const result = compile(source);

        if (result.sql) {
          // Basic SQL structure validation
          expect(result.sql).toContain("-- Generated SQL");

          // Should have CREATE TABLE statements
          expect(result.sql).toMatch(/CREATE TABLE \w+/);
        }
      });
    });
  }
});

describe("Exam System (Original Test)", () => {
  test("matches expected output structure", () => {
    const source = readFixture("exam-system.gsql");
    const result = compile(source);

    expect(result.success).toBe(true);

    const sql = result.sql ?? "";

    // Check for key components from the expected output
    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION set_updated_at()");

    // Check for all enum types
    expect(sql).toContain("CREATE TYPE user_role AS ENUM");
    expect(sql).toContain("CREATE TYPE assessment_status AS ENUM");
    expect(sql).toContain("CREATE TYPE question_type AS ENUM");
    expect(sql).toContain("CREATE TYPE submission_status AS ENUM");

    // Check for key tables
    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("CREATE TABLE exams");
    expect(sql).toContain("CREATE TABLE questions");
    expect(sql).toContain("CREATE TABLE exam_submissions");
    expect(sql).toContain("CREATE TABLE sessions");

    // Check for foreign keys
    expect(sql).toContain("REFERENCES users(id)");
    expect(sql).toContain("REFERENCES exams(id)");

    // Check for triggers
    expect(sql).toContain("CREATE TRIGGER set_updated_at_users");
    expect(sql).toContain("CREATE TRIGGER set_updated_at_exams");
  });
});

describe("Per-Instantiation Indexing", () => {
  test("adds indexes after instantiation", () => {
    const source = readFixture("per-instantiation-indexing.gsql");
    const result = compile(source);

    expect(result.success).toBe(true);

    const sql = result.sql ?? "";

    // Check for per-instance indexes
    expect(sql).toContain("idx_post_announcements_created_at");
    expect(sql).toContain("idx_post_announcements_message");
    expect(sql).toContain("USING gin");
  });

  test("per-instance indexes come after table creation", () => {
    const source = readFixture("per-instantiation-indexing.gsql");
    const result = compile(source);

    const sql = result.sql ?? "";

    // The table should be created before the per-instance index
    const tablePos = sql.indexOf("CREATE TABLE post_announcements");
    const indexPos = sql.indexOf("idx_post_announcements_created_at");

    expect(tablePos).toBeLessThan(indexPos);
  });
});
