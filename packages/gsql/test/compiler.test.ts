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
import pg from "pg";

const { Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "fixtures");

const DB_NAME = "gsql-test-db";

const BASE_DB_CONFIG = process.env["DATABASE_URL"]
  ? { connectionString: process.env["DATABASE_URL"].replace(/\/[^/]*$/, "/postgres") }
  : {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: "postgres",
    };

const DB_CONFIG = process.env["DATABASE_URL"]
  ? { connectionString: process.env["DATABASE_URL"] }
  : {
      host: "localhost",
      port: 5432,
      user: "postgres",
      password: "postgres",
      database: DB_NAME,
    };

let dbInitialized = false;

async function initializeDatabase(): Promise<boolean> {
  if (dbInitialized) return true;

  const client = new Client(BASE_DB_CONFIG);
  try {
    await client.connect();

    const result = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);

    if (result.rows.length === 0) {
      await client.query(`CREATE DATABASE "${DB_NAME}"`);
    }

    await client.end();
    dbInitialized = true;
    return true;
  } catch {
    await client.end().catch(() => {
      // Ignore errors during cleanup
    });
    return false;
  }
}

async function isDatabaseAvailable(): Promise<boolean> {
  return await initializeDatabase();
}

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
    expect(sql).toContain("CHECK (status in ('active'::status, 'pending'::status))");
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
      "CHECK ((min_value is null and max_value is null) or (min_value < max_value))",
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
      "CHECK ((type = 'password'::reg_type and password is not null) or (type = 'free'::reg_type and password is null))",
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

describe("Partial Index with WHERE clause", () => {
  test("parses schema index with where clause", () => {
    const result = parse(`
      schema Questions {
        id serial pkey;
        assessment_id integer nonull;
        position integer nonull;
        deleted_at timestamptz;

        index(assessment_id, position) unique where (deleted_at is null);
      }
    `);
    expect(result.errors).toHaveLength(0);
    expect(result.ast).not.toBeNull();

    const schema = result.ast?.declarations[0];
    expect(schema?.type).toBe("SchemaDecl");

    if (schema?.type === "SchemaDecl") {
      const indexes = schema.members.filter((m) => m.type === "IndexDef");
      expect(indexes).toHaveLength(1);

      const idx = indexes[0];
      if (idx?.type === "IndexDef") {
        expect(idx.columns).toEqual(["assessment_id", "position"]);
        expect(idx.unique).toBe(true);
        expect(idx.where).toBe("deleted_at is null");
      }
    }
  });

  test("generates index with WHERE clause", () => {
    const sql = compileToSQL(`
      schema Questions {
        id serial pkey;
        assessment_id integer nonull;
        position integer nonull;
        deleted_at timestamptz;

        index(assessment_id, position) unique where (deleted_at is null);
      }
      questions = Questions;
    `);

    expect(sql).toContain("CREATE UNIQUE INDEX idx_questions_assessment_id_position");
    expect(sql).toContain("ON questions");
    expect(sql).toContain("WHERE (deleted_at is null)");
  });

  test("generates index with WHERE clause in concept", () => {
    const sql = compileToSQL(`
      concept Assessing<Author> {
        schema Questions {
          id serial pkey;
          {Author}_id integer nonull;
          position integer nonull;
          deleted_at timestamptz;

          index({Author}_id, position) unique where (deleted_at is null);
        }
      }
      schema Users {
        id serial pkey;
      }
      users = Users;
      questions = Assessing<users>;
    `);

    expect(sql).toContain("CREATE UNIQUE INDEX idx_questions_author_id_position");
    expect(sql).toContain("WHERE (deleted_at is null)");
  });

  test("generates per-instance index with WHERE clause", () => {
    const sql = compileToSQL(`
      schema Questions {
        id serial pkey;
        assessment_id integer;
        position integer;
        deleted_at timestamptz;
      }
      questions = Questions;
      index(questions, assessment_id, position) unique where (deleted_at is null);
    `);

    expect(sql).toContain("CREATE UNIQUE INDEX idx_questions_assessment_id_position");
    expect(sql).toContain("WHERE (deleted_at is null)");
  });

  test("parses per-instance index with where clause", () => {
    const result = parse(`
      index(users, email) unique where (deleted_at is null);
    `);
    expect(result.errors).toHaveLength(0);
    const decl = result.ast?.declarations[0];
    expect(decl?.type).toBe("PerInstanceIndex");
    if (decl?.type === "PerInstanceIndex") {
      expect(decl.unique).toBe(true);
      expect(decl.where).toBe("deleted_at is null");
    }
  });

  test("generates index with complex WHERE clause", () => {
    const sql = compileToSQL(`
      schema Items {
        id serial pkey;
        status text;
        archived boolean;

        index(status) where (status = 'active' and archived = false);
      }
      items = Items;
    `);

    expect(sql).toContain("WHERE (status = 'active' and archived = false)");
  });

  test("generates index with WHERE clause and gin index type", () => {
    const sql = compileToSQL(`
      schema Items {
        id serial pkey;
        tags jsonb;
        deleted_at timestamptz;

        index(tags) gin where (deleted_at is null);
      }
      items = Items;
    `);

    expect(sql).toContain("USING gin");
    expect(sql).toContain("WHERE (deleted_at is null)");
  });

  test("generates index with WHERE clause containing template variables", () => {
    const sql = compileToSQL(`
      concept SoftDeletable<Target> {
        schema Items {
          id serial pkey;
          {Target}_id integer;
          position integer;
          deleted_at timestamptz;

          index({Target}_id, position) unique where (deleted_at is null);
        }
      }
      schema Posts {
        id serial pkey;
      }
      posts = Posts;
      post_items = SoftDeletable<posts[post]>;
    `);

    expect(sql).toContain("CREATE UNIQUE INDEX idx_post_items_post_id_position");
    expect(sql).toContain("WHERE (deleted_at is null)");
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
          expect(result.sql).toContain("-- Generated SQL");
          expect(result.sql).toMatch(/CREATE TABLE \w+/);
        }
      });

      test("compiled SQL executes without errors in PostgreSQL", async () => {
        const dbAvailable = await isDatabaseAvailable();
        if (!dbAvailable) {
          console.warn(
            `Skipping PostgreSQL test: database not available at ${DB_CONFIG.host ?? "DATABASE_URL"}`,
          );
          return;
        }

        const source = readFixture(`${fixtureName}.gsql`);
        const result = compile(source);

        expect(result.success).toBe(true);
        expect(result.sql).toBeDefined();

        if (result.sql) {
          const client = new Client(DB_CONFIG);
          try {
            await client.connect();

            const schemaName = `test_${fixtureName.replace(/-/g, "_")}_${Date.now()}`;
            await client.query(`CREATE SCHEMA ${schemaName}`);
            await client.query(`SET search_path TO ${schemaName}`);

            await client.query(result.sql);

            await client.query(`DROP SCHEMA ${schemaName} CASCADE`);
          } finally {
            await client.end();
          }
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

    expect(sql).toContain("CREATE EXTENSION IF NOT EXISTS");
    expect(sql).toContain("CREATE OR REPLACE FUNCTION set_updated_at()");

    expect(sql).toContain("CREATE TYPE user_role AS ENUM");
    expect(sql).toContain("CREATE TYPE assessment_status AS ENUM");
    expect(sql).toContain("CREATE TYPE question_type AS ENUM");
    expect(sql).toContain("CREATE TYPE submission_status AS ENUM");

    expect(sql).toContain("CREATE TABLE users");
    expect(sql).toContain("CREATE TABLE exams");
    expect(sql).toContain("CREATE TABLE questions");
    expect(sql).toContain("CREATE TABLE exam_submissions");
    expect(sql).toContain("CREATE TABLE sessions");

    expect(sql).toContain("REFERENCES users(id)");
    expect(sql).toContain("REFERENCES exams(id)");

    expect(sql).toContain("CREATE TRIGGER set_updated_at_users");
    expect(sql).toContain("CREATE TRIGGER set_updated_at_exams");

    // Verify deleted_at column and partial unique index
    expect(sql).toContain("deleted_at TIMESTAMPTZ");
    expect(sql).toContain("WHERE (deleted_at is null)");
  });
});

