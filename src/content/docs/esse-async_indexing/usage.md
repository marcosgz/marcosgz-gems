---
title: Usage Guide
slug: usage
order: 3
project: esse-async_indexing
---
## Installation

```ruby
# Gemfile
gem 'esse'
gem 'esse-async_indexing'
gem 'sidekiq'  # or 'faktory_worker_ruby'
```

## Configuration

The gem adds `config.async_indexing` to `Esse.configure`:

```ruby
# config/initializers/esse.rb
require 'esse/async_indexing'

Esse.configure do |config|
  config.async_indexing.sidekiq do |sidekiq|
    sidekiq.redis = ConnectionPool.new(size: 10, timeout: 5) do
      Redis.new(url: ENV.fetch('REDIS_URL', 'redis://localhost:6379'))
    end
    sidekiq.namespace = 'myapp' # optional
  end

  # Per-job queue / retry overrides
  config.async_indexing.sidekiq.jobs = {
    'Esse::AsyncIndexing::Jobs::DocumentIndexByIdJob' => { queue: 'indexing' },
    'Esse::AsyncIndexing::Jobs::ImportIdsJob'         => { queue: 'batch_indexing', retry: 2 }
  }
end
```

Faktory equivalents:

```ruby
Esse.configure do |config|
  config.async_indexing.faktory
end
```

Both services can be configured side-by-side; pick per-callback with `service_name:`.

## Enabling the plugin

```ruby
class GeosIndex < Esse::Index
  plugin :async_indexing

  repository :city do
    collection Collections::CityCollection
    document   Documents::CityDocument
  end
end
```

The plugin adds two capabilities to every repository:

1. `batch_ids(*args, **kwargs)` — yields ID batches from the collection (requires `each_batch_ids`).
2. `async_indexing_job(*ops, &block)` — override how jobs are enqueued per operation.

## Collection requirements

Your collection **must implement `each_batch_ids`** for async indexing to work:

```ruby
class CityCollection < Esse::Collection
  def each(&block)
    ::City.find_in_batches { |rows| block.call(rows, @params) }
  end

  def each_batch_ids
    ::City.select(:id).find_in_batches { |rows| yield(rows.map(&:id)) }
  end
end
```

`esse-active_record` and `esse-sequel` collections already implement this.

## Async callbacks

```ruby
require 'esse/async_indexing/active_record'

class City < ApplicationRecord
  include Esse::AsyncIndexing::ActiveRecord::Model

  async_index_callback('geos_index:city', service_name: :sidekiq) { id }

  async_update_lazy_attribute_callback(
    'states_index:state', 'cities_count',
    if: :state_id?,
    service_name: :sidekiq
  ) { state_id }
end
```

Options:

| Option | Description |
|--------|-------------|
| `service_name:` | `:sidekiq` or `:faktory` (required) |
| `on:` | Which events (`:create`, `:update`, `:destroy`). Default: all |
| `with:` | `:update` for partial updates |
| `if:` / `unless:` | Standard AR conditionals |
| `**other` | Forwarded to the job |

The block returns the document ID(s) to enqueue.

## Direct job enqueuing

```ruby
# Through the action classes
Esse::AsyncIndexing::Actions::IndexDocument.call('GeosIndex', 'city', city.id)

# Or directly via background_job
BackgroundJob
  .sidekiq('Esse::AsyncIndexing::Jobs::DocumentIndexByIdJob')
  .with_args('GeosIndex', 'city', city.id)
  .push
```

## CLI

### `esse index async_import`

```bash
bundle exec esse index async_import GeosIndex \
  --repo city \
  --service sidekiq \
  --suffix 20240401 \
  --context state_abbr:IL \
  --job-options queue:batch_indexing
```

Options:

| Flag | Description |
|------|-------------|
| `--repo` / `-r` | Repository name |
| `--suffix` / `-s` | Target index suffix |
| `--service` | `sidekiq` or `faktory` |
| `--context` | Hash for scope filtering |
| `--preload-lazy-attributes` | Preload via search |
| `--eager-load-lazy-attributes` | Resolve during bulk |
| `--update-lazy-attributes` | Refresh as partial updates |
| `--enqueue-lazy-attributes` | `true`/`false` — auto-enqueue lazy updates after import |
| `--job-options` | Hash of options applied to each enqueued job |

The command walks `each_batch_ids` and pushes one `ImportIdsJob` per batch. The job then:

1. Calls `Actions::BulkImport` for its batch.
2. Optionally enqueues `BulkUpdateLazyAttributeJob` for each declared lazy attribute.

### `esse index async_update_lazy_attributes`

```bash
bundle exec esse index async_update_lazy_attributes GeosIndex \
  --repo city \
  --service sidekiq \
  cities_count total_schools
```

Enqueues one `BulkUpdateLazyAttributeJob` per attribute + batch.

## Custom job handlers

Override how a specific operation is enqueued:

```ruby
class GeosIndex < Esse::Index
  plugin :async_indexing

  repository :city do
    async_indexing_job(:import) do |service:, repo:, operation:, ids:, **kwargs|
      MyCustomImportJob.perform_async(repo.index.name, ids, kwargs)
    end

    async_indexing_job(:index, :update) do |service:, repo:, operation:, id:, **kwargs|
      # ...
    end
  end
end
```

Or globally in `Esse.configure`:

```ruby
Esse.configure do |config|
  config.async_indexing.task(:import) do |service:, repo:, operation:, ids:, **kwargs|
    CustomJob.perform_later(repo.index.name, ids, **kwargs)
  end
end
```

## Supported adapters

| Adapter | Setup | Notes |
|---------|-------|-------|
| Sidekiq | `config.async_indexing.sidekiq { |s| s.redis = ... }` | Requires Redis |
| Faktory | `config.async_indexing.faktory` | Uses Faktory server |

Both are thin wrappers over the [`background_job`](https://github.com/marcosgz/background_job) gem.

## Operating notes

- **Retries**: Configure per-job via `config.async_indexing.sidekiq.jobs = { 'JobClass' => { retry: 2 } }`.
- **Queues**: Same override mechanism, `queue: 'indexing'`.
- **Error handling**: Jobs handle `Esse::Transport::NotFoundError` silently (treat as already-deleted).
- **Ordering**: Async indexing is eventually consistent — do not rely on ordering between callbacks and reads within the same request.

## Troubleshooting

- **`NotDefinedWorkerError`**: The plugin couldn't find a job class for the service. Ensure `gem 'sidekiq'` or `gem 'faktory_worker_ruby'` is loaded.
- **CLI says collection doesn't implement `each_batch_ids`**: Implement it in your custom `Esse::Collection`, or use `esse-active_record` / `esse-sequel` which provide it out of the box.
- **Jobs run but nothing is indexed**: Check that the index has `plugin :async_indexing` and the collection `batch_ids` yields data. `GeosIndex.repo(:city).implement_batch_ids?` should be `true`.
