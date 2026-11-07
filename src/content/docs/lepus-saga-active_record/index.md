---
title: Overview
slug: index
order: -1
project: lepus-saga-active_record
---
ActiveRecord store for [lepus-saga](/lepus-saga/). Executions and step attempts live in the `saga_executions` and `saga_step_attempts` tables. Works with PostgreSQL, MySQL/MariaDB and SQLite.

## Installation

```ruby
gem "lepus-saga"
gem "lepus-saga-active_record"
```

```bash
bundle install
bin/rails generate lepus:saga:install
bin/rails db:migrate
```

The generator writes one migration that creates both tables and their indexes. Ids are UUIDv7 strings generated in Ruby, the context columns are `json` and `failure_reason` is `text` (a step's error message can outgrow `VARCHAR(255)`, and MySQL/MariaDB strict mode would reject the write that fails the saga). `saga_executions.duration_ms` is a `bigint` the engine writes when an execution ends. Besides the resource, progress and attempt indexes the engine uses, it indexes what the console sorts and filters on: `saga_executions (started_at, id)`, `(duration_ms, id)`, `(finished_at)`, `(saga_name, started_at)`, `(status, started_at)` and `(partition, started_at)`, and `saga_step_attempts (started_at)` and `(error_class, started_at)`.

```ruby
# config/initializers/lepus_saga.rb
Lepus::Saga.configure do |config|
  config.store = :active_record
end
```

`:active_record` requires `lepus/saga/stores/active_record` and instantiates `Lepus::Saga::Stores::ActiveRecord`. To use your own subclasses of the models (another table name, `connects_to` another database), pass an instance:

```ruby
config.store = Lepus::Saga::Stores::ActiveRecord.new(execution_class: Saga::Execution, step_attempt_class: Saga::StepAttempt)
```

The rest of the setup (definitions, consumers, operations, instrumentation) is in the [lepus-saga README](https://github.com/marcosgz/lepus-saga#readme).

## Models

`Lepus::Saga::ActiveRecord::Execution` and `Lepus::Saga::ActiveRecord::StepAttempt` inherit from the abstract `Lepus::Saga::ActiveRecord::Record` and include the core's `ExecutionBehaviour` and `StepAttemptBehaviour`, so they answer `running?`, `terminal?`, `definition_class`, `partition` and the rest.

```ruby
Lepus::Saga::ActiveRecord::Execution.for_resource("Order", order.id).completed.exists?
Lepus::Saga::ActiveRecord::Execution.in_progress.where(partition: "organic")
Lepus::Saga::ActiveRecord::Execution.recent_first.limit(10)
Lepus::Saga::ActiveRecord::Execution.stalled(15.minutes)
execution.step_attempts.chronological
execution.attempts_for_current_step
Lepus::Saga::ActiveRecord::Execution::STATUSES
```

Nothing deletes old rows on its own. Prune completed executions (and their step attempts) from a recurring job; call it on a relation to keep some:

```ruby
Lepus::Saga::ActiveRecord::Execution.prune(finished_before: 30.days.ago)
Lepus::Saga::ActiveRecord::Execution.where.not(id: pinned_ids).prune(finished_before: 30.days.ago)
```

## How it maps the store contract

| Store operation | ActiveRecord |
| --- | --- |
| `with_lock(execution)` | `execution.with_lock` (reload with `SELECT ... FOR UPDATE` in a transaction) |
| `with_locked_execution(id)` | `transaction { Execution.lock.find_by(id:) }`, one query |
| `increment_resume_count` | `update_counters(id, resume_count: 1, touch: true)`, then reads the stored value back |
| `create_step_attempt` | `create!`; `ActiveRecord::RecordNotUnique` from `idx_saga_step_attempts_dedup` becomes `Lepus::Saga::DuplicateAttemptError` |
| `stalled_executions(before:)` | `in_progress.where(last_progress_at: ...before).order(:last_progress_at, :id)` |
| `executions_for_resource` | `for_resource(type, id).recent_first`: `ORDER BY started_at DESC, id DESC` on the resource index |
| attempt queries | `where(saga_execution_id:, step_name:, direction:, epoch:)` plus `count`/`exists?` |
| `list_executions` | Filters on the executions table, ordered by `(started_at, id)`, `(duration_ms, id)` or `(finished_at, id)` in the requested direction. Paging is keyset: rows after `after` compare against its stored value in a subquery (`col <= (SELECT col ... WHERE id = ?) AND (col < (SELECT ...) OR id < ?)` descending, `>=` and `>` ascending); the bare bound lets the `(column, id)` index start at the cursor instead of reading every row before it. For a nullable sort it runs at most two queries, the rows with a value and then, when the page is not full, the rows without one by id, so both use the `(column, id)` index and nulls come last either way; the resource search is `LOWER(column) LIKE ? ESCAPE '!'`; the error filters are `id IN (SELECT saga_execution_id FROM saga_step_attempts WHERE status = 'failed' ...)` |
| `count_executions` | `group(...).count`; grouping by partition also groups by saga name to resolve executions without one |
| `finished_executions` | Base's: `count_executions` grouped by saga and status over `finished_from`/`finished_to`, then one `list_executions(sort: :finished_at)` per saga, on the `finished_at` index |
| `executed_steps` | One `SELECT DISTINCT saga_execution_id, step_name FROM saga_step_attempts WHERE saga_execution_id IN (...) AND direction = 'execute'` for every execution `/api/recent` lists |
| `execution_series` | Plucks `started_at`, and `finished_at` and `status` of terminal executions, newest first and at most `max_rows` + 1; buckets them in Ruby |
| `step_latency` | Joins attempts to executions and plucks the newest `max_rows` + 1 durations; percentiles in Ruby |
| `failure_summary` | `GROUP BY error_class, saga_name, step_name` with `COUNT(*)` and `COUNT(DISTINCT saga_execution_id)`, ordered by `COUNT(*)` and `MAX(finished_at)`, then one query per group for its latest failure |
| `saga_names` | `distinct.order(:saga_name).pluck(:saga_name)` |

The query methods (the optional part of the contract, used by dashboards) stick to SQL every supported database runs the same way: no `date_trunc`, no `percentile_cont`.

On SQLite `FOR UPDATE` is a no-op; Rails 8 opens SQLite transactions as `IMMEDIATE`, which serializes writers on the whole database instead of one row.

### No optimistic locking

The engine's concurrency control is the row lock plus the epoch fence: every change to an execution happens under `with_lock`, and the one write made without it, the healer's `resume_count` bump, is a single atomic `UPDATE`. Optimistic locking would add nothing and would turn a legacy `lock_version` column into `ActiveRecord::StaleObjectError` on any write from a stale copy. So `Execution.lock_optimistically = false`, and the generator no longer creates `lock_version`. Tables that already have it keep working: the column has a default and is ignored.

The `belongs_to :execution` of a step attempt is optional, because the foreign key already guards it and validating it would load the execution again on every attempt the executor opens under the lock.

## Existing tables

Tables created by hand or before the generator (PostgreSQL `uuid` ids with `gen_random_uuid()` defaults, `jsonb` context, a `lock_version` column) work unchanged: the models set UUIDv7 ids before insert, read `jsonb` through the `json` attribute type and ignore `lock_version`. Rows written with ids that are not time-ordered (e.g. random UUIDv4) list in time order, since the store sorts by started_at (or duration) and only breaks ties by id.

Such tables, and tables created by the 0.3.0 install generator, lack the `duration_ms` column and some of the indexes the install migration creates. Add them in a migration of your own; `if_not_exists: true` skips the indexes a table already has:

```ruby
add_column :saga_executions, :duration_ms, :bigint, if_not_exists: true
add_index :saga_executions, [:started_at, :id], if_not_exists: true
add_index :saga_executions, [:duration_ms, :id], if_not_exists: true
add_index :saga_executions, :finished_at, if_not_exists: true
add_index :saga_executions, [:saga_name, :started_at], if_not_exists: true
add_index :saga_executions, [:status, :started_at], if_not_exists: true
add_index :saga_executions, [:partition, :started_at], if_not_exists: true
add_index :saga_step_attempts, :started_at, if_not_exists: true
add_index :saga_step_attempts, [:error_class, :started_at], if_not_exists: true
```

and backfill the duration of finished executions, for example with `Lepus::Saga::ActiveRecord::Execution.where.not(finished_at: nil).find_each { |execution| execution.update_columns(duration_ms: ((execution.finished_at - execution.started_at) * 1000).round) }`. The `created_at` indexes of 0.3.0 (`[:saga_name, :created_at]`, `[:status, :created_at]`, `[:partition, :created_at]`) are no longer used and can be dropped.

## Architecture

```
lepus-saga                         lepus-saga-active_record
──────────                         ────────────────────────
Lepus::Saga::Stores::Base   <───   Lepus::Saga::Stores::ActiveRecord
ExecutionBehaviour          <───   Lepus::Saga::ActiveRecord::Execution
StepAttemptBehaviour        <───   Lepus::Saga::ActiveRecord::StepAttempt
"a lepus saga store"        ───>   spec/lepus/saga/stores/active_record_spec.rb
"a lepus saga engine"       ───>   (contract and full engine on every database)
"a lepus saga query store"  ───>
                                   lib/generators/lepus/saga/install
```

This gem is also the reference for writing another adapter (Sequel, ROM, a key-value store):

1. Name the gem `lepus-saga-<name>` and define `Lepus::Saga::Stores::<Name> < Lepus::Saga::Stores::Base` in `lib/lepus/saga/stores/<name>.rb`, so `config.store = :<name>` finds it.
2. Include `Lepus::Saga::ExecutionBehaviour` and `Lepus::Saga::StepAttemptBehaviour` into your record classes.
3. Implement each method of `Stores::Base` documented in lepus-saga's `lib/lepus/saga/stores/base.rb`.
4. Run the shared examples against every database you support:

```ruby
require "lepus/saga/rspec"

RSpec.describe Lepus::Saga::Stores::Sequel do
  let(:store) { described_class.new }

  it_behaves_like "a lepus saga store"
  it_behaves_like "a lepus saga engine"
  it_behaves_like "a lepus saga query store" # only if the store implements the optional query methods
end
```

The lepus-saga README has a Sequel sketch.

## Development

```bash
bin/setup
bundle exec rspec       # SQLite file in tmp/
bundle exec rubocop
```

Against PostgreSQL and MariaDB, start the databases with `docker compose up -d` and run:

```bash
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/lepus_saga_test BUNDLE_GEMFILE=ci/Gemfile.postgresql bundle exec rspec
DATABASE_URL=mysql2://root:root@127.0.0.1:3317/lepus_saga_test BUNDLE_GEMFILE=ci/Gemfile.mariadb bundle exec rspec
```

Examples tagged `:row_locks` (one row locked while another stays free, a single `FOR UPDATE` query) are skipped on SQLite.

The Gemfile uses `../lepus-saga` when it exists (or `LEPUS_SAGA_PATH`), and the GitHub repository otherwise.

## License

The gem is available as open source under the terms of the [MIT License](https://opensource.org/licenses/MIT).