describe("Per-Instantiation Indexing", () => {
  test("adds indexes after instantiation", () => {
    const source = readFixture("per-instantiation-indexing.gsql");
    const result = compile(source);

    expect(result.success).toBe(true);

    const sql = result.sql ?? "";

    expect(sql).toContain("idx_post_announcements_created_at");
    expect(sql).toContain("idx_post_announcements_tags");
    expect(sql).toContain("USING gin");
  });

  test("per-instance indexes come after table creation", () => {
    const source = readFixture("per-instantiation-indexing.gsql");
    const result = compile(source);

    const sql = result.sql ?? "";

    const tablePos = sql.indexOf("CREATE TABLE post_announcements");
    const indexPos = sql.indexOf("idx_post_announcements_created_at");

    expect(tablePos).toBeLessThan(indexPos);
  });
});

describe("Compiler Error Handling", () => {
  test("returns errors for invalid syntax", () => {
    const result = compile("schema Users { invalid syntax here");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("compileToSQL throws error for invalid syntax", () => {
    expect(() => compileToSQL("schema Users { invalid")).toThrow("Compilation failed");
  });

  test("handles parse errors with missing closing brace", () => {
    const result = compile("schema Users { id serial pkey;");
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("handles enum default value conversion", () => {
    const sql = compileToSQL(`
      enum status {
        active;
        inactive;
      }
      schema Test {
        id serial pkey;
        status status default(active);
      }
      test = Test;
    `);
    // Verify that the default value is properly formatted
    expect(sql).toContain("DEFAULT 'active'::status");
  });

  test("handles column-level check constraint", () => {
    const sql = compileToSQL(`
      schema Test {
        id serial pkey;
        age integer check(age >= 18);
      }
      test = Test;
    `);
    expect(sql).toContain("age INTEGER CHECK (age >= 18)");
  });

  test("handles column-level check constraint with complex expression", () => {
    const sql = compileToSQL(`
      schema Test {
        id serial pkey;
        score integer check(score >= 0 and score <= 100);
      }
      test = Test;
    `);
    expect(sql).toContain("CHECK (score >= 0 and score <= 100)");
  });

  test("handles column-level check constraint with enum reference", () => {
    const sql = compileToSQL(`
      enum priority {
        low;
        high;
      }
      schema Task {
        id serial pkey;
        priority priority check(priority = priority::high or priority = priority::low);
      }
      tasks = Task;
    `);
    expect(sql).toContain("CHECK (priority = 'high'::priority or priority = 'low'::priority)");
  });

  test("handles string literal default value", () => {
    const sql = compileToSQL(`
      schema Test {
        id serial pkey;
        name text default('unknown');
      }
      test = Test;
    `);
    expect(sql).toContain("DEFAULT 'unknown'");
  });
});
