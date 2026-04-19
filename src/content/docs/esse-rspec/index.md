---
title: esse-rspec
slug: index
order: -1
project: esse-rspec
---
RSpec helpers for testing [Esse](/esse/)-backed code without hitting a live Elasticsearch/OpenSearch cluster. Stub search and transport calls, assert on request payloads, and scaffold disposable `Esse::Index` classes inside your specs.

## Contents

- [Usage guide](/esse-rspec/usage/)
- [API reference](/esse-rspec/api/)

## What you get

- `esse_receive_request` — an RSpec matcher that intercepts any `Esse::Transport` method on an index or cluster and returns a canned response (or raises a realistic `Esse::Transport::*` error).
- `stub_esse_index` / `stub_esse_class` — scaffold throwaway `Esse::Index` subclasses scoped to a single example, with automatic constant cleanup.
- Auto-included into every example group. No setup beyond `require 'esse/rspec'`.

## Quick start

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

```ruby
it 'queries products' do
  expect(ProductsIndex).to esse_receive_request(:search)
    .with(body: { query: { match_all: {} }, size: 10 })
    .and_return('hits' => { 'total' => 0, 'hits' => [] })

  query = ProductsIndex.search(query: { match_all: {} }, size: 10)
  expect(query.response.total).to eq(0)
end
```

## Version

- Version: **0.0.7**
- Ruby: `>= 2.5.0`
- Depends on: `esse >= 0.2.4`, `rspec >= 3`

## License

MIT.
