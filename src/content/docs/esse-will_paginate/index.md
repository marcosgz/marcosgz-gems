---
title: esse-will_paginate
slug: index
order: -1
project: esse-will_paginate
---
[WillPaginate](https://github.com/mislav/will_paginate) pagination for [Esse](/esse/) search queries.

## Contents

- [Usage guide](/esse-will_paginate/usage/)
- [API reference](/esse-will_paginate/api/)

## Install

```ruby
# Gemfile
gem 'esse'
gem 'will_paginate'
gem 'esse-will_paginate'
```

No configuration is needed. The gem mixes a `paginate` method into every `Esse::Search::Query` on load.

## Quick start

```ruby
@search = UsersIndex
  .search(body: { query: { match: { name: params[:q] } } })
  .paginate(page: params[:page], per_page: 10)

@users = @search.paginated_results
```

In the view:

```erb
<%= will_paginate @users %>
<% @users.each do |hit| %>
  <%= hit['_source']['name'] %>
<% end %>
```

You can also pass `from` / `size` directly in the search body and skip `.paginate`:

```ruby
@search = UsersIndex.search(body: { query: {}, from: 0, size: 10 })
@users  = @search.paginated_results
```

## What's added

Methods added to `Esse::Search::Query`:

- `.paginate(page:, per_page:)` — translate WillPaginate-style pagination into ES `from` / `size`.
- `.paginated_results` — returns a `WillPaginate::Collection` wrapping the response hits, ready for view helpers.

## Version

- Version: **0.0.1**
- Ruby: `>= 2.4.0`
- Depends on: `esse >= 0.2.4`, `will_paginate`

## License

MIT.
