---
title: esse-async_indexing
slug: index
order: -1
project: esse-async_indexing
---
Background indexing for [Esse](/esse/). Offload index/update/delete and bulk import operations to **Sidekiq** or **Faktory** instead of running them inline.

## What you get

- Jobs for all standard operations: index, update, upsert, delete, import IDs, import all, bulk lazy-attribute update.
- A plugin (`plugin :async_indexing`) that adds `batch_ids` and `async_indexing_job` DSL to repositories.
- CLI commands: `esse index async_import`, `esse index async_update_lazy_attributes`.
- ActiveRecord integration: `async_index_callback`, `async_update_lazy_attribute_callback`.
- Per-operation configuration of queue, retries, and custom job classes.

## Contents

- [Usage guide](/esse-async_indexing/usage/)
- [API reference](/esse-async_indexing/api/)

## Quick start

```ruby
# Gemfile
gem 'esse', '>= 0.4.0.rc1'
gem 'esse-async_indexing'
gem 'sidekiq' # or 'faktory_worker_ruby'
```

```ruby
# config/initializers/esse.rb
require 'esse/async_indexing'

Esse.configure do |config|
  config.async_indexing.sidekiq do |sidekiq|
    sidekiq.redis = ConnectionPool.new(size: 10) { Redis.new(url: ENV['REDIS_URL']) }
  end
end
```

```ruby
# app/indices/geos_index.rb
class GeosIndex < Esse::Index
  plugin :async_indexing

  repository :city do
    collection Collections::CityCollection
    document Documents::CityDocument
  end
end

class Collections::CityCollection < Esse::Collection
  def each(&block)
    ::City.find_in_batches { |rows| block.call(rows, @params) }
  end

  # REQUIRED for async indexing — yields ID batches for ImportIdsJob
  def each_batch_ids
    ::City.select(:id).find_in_batches { |rows| yield(rows.map(&:id)) }
  end
end
```

Run an async import:

```bash
bundle exec esse index async_import GeosIndex --repo city --service sidekiq
```

With ActiveRecord callbacks:

```ruby
require 'esse/async_indexing/active_record'

class City < ApplicationRecord
  include Esse::AsyncIndexing::ActiveRecord::Model
  async_index_callback('geos_index:city', service_name: :sidekiq) { id }
end
```

## Version

- Version: **0.1.0.rc4**
- Ruby: `>= 2.7.0`
- Depends on: `esse >= 0.4.0.rc1`, `background_job`, `multi_json`

## License

MIT.
