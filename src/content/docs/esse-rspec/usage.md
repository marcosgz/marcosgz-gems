---
title: Usage Guide
slug: usage
order: 3
project: esse-rspec
---
## Installation

```ruby
# Gemfile
group :test do
  gem 'esse-rspec'
end
```

```ruby
# spec/spec_helper.rb
require 'esse/rspec'
```

Loading the gem auto-includes `Esse::RSpec::ClassMethods` and `Esse::RSpec::Matchers` into every `RSpec.configure` example group. Nothing else to wire up.

## Stubbing requests

`esse_receive_request(:method)` wraps RSpec's `receive` against the Esse transport. It accepts the name of any `Esse::Transport` instance method (`:search`, `:get`, `:index`, `:update`, `:delete`, `:bulk`, `:count`, `:indices`, ...). The matcher works on both index classes and `Esse::Cluster` instances.

### Return a response

```ruby
expect(ProductsIndex).to esse_receive_request(:search)
  .with(body: { query: { match_all: {} }, size: 10 })
  .and_return('hits' => { 'total' => 0, 'hits' => [] })

query = ProductsIndex.search(query: { match_all: {} }, size: 10)
query.response.total # => 0
```

When the target is an `Esse::Index` subclass, the matcher auto-injects `index: [...]` into the expected arguments using `Esse::Search::Query.normalize_indices`, so you only need to declare the `body` (and any other params you want to assert on).

### Loose matching with RSpec argument matchers

`.with(...)` also accepts any single RSpec argument matcher instead of a literal Hash — useful when you care about a subset of the request:

```ruby
expect(PostsIndex).to esse_receive_request(:search)
  .with(
    hash_including(
      _source: false,
      body: hash_including('aggregations' => anything),
    ),
  )
  .and_return('aggregations' => { 'tags' => { 'buckets' => [] } })
```

This asserts that `_source: false` and a `body` containing an `aggregations` key are present, without constraining the rest of the payload. You can mix and match any composable matcher — `hash_including`, `a_hash_including`, `array_including`, `an_instance_of`, `anything`, `match(/.../)`, etc.

Note: when you pass a matcher object to `.with(...)`, the index auto-injection is skipped — the matcher becomes the whole expectation. If you need to assert on the target index alongside the matcher, include it explicitly:

```ruby
expect(PostsIndex).to esse_receive_request(:search)
  .with(hash_including(index: ['posts'], body: hash_including('aggregations' => anything)))
  .and_return(...)
```

### Raise an HTTP status error

```ruby
expect(ProductsIndex).to esse_receive_request(:search)
  .with(body: { query: { match_all: {} }, size: 10 })
  .and_raise_http_status(500, { 'error' => 'Something went wrong' })

expect {
  ProductsIndex.search(query: { match_all: {} }, size: 10).response
}.to raise_error(Esse::Transport::InternalServerError)
```

`and_raise_http_status` maps the status code to the matching `Esse::Transport::*` subclass (300–510 are covered; anything unmapped falls back to `Esse::Transport::ServerError`).

### Raise a specific error class

```ruby
expect(ProductsIndex).to esse_receive_request(:search)
  .and_raise(Esse::Transport::BadRequestError, { 'error' => 'bad body' })
```

### Cluster-level stubs

Use `Esse.cluster` (or `Esse.cluster(:name)`) as the target when you want to stub transport calls that aren't index-scoped:

```ruby
expect(Esse.cluster(:default)).to esse_receive_request(:search)
  .with(index: 'geos_*', body: { query: { match_all: {} }, size: 10 })
  .and_return('hits' => { 'total' => 0, 'hits' => [] })

Esse.cluster(:default).search('geos_*', body: { query: { match_all: {} }, size: 10 })
```

```ruby
expect(Esse.cluster).to esse_receive_request(:get)
  .with(id: '1', index: 'products')
  .and_return('_id' => '1', '_source' => { title: 'Product 1' })

Esse.cluster.api.get('1', index: 'products')
```

### Call counts

```ruby
expect(ProductsIndex).to esse_receive_request(:search).once.and_return(...)
expect(ProductsIndex).to esse_receive_request(:search).twice.and_return(...)
expect(ProductsIndex).to esse_receive_request(:search).exactly(3).and_return(...)
expect(ProductsIndex).to esse_receive_request(:search).at_least(1).and_return(...)
expect(ProductsIndex).to esse_receive_request(:search).at_most(5).and_return(...)
```

### Call through to the real transport

```ruby
expect(ProductsIndex).to esse_receive_request(:search).and_call_original
```

## Stubbing Esse::Index classes

When a spec needs an index class that doesn't exist in the codebase (or you want an isolated one for a single example), use `stub_esse_index`:

```ruby
before do
  stub_esse_index('products') do
    repository :product, const: true do
      # mappings, collection, document, etc.
    end
  end
end

it 'defines the ProductsIndex class' do
  expect(ProductsIndex).to be < Esse::Index
  expect(ProductsIndex::Product).to be < Esse::Index::Repository
end
```

The class is installed via `stub_const`, so it disappears at the end of the example. The first argument is camelized and suffixed with `Index` if needed (`'products'` → `ProductsIndex`, `'ProductsIndex'` → `ProductsIndex`).

Need a different superclass?

```ruby
stub_esse_index('products', CustomIndex) do
  # ...
end
```

For arbitrary stubbed classes (not necessarily `Esse::Index` subclasses), use the lower-level helper:

```ruby
stub_esse_class('My::Service', SomeBaseClass) do
  def call; end
end
```

## Patterns

### Shared helpers for fixtures

```ruby
module IndexStubs
  def stub_products_index
    stub_esse_index('products') do
      repository :product, const: true do
        document { |record| { id: record[:id], name: record[:name] } }
      end
    end
  end
end

RSpec.configure { |c| c.include IndexStubs }
```

### Verifying bulk operations

```ruby
expect(ProductsIndex).to esse_receive_request(:bulk)
  .with(hash_including(body: array_including(an_instance_of(Hash))))
  .and_return('errors' => false, 'items' => [])
```

### Legacy `stub_esse_search`

An older convenience helper still exists:

```ruby
stub_esse_search(ProductsIndex, body: { ... }) do
  { 'hits' => { 'total' => 0, 'hits' => [] } }
end
```

Prefer `esse_receive_request(:search)` — it's composable with `.with`, `.and_raise`, and call-count modifiers. `stub_esse_search` is kept for backward compatibility and may be removed in a future release.
