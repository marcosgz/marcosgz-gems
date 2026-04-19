---
title: API Reference
slug: api
order: 29
project: esse-will_paginate
---
## `Esse::WillPaginate::Pagination::SearchQuery`

Included into `Esse::Search::Query` on gem load. You call these methods on the query object returned by `Index#search` / `Esse.cluster.search`.

### Instance methods

| Method | Description |
|--------|-------------|
| `paginate(options = {})` | Set page / per_page. Accepts `:page` and `:per_page`. Delegates to `.limit(per_page).offset((page - 1) * per_page)`. Returns `self`. |
| `paginated_results` | Returns a `WillPaginate::Collection` wrapping the response hits. |

#### `paginate(options = {})`

| Option | Default | Notes |
|---|---|---|
| `:page` | `1` | 1-indexed. Parsed through `WillPaginate::PageNumber`. |
| `:per_page` | `WillPaginate.per_page` | Coerced to Integer via `#to_i`. |

Returns the `Esse::Search::Query` (chainable). Internally calls `limit(per_page).offset((page - 1) * per_page)`.

#### `paginated_results`

Returns a `WillPaginate::Collection` built from the response:

- `current_page` — derived from `(offset_value / limit_value).ceil + 1`
- `per_page` — `limit_value`
- `total_entries` — `response.total`
- Items — `response.hits` (raw ES hit hashes)

This means WillPaginate view helpers (`will_paginate`, `page_entries_info`, etc.) work out of the box.

## Integration

On `require 'esse/will_paginate'` (or via Gemfile autoload):

```ruby
Esse::Search::Query.__send__(:include, Esse::WillPaginate::Pagination::SearchQuery)
```

No plugin registration, no configuration — it's active as soon as the gem is loaded.

## Notes

- Hits are the raw ES/OS hit hashes — use `hit['_source']` to read document fields.
- For large datasets prefer `.scroll_hits` / `.search_after_hits` rather than deep pagination; ES by default caps `from + size` at 10k.
- You can skip `.paginate` entirely if you pass `from` / `size` in the search body — `paginated_results` reads `limit_value` / `offset_value` either way.
