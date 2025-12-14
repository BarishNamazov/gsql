# GSQL - Generic SQL

**Parametric polymorphism for SQL schemas**

GSQL is a domain-specific language that brings the power of generics/templates to database schemas. Define common patterns once, instantiate them anywhere.

## Features

- **Concepts**: Generic schema templates with type parameters
- **Mixins**: Compose reusable schema fragments
- **Template variables**: Automatic field name expansion
- **Per-instance indexes**: Add indexes after instantiation
- **Type-safe foreign keys**: Proper FK constraints for polymorphic patterns

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

## Quick Example

```gsql
// Reusable timestamp pattern
schema Timestamps {
    created_at timestamptz nonull default(NOW());
    updated_at timestamptz nonull default(NOW());
}

// Generic concept for announcements
concept Announcing<Target> {
    schema Announcements mixin Timestamps {
        id serial pkey;
        {Target}_id integer nonull ref(Target.id) ondelete(cascade);
        message text nonull;

        index({Target}_id);
    }
}

// Concrete tables
schema Posts {
    id serial pkey;
    title varchar(255);
}

posts = Posts;
post_announcements = Announcing<posts[post]>;

// Per-instance indexes
index(post_announcements, created_at);
```

This generates proper SQL with:

- A `posts` table
- A `post_announcements` table with a `post_id` foreign key
- Proper indexes and constraints

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
concept Name<TypeParam1, TypeParam2> {
    enum status { active; inactive; }

    schema Table {
        {TypeParam1}_id integer ref(TypeParam1.id);
    }
}
```

**Template Variables:** Use uppercase type parameter names in curly braces (e.g., `{Target}_id`, `{Author}_id`).

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

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Lint
npm run lint

# Format
npm run format
```

## License

MIT
