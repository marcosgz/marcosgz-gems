---
title: Usage Guide
slug: usage
order: 3
project: esse-will_paginate
---
## Installation

```ruby
# Gemfile
gem 'esse'
gem 'will_paginate'
gem 'esse-will_paginate'
```

On load the gem `include`s `Esse::WillPaginate::Pagination::SearchQuery` into `Esse::Search::Query`. Nothing else to configure.

## Paginating a search

```ruby
query = UsersIndex
  .search(body: { query: { match_all: {} } })
  .paginate(page: params[:page], per_page: 20)

query.limit_value   # => 20
query.offset_value  # => (page - 1) * 20
```

`paginate(options = {})` accepts:

- `:page` — 1-indexed page number (defaults to `1`).
- `:per_page` — items per page (defaults to `WillPaginate.per_page`).

It delegates to `.limit(per_page).offset((page - 1) * per_page)`, so the underlying ES request receives standard `from` / `size` params.

## Passing `from` / `size` directly

If you already carry pagination state in the query body, skip `.paginate` — `paginated_results` reads `limit_value` / `offset_value` straight from the query:

```ruby
query = UsersIndex.search(body: { query: { match: { name: 'john' } }, from: 20, size: 10 })
query.paginated_results.current_page # => 3
```

## Rendering with WillPaginate helpers

`paginated_results` returns a `WillPaginate::Collection` so all standard helpers work out of the box:

```erb
<%= will_paginate @search.paginated_results %>
<% @search.paginated_results.each do |hit| %>
  <li><%= hit.dig('_source', 'name') %></li>
<% end %>
```

Note that the collection holds the raw ES hit hashes — use `hit['_source']` to reach your document fields.

## Multiple indices

`Esse.cluster.search(...)` returns the same query class, so `.paginate` works across indices:

```ruby
query = Esse.cluster
  .search(CitiesIndex, CountiesIndex, body: { query: { match: { name: 'river' } } })
  .paginate(page: params[:page], per_page: 15)

query.paginated_results
```

## WillPaginate configuration

Standard WillPaginate defaults apply — set them wherever your app already configures WillPaginate:

```ruby
WillPaginate.per_page = 25
```

## Patterns

### Search service with pagination

```ruby
class UserSearch
  def initialize(q:, page: 1, per_page: 20)
    @q, @page, @per_page = q, page, per_page
  end

  def call
    UsersIndex
      .search(body: body)
      .paginate(page: @page, per_page: @per_page)
  end

  private

  def body
    {
      query: { multi_match: { query: @q, fields: %w[name email] } },
      sort:  [{ created_at: 'desc' }],
    }
  end
end

result = UserSearch.new(q: 'john', page: params[:page]).call
result.paginated_results
```

### Iterating all results

For iterating every document, prefer `.scroll_hits` / `.search_after_hits` from core Esse — pagination is for user-facing pages. ES by default caps `from + size` at 10k.

```ruby
UsersIndex.search(body: { query: { match_all: {} } }).scroll_hits(batch_size: 1_000) do |batch|
  batch.each { |hit| ... }
end
```
