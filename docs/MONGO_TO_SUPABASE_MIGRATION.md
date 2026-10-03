# MongoDB to Supabase Postgres

The NestJS API now uses Supabase Postgres for all runtime persistence: finance records, profiles, workspaces and memberships, workspace transactions, Stellar accounts, signing requests, and contract events. MongoDB is no longer a runtime dependency. Keep the Mongo volume as a rollback backup until the quarantined records have been reviewed and the Supabase deployment has been fully qualified.

## Schema and importer

Apply `backend/supabase/001_initial_schema.sql`, then `backend/supabase/002_constraints.sql`. The migrations enable RLS on every application table and revoke direct access from `anon` and `authenticated`; the backend connects server-side using `SUPABASE_DB_URL`.

The importer defaults to a read-only dry run:

```bash
node backend/scripts/migrate-mongo-to-supabase.cjs
```

For a data import, first stop every process that can write to MongoDB and take a verified backup. The target application tables must be empty. Then run:

```bash
node backend/scripts/migrate-mongo-to-supabase.cjs --apply --confirm-source-frozen
```

The importer copies in one Postgres transaction and refuses to run if a destination table already has rows. It never deletes or modifies MongoDB data. If an insert fails, the Postgres transaction rolls back.

## Ownership handling

Rows are placed in user-facing tables only if their owner maps to a real `auth.users.id`. Existing Mongo profile IDs are matched by email in memory, but no source profile matched a Supabase Auth user in this migration. Missing, legacy, or ambiguous owners are preserved as JSON in `mongo_migration_quarantine`; the table has RLS enabled and no client-facing grants. Review and assign an owner through a separate audited process before restoring any such row to a user-facing table.

Migration counts from the source snapshot:

| Source data | Imported | Quarantined |
| --- | ---: | ---: |
| User profiles | 2 (unlinked) | 0 |
| Transactions | 6 | 112 |
| Categories | 0 | 32 |
| Budgets | 2 | 18 |
| Savings goals | 0 | 7 |
| Workspaces | 2 | 0 |
| Workspace memberships | 2 | 0 |
| Workspace transactions | 8 | 0 |
| Stellar accounts | 1 | 0 |
| Stellar signing requests | 9 | 0 |
| Stellar contract events | 8 | 0 |

The 169 quarantined records are retained in Supabase but intentionally do not appear in account views. Two normalized workspace-member rows are additional relational rows derived from the two workspace membership arrays.

## Verification and rollback

After import, compare counts in the tables above and verify API health and authenticated workspace/finance flows. Mongo remains intact and can be used to restore the old application if needed; do not run `docker compose down -v` while it is the only backup. To roll application traffic back, restore the prior backend build and Mongo-backed environment, not by deleting the Supabase tables.