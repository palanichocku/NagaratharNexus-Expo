# Ops Runbook

This runbook explains how to use the database operations scripts from the **project root**.

## Table of contents
- [Project layout](#project-layout)
- [Before first use](#before-first-use)
- [Environment files](#environment-files)
- [Script: `backup_db.sh`](#script-backup_dbsh)
- [Script: `restore_db.sh`](#script-restore_dbsh)
- [Script: `sync_supabase_db.sh`](#script-sync_supabase_dbsh)
- [Common workflows](#common-workflows)
- [Safety notes](#safety-notes)
- [Quick cheat sheet](#quick-cheat-sheet)

## Project layout

Assumed project structure:

```bash
scripts/
  backup_db.sh
  restore_db.sh
  sync_supabase_db.sh
  lib/
    common.sh

ops/
  .env.backup.local
  .env.restore.local
  .env.sync.local
```

## Before first use

Run this once from the project root:

```bash
chmod +x scripts/backup_db.sh scripts/restore_db.sh scripts/sync_supabase_db.sh
```

## Environment files

Recommended env file split:

### `ops/.env.backup.local`

```bash
SOURCE_DB_URL='postgresql://...'
BACKUP_BUCKET='my-db-backups'
BACKUP_PREFIX='nexus/prod'
APP_NAME='nexus'
ENV_NAME='prod'
RETENTION_DAYS='7'
AWS_REGION='us-east-1'
S3_ENDPOINT_URL=''
```

### `ops/.env.restore.local`

```bash
TARGET_DB_URL='postgresql://...'
BACKUP_BUCKET='my-db-backups'
BACKUP_PREFIX='nexus/prod'
APP_NAME='nexus'
ENV_NAME='prod'
AWS_REGION='us-east-1'
S3_ENDPOINT_URL=''
ALLOW_PROD_WRITE='0'
```

### `ops/.env.sync.local`

```bash
DEV_DB_URL='postgresql://...'
PROD_DB_URL='postgresql://...'
ALLOW_PROD_WRITE='0'
```

Use the matching env file for each script by passing `ENV_FILE=...` inline with the command.

---

## Script: `backup_db.sh`

### Purpose
Creates a PostgreSQL custom-format backup, generates a SHA-256 checksum, uploads both files to S3-compatible storage, and prunes older matching backups based on retention.

### Run location
Always run from the **project root**.

### Exact syntax

```bash
ENV_FILE=./ops/.env.backup.local ./scripts/backup_db.sh [--dry-run]
```

### Required env vars
- `SOURCE_DB_URL`
- `BACKUP_BUCKET`
- `BACKUP_PREFIX`

### Optional env vars
- `APP_NAME` — default: `nexus`
- `ENV_NAME` — default: `prod`
- `RETENTION_DAYS` — default: `7`
- `TMP_DIR` — default: `/tmp/db-backups`
- `AWS_REGION` — default: `us-east-1`
- `S3_ENDPOINT_URL` — optional S3-compatible endpoint

### Parameters
- `--dry-run` — print actions without creating or uploading a backup
- `-h`, `--help` — show help

### Usage examples

#### Basic backup

```bash
ENV_FILE=./ops/.env.backup.local ./scripts/backup_db.sh
```

#### Dry run

```bash
ENV_FILE=./ops/.env.backup.local ./scripts/backup_db.sh --dry-run
```

#### Use a different env file

```bash
ENV_FILE=./ops/.env.backup.production ./scripts/backup_db.sh
```

#### Show help

```bash
./scripts/backup_db.sh --help
```

### Notes
- This is the right script when you want to create a fresh dump and upload it.
- It also deletes old backup objects that match the configured app and environment naming pattern.

---

## Script: `restore_db.sh`

### Purpose
Downloads the latest matching backup dump, or a specific dump if passed with `--key`, validates it, and restores it into the target PostgreSQL database.

### Run location
Always run from the **project root**.

### Exact syntax

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh [--dry-run] [--key <backup-file-name>]
```

### Required env vars
- `TARGET_DB_URL`
- `BACKUP_BUCKET`
- `BACKUP_PREFIX`

### Optional env vars
- `APP_NAME` — default: `nexus`
- `ENV_NAME` — default: `prod`
- `TMP_DIR` — default: `/tmp/db-backups`
- `AWS_REGION` — default: `us-east-1`
- `S3_ENDPOINT_URL` — optional S3-compatible endpoint
- `ALLOW_PROD_WRITE` — default: `0`

### Parameters
- `--key <backup-file-name>` — restore a specific dump file instead of the latest one
- `--dry-run` — print actions without downloading or restoring
- `-h`, `--help` — show help

### Usage examples

#### Restore latest matching backup

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh
```

#### Dry run

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --dry-run
```

#### Restore a specific dump file

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --key nexus_prod_2026-03-13T020000Z.dump
```

#### Restore into prod only when explicitly allowed

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --key nexus_prod_2026-03-13T020000Z.dump
```

#### Show help

```bash
./scripts/restore_db.sh --help
```

### Notes
- This is destructive for objects included in the dump because restore runs with cleanup flags.
- Keep `ALLOW_PROD_WRITE='0'` by default and only override it inline when you intentionally need a production restore.

---

## Script: `sync_supabase_db.sh`

### Purpose
Copies schema and optionally data from one Supabase Postgres database to another. Supports full syncs or schema-only syncs, and can optionally copy `auth.users` and `auth.identities`.

### Run location
Always run from the **project root**.

### Exact syntax

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev|prod --target dev|prod --mode full|schema-only [--auth copy|skip] [--yes] [--keep-dumps] [--dry-run]
```

### Required env vars
- `DEV_DB_URL`
- `PROD_DB_URL`

### Optional env vars
- `ALLOW_PROD_WRITE` — default: `0`

### Parameters
- `--source dev|prod` — source environment
- `--target dev|prod` — target environment
- `--mode full|schema-only` — full copies schema and data; schema-only copies schema only
- `--auth copy|skip` — copy or skip `auth.users` and `auth.identities`
- `--yes` — skip interactive confirmation
- `--keep-dumps` — keep temporary dump files for debugging
- `--dry-run` — print actions without executing them
- `-h`, `--help` — show help

### Usage examples

#### Prod to dev, full sync, skip auth

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth skip
```

#### Prod to dev, full sync, copy auth

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth copy
```

#### Prod to dev, schema-only

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode schema-only
```

#### Dev to prod, schema-only

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev --target prod --mode schema-only
```

#### Dev to prod, full sync, skip auth

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev --target prod --mode full --auth skip
```

#### Skip confirmation prompt

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth skip --yes
```

#### Keep temporary dump files

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth skip --keep-dumps
```

#### Dry run

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode schema-only --dry-run
```

#### Show help

```bash
./scripts/sync_supabase_db.sh --help
```

### Notes
- This is the right script when you want to move schema or data directly between dev and prod databases.
- `--auth copy` is only valid with `--mode full`.
- Writing to prod should remain a rare, deliberate action.

---

## Common workflows

### 1) Create a fresh production backup

```bash
ENV_FILE=./ops/.env.backup.local ./scripts/backup_db.sh
```

### 2) Preview a restore before doing it

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --dry-run
```

### 3) Restore the latest backup into a non-production target

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh
```

### 4) Restore a specific point-in-time dump

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --key nexus_prod_2026-03-13T020000Z.dump
```

### 5) Refresh dev from prod without copying auth

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth skip
```

### 6) Refresh dev from prod and copy auth too

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth copy
```

### 7) Copy only schema changes from prod into dev

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode schema-only
```

### 8) Make a deliberate schema push from dev into prod

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev --target prod --mode schema-only
```

---

## Safety notes

- Run all commands from the **project root**.
- Prefer `--dry-run` first when it is available.
- Keep `ALLOW_PROD_WRITE='0'` in env files by default.
- Only override `ALLOW_PROD_WRITE=1` inline for one command when you truly need it.
- `restore_db.sh` and `sync_supabase_db.sh` can be destructive, especially when the target is production.
- `sync_supabase_db.sh --mode full` replaces target public schema and public data.
- `sync_supabase_db.sh --auth copy` also replaces `auth.users` and `auth.identities`.

Safe pattern for a production-impacting command:

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev --target prod --mode schema-only
```

---

## Quick cheat sheet

### Backup

```bash
ENV_FILE=./ops/.env.backup.local ./scripts/backup_db.sh
```

### Restore latest

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh
```

### Restore specific dump

```bash
ENV_FILE=./ops/.env.restore.local ./scripts/restore_db.sh --key nexus_prod_2026-03-13T020000Z.dump
```

### Sync prod to dev, full, skip auth

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode full --auth skip
```

### Sync prod to dev, schema-only

```bash
ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source prod --target dev --mode schema-only
```

### Sync dev to prod, schema-only

```bash
ALLOW_PROD_WRITE=1 ENV_FILE=./ops/.env.sync.local ./scripts/sync_supabase_db.sh --source dev --target prod --mode schema-only
```

