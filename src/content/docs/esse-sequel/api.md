---
title: API Reference
slug: api
order: 29
project: esse-sequel
---
## `Esse::Plugins::Sequel`

Registered with:

```ruby
plugin :sequel
```

### Repository class methods

#### `collection(model, **opts, &block)`

Accepts a `Sequel::Model` class or a `Sequel::Dataset`. Produces an `Esse::Sequel::Collection` subclass.

| Argument | Description |
|----------|-------------|
| `model` | Sequel model class or dataset |
| `batch_size:` | Records per batch (default `1000`) |
| `connect_with:` | Hash of `{role:, shard:}` for connection switching |
| `&block` | Evaluated in the collection class scope (`scope`, `batch_context`, `connected_to`) |

#### `dataset(**params)`

Returns the filtered `Sequel::Dataset` after applying scopes.

---

## `Esse::Sequel::Collection`

Base class. Same interface as `Esse::ActiveRecord::Collection`.

### Class-level DSL

- `scope(name, proc = nil, override: false, &block)` — define a named scope.
- `batch_context(name, proc = nil, override: false, &block)` — define a batch enrichment fetcher.
- `connected_to(**kwargs)` — set DB role/shard.

### Instance methods

| Method | Description |
|--------|-------------|
| `each { |rows, **ctx| }` | Iterate batches with scopes + contexts applied |
| `each_batch_ids { |ids| }` | Iterate ID-only batches |
| `count` / `size` | Total row count |
| `dataset(**kwargs)` | Filtered `Sequel::Dataset` |

Constructor:

```ruby
CollectionClass.new(start: 1, finish: 10_000, batch_size: 500, **scope_args)
```

---

## `Esse::Sequel::Model`

Mixin for Sequel models. `include` it to enable callbacks.

### `index_callback(reference, on: [...], with: nil, **opts, &block)`

Registers an `after_commit` callback.

| Option | Description |
|--------|-------------|
| `reference` | `'index_name:repo_name'` (or class form) |
| `on:` | Subset of `[:create, :update, :destroy]`, default all |
| `with:` | `:update` for partial updates |
| `if:` / `unless:` | Conditional predicates |
| `&block` | Optional — return the object to index |

Raises if the same repo already has a callback registered.

### `update_lazy_attribute_callback(reference, attribute, on: [...], **opts, &block)`

Registers a callback that calls `repo.update_documents_attribute(attribute, ids, opts)`.

### `without_indexing(*repos, &block)`

Temporarily disables callbacks for this model class.

### `esse_callbacks`

Returns a frozen hash of registered callbacks per reference.

---

## `Esse::Sequel::Hooks`

Includes `Esse::Hooks[store_key: :esse_sequel_hooks]`. See [esse-hooks](/esse-hooks/) for the full API. Methods include:

- `disable!` / `enable!` (global or per-repo).
- `with_indexing` / `without_indexing` (scoped).
- `with_indexing_for_model` / `without_indexing_for_model`.
- `enabled?` / `disabled?` / `enabled_for_model?`.
- `resolve_index_repository(reference)`.

---

## Built-in callbacks

Registered in `Esse::Sequel::Callbacks`. All inherit from `Esse::Sequel::Callback`.

| Callback | Behavior |
|----------|----------|
| `IndexingOnCreate` | `repo.index(document)` on create |
| `IndexingOnUpdate` | `repo.update(document)` or `repo.index(document)` (depending on `with:`). Handles routing changes by deleting the previous document at the old routing. |
| `IndexingOnDestroy` | `repo.delete(document)` on destroy. Silently handles `NotFoundError`. |
| `UpdateLazyAttribute` | `repo.update_documents_attribute(attribute, ids, opts)` |

---

## Deprecated methods

| Deprecated | Use instead |
|------------|-------------|
| `index_callbacks` | `index_callback` |
| `esse_index_repos` | `esse_callbacks` |
