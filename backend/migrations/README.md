# Migrations

This project uses **schema.sql** as the source of truth for database schema.

## Development Approach

We **do not use incremental migrations**. Instead:

1. Edit `backend/database/schema.sql` to reflect the desired schema
2. Rebuild the database from scratch:
   ```bash
   # Drop and recreate database
   psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
   psql $DATABASE_URL -f backend/database/schema.sql
   ```

## Why No Migrations?

- Simpler during active development
- No migration history to manage
- Schema.sql is the single source of truth
- Fresh rebuilds ensure clean state

## Future: Production Migrations

When the schema stabilizes for production, consider adding proper migration tooling like:
- Alembic (Python)
- Flyway
- Liquibase

For now, schema.sql + fresh rebuilds is sufficient.
