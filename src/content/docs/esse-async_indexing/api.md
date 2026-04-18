---
title: API Reference
slug: api
order: 29
project: esse-async_indexing
---
## `Esse::AsyncIndexing`

### Module methods

#### `worker(worker_class, service:, **options)`

Build a `BackgroundJob` instance for the given worker class and service. Used internally by actions and callbacks.

#### `service_name(identifier = nil)`

Normalize and validate a service identifier (`:sidekiq`, `:faktory`).

#### `async_indexing_repo?(repo)`

Returns `true` if the repo responds to `implement_batch_ids?` and its collection implements `each_batch_ids`.

#### `plugin_installed?(index)`

Returns `true` when `plugin :async_indexing` has been declared on the index.

---

## `Esse::Plugins::AsyncIndexing`

Plugin module. Enable with:

```ruby
class GeosIndex < Esse::Index
  plugin :async_indexing
end
```

### Repository class methods

#### `batch_ids(*args, **kwargs)`

Yields ID batches from the collection. Delegates to `collection.each_batch_ids`. Used by jobs and CLI commands.

#### `implement_batch_ids?`

Returns `true` when the collection implements `each_batch_ids`.

#### `async_indexing_job(*operations, &block)`

Declare a custom job handler for one or more operations.

```ruby
async_indexing_job(:import) do |service:, repo:, operation:, ids:, **kwargs|
  MyJob.perform_async(...)
end
```

Operation keys: `:import`, `:index`, `:update`, `:delete`, `:update_lazy_attribute`.

#### `async_indexing_job?(operation)` / `async_indexing_job_for(operation)`

Check for a custom handler or retrieve it.

---

## `Esse::AsyncIndexing::Configuration`

Accessed via `Esse.config.async_indexing`.

### `sidekiq(&block)` / `faktory(&block)`

Register a service. The block receives a `ConfigService` instance.

```ruby
config.async_indexing.sidekiq do |sidekiq|
  sidekiq.redis = redis_pool
end
```

### `config_for(service)`

Get a previously configured service.

### `services`

Returns a set of configured services (`Set<Symbol>`).

### `task(*operations, &block)`

Register a global task handler. Overrides defaults for the named operations.

---

## `Esse::AsyncIndexing::ConfigService`

Returned by `sidekiq` / `faktory`. Attributes vary per service:

- **Sidekiq**: `redis` (ConnectionPool), `namespace` (String), `jobs` (Hash of per-job overrides).
- **Faktory**: `jobs` (Hash of per-job overrides).

Predicates: `sidekiq?`, `faktory?`.

---

## `Esse::AsyncIndexing::Jobs`

All jobs live under this namespace. Their `.perform(...)` signatures:

| Class | Signature |
|-------|-----------|
| `DocumentIndexByIdJob` | `(index, repo, id, options = {})` |
| `DocumentUpdateByIdJob` | `(index, repo, id, options = {})` |
| `DocumentUpsertByIdJob` | `(index, repo, id, operation = 'index', options = {})` |
| `DocumentDeleteByIdJob` | `(index, repo, id, options = {})` |
| `ImportIdsJob` | `(index, repo, ids, options = {})` |
| `ImportAllJob` | `(index, repo, options = {})` |
| `BulkUpdateLazyAttributeJob` | `(index, repo, attribute, ids, options = {})` |

Each delegates to the matching `Esse::AsyncIndexing::Actions::*` class.

### Module methods

- `Jobs.install!(service, **options)` — require and wire up job classes for the given service.
- `Jobs::DEFAULT` — hash of default job class paths.

---

## `Esse::AsyncIndexing::Actions`

Callable wrappers that execute inline (no queue). Used inside jobs and available for direct calls.

| Class | `.call` signature | Returns |
|-------|--------------------|---------|
| `IndexDocument` | `(index, repo, id, options = {})` | `:indexed` / `:not_found` |
| `UpdateDocument` | `(index, repo, id, options = {})` | `:indexed` / `:not_found` |
| `UpsertDocument` | `(index, repo, id, operation, options = {})` | `:indexed` |
| `DeleteDocument` | `(index, repo, id, options = {})` | `:deleted` / `:not_found` |
| `BulkImport` | `(index, repo, ids, options = {})` | import result |
| `BulkImportAll` | `(index, repo, options = {})` | import result |
| `BulkUpdateLazyAttribute` | `(index, repo, attribute, ids, options = {})` | `ids` |
| `CoerceIndexRepository` | `(index, repo)` | `[index_class, repo_class]`. Raises `ArgumentError` on invalid input. |

---

## `Esse::AsyncIndexing::ActiveRecord::Model`

Requires loading:

```ruby
require 'esse/async_indexing/active_record'

class City < ApplicationRecord
  include Esse::AsyncIndexing::ActiveRecord::Model
end
```

### `async_index_callback(reference, on: [...], with: nil, **opts, &block)`

Enqueue an index/update/delete job on commit.

| Option | Description |
|--------|-------------|
| `reference` | `'index_name:repo_name'` or class-constant form |
| `on:` | `[:create, :update, :destroy]` subset |
| `with:` | `:update` for partial updates |
| `service_name:` | `:sidekiq` or `:faktory` (required) |
| `if:` / `unless:` | Standard AR conditionals |
| `&block` | Returns document IDs to enqueue |

### `async_update_lazy_attribute_callback(reference, attribute, on: [...], **opts, &block)`

Enqueue `BulkUpdateLazyAttributeJob` on commit.

Options are the same as `async_index_callback`, plus `attribute` (first positional).

---

## CLI extensions

Added via `Esse::CLI::Index`:

- `esse index async_import`
- `esse index async_update_lazy_attributes`

See the [usage guide](usage.md) for options.

---

## Errors

| Error | Description |
|-------|-------------|
| `Esse::AsyncIndexing::Error` | Base |
| `Esse::AsyncIndexing::NotDefinedWorkerError` | Raised when no worker is configured for a service |

---

## Integration notes

- Built on top of the [`background_job`](https://github.com/marcosgz/background_job) gem, which abstracts Sidekiq and Faktory.
- `esse-async_indexing` extends `Esse::Config` via module inclusion — the `async_indexing` reader is added automatically when you `require 'esse/async_indexing'`.
- Callbacks register with the `Esse::ActiveRecord::Callbacks` registry (from [esse-active_record](../../esse-active_record/docs/README.md)), so `Esse::ActiveRecord::Hooks.without_indexing` also disables async callbacks.
