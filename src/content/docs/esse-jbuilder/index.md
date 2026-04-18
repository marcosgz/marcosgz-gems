---
title: esse-jbuilder
slug: index
order: -1
project: esse-jbuilder
---
Build Elasticsearch/OpenSearch search bodies with [Jbuilder](https://github.com/rails/jbuilder) instead of nested Ruby hashes. Plays nicely with [Esse](../../esse/docs/README.md) out of the box.

## Contents

- [Usage guide](usage.md)
- [API reference](api.md)

## What you get

- Use Jbuilder blocks directly inside `UsersIndex.search { |json| ... }`.
- Render `.json.jbuilder` template files from `app/searches/`.
- Works across multiple indices (`Esse.cluster.search(Index1, Index2) { |json| ... }`).

## Quick start

```ruby
# Gemfile
gem 'esse', '>= 0.2.4'
gem 'esse-jbuilder'
```

```ruby
# Inline
results = UsersIndex.search do |json|
  json.query do
    json.match do
      json.set! 'name', params[:q]
    end
  end
end

# From a template file (Rails only)
body    = Esse::Jbuilder::ViewTemplate.call('users/search', q: params[:q])
results = UsersIndex.search(body: body)
```

## Configuration

One option:

```ruby
Esse.configure do |config|
  config.search_view_path = 'app/searches' # default
end
```

## Version

- Version: **0.0.5**
- Ruby: `>= 2.5.0`
- Depends on: `esse >= 0.2.4`, `jbuilder >= 2`

## License

MIT.
