---
title: API Reference
slug: api
order: 29
project: esse-rspec
---
## `Esse::RSpec::Matchers`

Auto-included into every example group.

### `esse_receive_request(transport_method, **definition)` → `EsseReceiveRequest`

Build a matcher that expects the given `Esse::Transport` instance method to be called. `transport_method` must be a real method on `Esse::Transport` (e.g. `:search`, `:get`, `:bulk`, `:index`, `:update`, `:delete`, `:count`, `:indices`, `:cluster`, ...); passing anything else raises `ArgumentError`.

Optional trailing `definition` hash is merged into the expected call arguments, same as calling `.with(...)` afterwards.

Also aliased as `receive_esse_request`.

```ruby
expect(ProductsIndex).to esse_receive_request(:search).with(body: { ... }).and_return(...)
```

### `EsseReceiveRequest`

Chainable DSL for describing the expected request and its response.

#### `#with(definition)` → `self`

Describe the expected call signature. Accepts either:

- a **Hash** — merged into the existing `@definition` (keys coerced to symbols). Values can be literals or any composable RSpec matcher.
- a **single RSpec argument matcher** (e.g. `hash_including(...)`) — replaces `@definition` wholesale and is forwarded to `receive(...).with(matcher)`.

```ruby
# Hash form — merged, keys symbolized
.with(index: 'products', body: a_hash_including(query: a_hash_including(:match_all)))

# Matcher form — replaces the entire definition
.with(hash_including(_source: false, body: hash_including('aggregations' => anything)))
```

When the expectation target is an `Esse::Index` subclass, the matcher auto-injects `index: [...]` into `@definition` — but **only** when `@definition` is still a Hash without an `:index` key. If you pass an RSpec argument matcher to `.with(...)`, the auto-injection is skipped; include `index:` explicitly in the matcher if you need to assert on it.

#### `#and_return(response)` → `self`

Return `response` when the transport method is called. `response` is typically a `Hash` in the shape Elasticsearch would produce.

#### `#and_raise_http_status(status, response = nil)` → `self`

Raise the `Esse::Transport::*` error class that maps to `status`. If `response` is given, it becomes the error message body. Mapping is defined by `STATUS_ERRORS`:

| Status range | Example class |
| --- | --- |
| 300–308 | `Esse::Transport::MultipleChoicesError`, `FoundError`, ... |
| 400–418 | `BadRequestError`, `UnauthorizedError`, `NotFoundError`, `ConflictError`, ... |
| 421–499 | `TooManyConnectionsFromThisIPError`, `ClientClosedRequestError`, ... |
| 500–510 | `InternalServerError`, `BadGatewayError`, `ServiceUnavailableError`, ... |

Unmapped codes fall back to `Esse::Transport::ServerError`.

#### `#and_raise(error_class, response = nil)` → `self`

Raise an arbitrary error class when the transport method is called.

#### `#and_call_original` → `self`

Invoke the real transport method instead of returning a canned response. Useful when you only care about asserting the call happened.

#### Call-count modifiers

- `#once` — equivalent to `#exactly(1)`
- `#twice` — equivalent to `#exactly(2)`
- `#exactly(times)`
- `#at_least(times)`
- `#at_most(times)`

All chainable; the last one wins.

#### `#matches?(index_or_cluster)`

Called by RSpec. Accepts:

- an `Esse::Cluster` instance — used as-is
- an `Esse::Index` subclass — resolves the cluster via `index.cluster`. If `@definition` is still a Hash without an `:index` key, injects `index: [...]` derived from the class; if `@definition` was replaced by an RSpec argument matcher, no injection is performed.
- a `Symbol` or `String` naming a configured cluster (see `Esse.config.cluster_ids`)

Anything else raises `ArgumentError`.

---

## `Esse::RSpec::ClassMethods`

Auto-included into every example group.

### `#stub_esse_index(name, superclass = nil, &block)` → `Class`

Install a disposable subclass of `Esse::Index` (or `superclass`) under a constant derived from `name`. Name is camelized via `Esse::Hstring` and suffixed with `Index` unless it already ends that way.

```ruby
stub_esse_index('products')              # → ProductsIndex < Esse::Index
stub_esse_index('ProductsIndex')         # → ProductsIndex < Esse::Index
stub_esse_index('products', CustomIndex) # → ProductsIndex < CustomIndex
```

If a block is given, it is `class_eval`'d inside the new class — the idiomatic place to declare `repository`, `settings`, `mappings`, etc. The constant is installed with `stub_const`, so it's automatically uninstalled at the end of the example.

### `#stub_esse_class(name, superclass = nil, &block)` → `Class`

Lower-level form: define any class (not restricted to `Esse::Index`) and install it with `stub_const`. Used internally by `stub_esse_index`.

```ruby
stub_esse_class('My::Service', BaseService) do
  def call; end
end
```

### `#stub_esse_search(*cluster_and_indexes, **definition, &block)` → matcher

Legacy helper. Combines target resolution and `esse_receive_request(:search).and_return(block.call)` into one call.

```ruby
stub_esse_search(ProductsIndex, body: { ... }) do
  { 'hits' => { 'total' => 0, 'hits' => [] } }
end

stub_esse_search(:default, 'geos_*', body: { ... }) do
  # ... response hash
end
```

Prefer `esse_receive_request(:search)` for new specs — it composes with `.with`, `.and_raise`, and call-count modifiers. Kept for backward compatibility.

---

## Integration points

On load (`require 'esse/rspec'`):

1. Requires `esse` and the version/matchers/class-methods files.
2. Declares `Esse::RSpec` module.
3. If `RSpec` is defined, auto-includes both modules into every example group via `RSpec.configure`.

No explicit `plugin :rspec` or `RSpec.configure` hook is required in the host spec suite beyond `require 'esse/rspec'`.
