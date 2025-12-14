# GSQL - Generic SQL

**Parametric polymorphism for SQL schemas**

GSQL is a domain-specific language that brings the power of generics/templates to database schemas.
Define common patterns once, instantiate them freely.

> Read the background story:
> [Parametric Polymorphism for SQL](https://barish.me/blog/parametric-polymorphism-for-sql/)

## The Problem

When building relational databases, you often need to duplicate table structures with minor
variations. For example, in a learning management system, you might need announcements for courses,
lessons, and exams—the same pattern repeated three times.

Current solutions force you to choose between:

- **Separate tables** - Violates DRY principles, leads to maintenance nightmares
- **Polymorphic associations** - Sacrifices foreign key integrity and type safety

GSQL solves this by letting you define reusable schema templates (concepts) that compile to
PostgreSQL with proper foreign key constraints.

## Quick Example

Here is the "LMS Dilemma" (Courses, Lessons, Exams) solved with GSQL. We define an `Announcing`
pattern once and apply it to three different tables, generating strictly typed foreign keys for
each.

```
// Define reusable patterns (Mixins)
schema Timestamps {
    created_at timestamptz nonull default(NOW());
    updated_at timestamptz nonull default(NOW());
}

// Define a Generic Concept
// Accepts a 'Target' type parameter to create a relationship
concept Announcing<Target> {
    schema Announcements mixin Timestamps {
        id serial pkey;

        // Template variables: {Target}_id becomes course_id, lesson_id, etc.
        {Target}_id integer nonull ref(Target.id) ondelete(cascade);

        title text nonull;
        body text nonull;

        index({Target}_id);
    }
}

// Define Concrete Schemas (in actual app these would also be concepts with generics)
schema Courses mixin Timestamps { id serial pkey; name text; }
schema Lessons mixin Timestamps { id serial pkey; topic text; }
schema Exams   mixin Timestamps { id serial pkey; score int; }

// Actually create tables by instantiating the Schemas/Concepts
courses = Courses;
lessons = Lessons;
exams   = Exams;

// Create specific announcement tables for each entity
course_announcements = Announcing<courses[course]>;
lesson_announcements = Announcing<lessons[lesson]>;
exam_announcements   = Announcing<exams[exam]>;

// Add per-instance indexes if needed
index(course_announcements, created_at);
```

This generates three announcement tables with proper foreign keys:

```sql
CREATE TABLE course_announcements (
    id serial PRIMARY KEY,
    course_id integer NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    title text NOT NULL,
    body text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX ON course_announcements (course_id);
--- ...
```

## Key Features

- **Schemas**: A table definition with columns, constraints, indexes, triggers
- **Concepts**: Generic schema templates with type parameters
- **Mixins**: Compose reusable schema fragments
- **Template variables**: Automatic field name expansion
- **Sibling references**: Multiple schemas within one concept can reference each other
- **Per-instance indexes**: Add indexes after instantiation
- **Type-safe foreign keys**: Proper FK constraints for polymorphic patterns
- **PostgreSQL output**: Compiles to PostgreSQL, integrates with migration tools like Atlas

## Try It Out

Try GSQL in your browser with the [online playground](https://gsql.barish.me).

## Installation

```bash
npm install @barishnamazov/gsql
# or
bun install @barishnamazov/gsql
```

## Usage

### Command Line

```bash
# Compile a GSQL file to SQL
gsql compile schema.gsql -o schema.sql

# Output to stdout
gsql compile schema.gsql

# Show help
gsql --help
```

### As a Library

```typescript
import { compile, compileToSQL } from "@barishnamazov/gsql";

// Get detailed result
const result = compile(source);
if (result.success) {
  console.log(result.sql);
} else {
  console.error(result.errors);
}

// Or just get SQL (throws on error)
const sql = compileToSQL(source);
```

## Syntax Reference

### Schemas

```gsql
schema Name mixin Mixin1, Mixin2 {
    column_name type constraint1 constraint2;
    index(column1, column2) unique;
    check(expression);
    trigger name before update on each row execute function fn();
}
```

### Concepts

```gsql
concept Tagging<Target> {
    schema Tags {
        id serial pkey;
        name text;
    }

    schema Taggings {
        {Target}_id integer ref(Target.id);
        {Tags}_id integer ref(Tags.id); // sibling reference
        index({Target}_id, {Tags}_id) unique;
    }
}

users = Users;
// {Target}_id becomes user_id
// {Tags}_id becomes user_tag_id
user_tags[user_tag], user_taggings = Tagging<users[user]>;
```

### Instantiation

```gsql
// Simple
table_name = SchemaOrConcept;

// With type arguments and aliases
table_name = Concept<other_table[alias]>;

// Multiple outputs
table1, table2 = ConceptWithMultipleSchemas<type_arg>;
```

**Aliases:** When instantiating a concept:

- **With alias:** `exams[examHello]` → uses `examHello_id` (preserves alias as-is)
- **Without alias:** `authors` → uses `author_id` (snake_cased from parameter name `Author`)

Example:

```gsql
concept Announcing<Target, Author> {
    schema Announcements {
        {Target}_id integer nonull ref(Target.id);
        {Author}_id integer nonull ref(Author.id);
    }
}

schema Exams { id serial pkey; }
schema Authors { id serial pkey; }

exams = Exams;
authors = Authors;

// Creates table with exam_id and author_id columns
// We don't need to alias authors, because the parameter name is Author
announcements = Announcing<exams[exam], authors>;
```

### Data Types

- `serial`, `bigserial`
- `integer`, `bigint`, `smallint`
- `text`, `varchar(n)`, `char(n)`
- `boolean`
- `timestamptz`, `timestamp`, `date`, `time`
- `jsonb`, `json`
- `uuid`, `inet`, `citext`
- `decimal`, `numeric`, `real`
- `bytea`

### Constraints

- `pkey` - Primary key
- `nonull` - Not null
- `unique` - Unique constraint
- `default(value)` - Default value
- `ref(Table.column)` - Foreign key reference
- `ondelete(cascade|restrict|setnull|setdefault|noaction)`
- `check(expression)` - Check constraint

## Development

This is a monorepo with multiple packages:

- **`packages/gsql`** - Core library and CLI (published as `@barishnamazov/gsql`)
- **`packages/playground`** - Browser-based playground

### Setup

```bash
# Install dependencies for all packages
npm install
```

### Building

```bash
# Build everything
npm run build

# Build just the library
npm run build:gsql

# Build just the playground
npm run build:playground
```

### Testing

```bash
# Run tests
npm test
```

### Playground Development

```bash
# Start the playground dev server
npm run dev:playground

# Or manually
cd packages/playground
npm run dev
```

After building, open `packages/playground/dist/index.html` in your browser.

### Linting and Formatting

```bash
# Lint all packages
npm run lint

# Format all packages
npm run format

# Type check all packages
npm run typecheck:all
```

## License

MIT
