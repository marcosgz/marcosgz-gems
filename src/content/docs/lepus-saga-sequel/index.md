---
title: Overview
slug: index
order: -1
project: lepus-saga-sequel
---
[Sequel](https://sequel.jeremyevans.net) store for [lepus-saga](/lepus-saga/). Executions and step attempts live in the `saga_executions` and `saga_step_attempts` tables. Works with PostgreSQL, MySQL/MariaDB and SQLite.

## Installation

```ruby
gem "lepus-saga"
gem "lepus-saga-sequel"
```

The gem ships its migrations. Run them with:

```ruby
require "lepus/saga/sequel"

Lepus::Saga::Sequel.migrate(DB)              # create the tables
Lepus::Saga::Sequel.migrate(DB, target: 0)   # drop them
```

The version is tracked in its own `lepus_saga_schema_info` table, so it never collides with your app's `schema_info` or `schema_migrations`. To keep everything in one migration history instead, copy the files from `lib/lepus/saga/sequel/migrations` into your own migrations directory.

Ids are UUIDv7 strings generated in Ruby, the context columns are `json` and `failure_reason` is `text` (a step's error message can outgrow `VARCHAR(255)`, and MySQL/MariaDB strict mode would reject the write that fails the saga). The table, column and index names are the ones the lepus-saga-active_record generator creates, so an app can move between the two gems on the same tables. Column types can differ slightly: Sequel creates unsized strings as `text` on PostgreSQL and the step attempts' `duration_ms` as a double-precision float on MySQL/MariaDB. `saga_executions.duration_ms` is a `bigint` the engine writes when an execution ends. Besides the resource, progress and attempt indexes the engine uses, the migration indexes what the console sorts and filters on: `saga_executions (started_at, id)`, `(duration_ms, id)`, `(finished_at)`, `(saga_name, started_at)`, `(status, started_at)` and `(partition, started_at)`, and `saga_step_attempts (started_at)` and `(error_class, started_at)`.

## Configuration

```ruby
Sequel.database_timezone = :utc
DB = Sequel.connect(ENV["DATABASE_URL"])

Lepus::Saga.configure do |config|
  config.store = :sequel
end
```

`:sequel` requires `lepus/saga/stores/sequel` and instantiates `Lepus::Saga::Stores::Sequel`. The models use `Sequel::Model.db` (the first database you connected to). To keep the saga tables in another database, set it before the models are first used:

```ruby
Lepus::Saga::Sequel.db = SAGA_DB
```

To use your own subclasses of the models (another table name, extra plugins), redeclare the associations so `step_attempts`, `attempts_for_current_step` and `prune` use your attempt class, and pass an instance:

```ruby
class SagaExecution < Lepus::Saga::Sequel::Execution
  set_dataset :order_saga_executions
  one_to_many :step_attempts, class: "SagaStepAttempt", key: :saga_execution_id
end

class SagaStepAttempt < Lepus::Saga::Sequel::StepAttempt
  set_dataset :order_saga_step_attempts
  many_to_one :execution, class: "SagaExecution", key: :saga_execution_id
end

config.store = Lepus::Saga::Stores::Sequel.new(execution_class: SagaExecution, step_attempt_class: SagaStepAttempt)
```

The rest of the setup (definitions, consumers, operations, instrumentation) is in the [lepus-saga README](https://github.com/marcosgz/lepus-saga#readme).

### Requirements

- **Times in UTC.** The engine writes `Time.now.utc` and compares it with stored times to find stalled executions. Sequel stores times in local time by default, which mixes the two in a `timestamp`/`datetime` column. Set `Sequel.database_timezone = :utc` (or `DB.timezone = :utc` for one database).
- **Fractional seconds on MySQL/MariaDB.** Open the database with `fractional_seconds: true` (or `?fractional_seconds=true` in the URL) *before* running the migrations. Without it Sequel creates `datetime` columns without microseconds and truncates the times it writes, so executions created in the same second sort arbitrarily.
- **A busy handler on SQLite with threads.** SQLite serializes writers on the whole database. Wait for the lock with `busy_handler_timeout`, which lets other Ruby threads run while it waits (`busy_timeout`, which Sequel's `:timeout` option sets, does not):

```ruby
DB = Sequel.sqlite("db/app.sqlite3", after_connect: ->(connection) { connection.busy_handler_timeout = 10_000 })
```

## Models

`Lepus::Saga::Sequel::Execution` and `Lepus::Saga::Sequel::StepAttempt` are `Sequel::Model` classes that include the core's `ExecutionBehaviour` and `StepAttemptBehaviour`, so they answer `running?`, `terminal?`, `definition_class`, `partition` and the rest.

```ruby
Lepus::Saga::Sequel::Execution.for_resource("Order", order.id).completed.empty?
Lepus::Saga::Sequel::Execution.in_progress.where(partition: "priority")
Lepus::Saga::Sequel::Execution.recent_first.limit(10)
Lepus::Saga::Sequel::Execution.stalled(15 * 60)
execution.step_attempts_dataset.chronological
execution.attempts_for_current_step
Lepus::Saga::Sequel::Execution::STATUSES
```

Defaults (status, direction, epoch, resume count, context, progress clock) are set in `before_validation`, and the JSON columns are serialized there too, so always save through `save`, never with `validate: false`. Saves raise `Sequel::ValidationFailed` on invalid records whatever `raise_on_save_failure` says elsewhere in the app.

Nothing deletes old rows on its own. Prune completed executions (and their step attempts) from a recurring job; call it on a filtered dataset to keep some:

```ruby
Lepus::Saga::Sequel::Execution.prune(finished_before: Time.now.utc - 30 * 86_400)
Lepus::Saga::Sequel::Execution.exclude(id: pinned_ids).prune(finished_before: Time.now.utc - 30 * 86_400)
```

## How it maps the store contract

| Store operation | Sequel |
| --- | --- |
| `with_lock(execution)` | `transaction { execution.lock! }` (reload in place with `SELECT ... FOR UPDATE`) |
| `with_locked_execution(id)` | `transaction { Execution.for_update.first(id:) }`, one query |
| `save_execution`, `save_step_attempt` | `save`, which writes every column, so a context changed in place is persisted |
| `increment_resume_count` | `UPDATE ... SET resume_count = resume_count + 1, updated_at = ?`, then reads the stored value back |
| `create_step_attempt` | `create`; `Sequel::UniqueConstraintViolation` from `idx_saga_step_attempts_dedup` becomes `Lepus::Saga::DuplicateAttemptError` |
| `stalled_executions(before:)` | `in_progress.where(last_progress_at < before).order(:last_progress_at, :id).all` |
| `executions_for_resource` | `for_resource(type, id).recent_first`: `ORDER BY started_at DESC, id DESC` on the resource index |
| attempt queries | `where(saga_execution_id:, step_name:, direction:, epoch:)` plus `count`/`empty?` |
| `list_executions` | Filters on the executions table, ordered by `(started_at, id)`, `(duration_ms, id)` or `(finished_at, id)` in the requested direction. Paging is keyset: rows after `after` compare against its stored value in a subquery (`col <= (SELECT col ... WHERE id = ?) AND (col < (SELECT ...) OR id < ?)` descending, `>=` and `>` ascending); the bare bound lets the `(column, id)` index start at the cursor instead of reading every row before it. For a nullable sort it runs at most two queries, the rows with a value and then, when the page is not full, the rows without one by id, so both use the `(column, id)` index and nulls come last either way; the resource search is `ILIKE` with the LIKE wildcards escaped; the error filters are `id IN (SELECT saga_execution_id FROM saga_step_attempts WHERE status = 'failed' ...)` |
| `count_executions` | `group_and_count(...)`; grouping by partition also groups by saga name to resolve executions without one |
| `finished_executions` | Base's: `count_executions` grouped by saga and status over `finished_from`/`finished_to`, then one `list_executions(sort: :finished_at)` per saga, on the `finished_at` index |
| `executed_steps` | One `SELECT DISTINCT saga_execution_id, step_name FROM saga_step_attempts WHERE saga_execution_id IN (...) AND direction = 'execute'` for every execution `/api/recent` lists |
| `execution_series` | Selects `started_at`, and `finished_at` and `status` of terminal executions, newest first and at most `max_rows` + 1; buckets them in Ruby |
| `step_latency` | Joins attempts to executions and selects the newest `max_rows` + 1 durations; percentiles in Ruby |
| `failure_summary` | `GROUP BY error_class, saga_name, step_name` with `COUNT(*)` and `COUNT(DISTINCT saga_execution_id)`, ordered by `COUNT(*)` and `MAX(finished_at)`, then one query per group for its latest failure |
| `saga_names` | `distinct.order(:saga_name).select_map(:saga_name)` |

The query methods (the optional part of the contract, used by dashboards) stick to SQL every supported database runs the same way: no `date_trunc`, no `percentile_cont`.

The methods that return several records return Arrays: the engine runs other queries while it walks them, which Sequel's streaming `each` does not allow.

On SQLite, which has no `FOR UPDATE`, the store opens its lock transactions as `IMMEDIATE`: the write lock is taken up front, so a second locker waits instead of reading alongside, and writers are serialized on the whole database instead of one row.

### No optimistic locking

The engine's concurrency control is the row lock plus the epoch fence: every change to an execution happens under `with_lock`, and the one write made without it, the healer's `resume_count` bump, is a single atomic `UPDATE`. Optimistic locking would add nothing, so the models do not load Sequel's `optimistic_locking` plugin and the migration creates no `lock_version` column.

The `many_to_one :execution` of a step attempt is not validated, because the foreign key already guards it and validating it would load the execution again on every attempt the executor opens under the lock.

## Existing tables

The migration uses `create_table?`, so it adopts tables that already exist (created by hand or by the lepus-saga-active_record generator). Note that rolling it back drops them.

Tables created by hand (PostgreSQL `uuid` ids, `jsonb` context) work too: the models set UUIDv7 ids before insert and read the JSON columns whether the driver returns a String or a parsed value (the `pg_json` extension). Rows written with ids that are not time-ordered (e.g. random UUIDv4) list in time order, since the store sorts by started_at (or duration) and only breaks ties by id. Adopted tables keep their own columns and indexes: add `saga_executions.duration_ms` (`Bignum`) and the indexes listed above in a migration of your own, and backfill the duration of finished executions.

## Architecture

```
lepus-saga                         lepus-saga-sequel
──────────                         ─────────────────
Lepus::Saga::Stores::Base   <───   Lepus::Saga::Stores::Sequel
ExecutionBehaviour          <───   Lepus::Saga::Sequel::Execution
StepAttemptBehaviour        <───   Lepus::Saga::Sequel::StepAttempt
"a lepus saga store"        ───>   spec/lepus/saga/stores/sequel_spec.rb
"a lepus saga engine"       ───>   (contract and full engine on every database)
"a lepus saga query store"  ───>
                                   lib/lepus/saga/sequel/migrations
```

## Development

```bash
bin/setup
bundle exec rspec       # SQLite file in tmp/
bundle exec rubocop
```

Against PostgreSQL and MariaDB, start the databases with `docker compose up -d` and run:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/lepus_saga_test BUNDLE_GEMFILE=ci/Gemfile.postgresql bundle exec rspec
DATABASE_URL="mysql2://root:root@127.0.0.1:3317/lepus_saga_test?fractional_seconds=true" BUNDLE_GEMFILE=ci/Gemfile.mariadb bundle exec rspec
```

Examples tagged `:row_locks` (one row locked while another stays free, a single `FOR UPDATE` query) are skipped on SQLite.

The Gemfile uses `../lepus-saga` when it exists (or `LEPUS_SAGA_PATH`), and the GitHub repository otherwise.

## License

The gem is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
