---
title: API Reference
slug: api
order: 29
project: esse-jbuilder
---
## Configuration

### `Esse::Config#search_view_path`

Added to `Esse::Config`. Default: `Pathname('app/searches')`.

```ruby
Esse.configure do |config|
  config.search_view_path = 'app/searches'        # String
  config.search_view_path = Pathname('searches')  # Pathname
end
```

Read back:

```ruby
Esse.config.search_view_path # => Pathname
```

---

## `Esse::Jbuilder::Template`

Renders a Jbuilder block or a `.json.jbuilder` file into a Hash, independent of Rails.

### `.call(view_filename = nil, **assigns, &block)` → Hash

- If a block is given, renders the block.
- If `view_filename` is given, renders the file from `search_view_path`.
- `assigns` are exposed as `@variables` in the template.

```ruby
# From a block
body = Esse::Jbuilder::Template.call do |json|
  json.query { json.match { json.set! 'name', 'John' } }
end

# From a file
body = Esse::Jbuilder::Template.call('cities/search', name: 'Chicago')
```

### Instance methods

- `initialize(view_filename = nil, **assigns)`
- `to_hash(&block)` — the actual rendering.

---

## `Esse::Jbuilder::ViewTemplate`

Renders a Jbuilder template through Rails' ActionView pipeline. Requires Rails (ActionView) to be loaded. Supports `partial!`, helpers, and full view lookup.

### `.call(view_filename, assigns = {})` → Hash

```ruby
body = Esse::Jbuilder::ViewTemplate.call('cities/search', name: 'Chicago')
```

### Class attributes

- `symbolize_keys` — default `false`. When `true`, the resulting hash uses Symbol keys.

### Instance methods

- `initialize(view_filename, assigns = {})`
- `to_hash` — renders via ActionView.

---

## `Esse::Jbuilder::WithAssigns`

Internal Jbuilder subclass. Used to inject `@assigns` into the template context.

- `__assign(key)` — retrieve an assigned variable by name.

You don't need to use this directly.

---

## `Esse::Jbuilder::SearchRequestView`

Internal ActionView base class used by `ViewTemplate` for the render context.

- `.lookup_context` (class-level, memoized) — returns the `ActionView::LookupContext`.

Not part of the public API.

---

## Integration points

On load the gem:

1. Extends `Esse::Config` with `search_view_path` / `search_view_path=`.
2. Prepends `Esse::Jbuilder::SearchQuery::InstanceMethods` into `Esse::Search::Query`, teaching the query to accept Jbuilder blocks.

No explicit `plugin :jbuilder` call is needed — just `require 'esse/jbuilder'` (or have it in your Gemfile).
