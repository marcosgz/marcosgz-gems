---
title: Usage Guide
slug: usage
order: 3
project: esse-jbuilder
---
## Installation

```ruby
# Gemfile
gem 'esse'
gem 'esse-jbuilder'
```

Loading the gem prepends Jbuilder-aware behavior to `Esse::Search::Query`.

## Inline Jbuilder

Pass a block to any `search` call and the block becomes the search body:

```ruby
query = UsersIndex.search do |json|
  json.query do
    json.match do
      json.set! 'name', params[:q]
    end
  end
end

query.response.results
```

For complex queries, Jbuilder's DSL is often easier than nested hashes:

```ruby
UsersIndex.search do |json|
  json.query do
    json.bool do
      json.must do
        json.child! do
          json.match { json.set! 'name', params[:q] }
        end
      end
      if (states = params[:state_abbr])
        json.filter do
          json.child! do
            json.terms { json.set! 'state_abbr', states }
          end
        end
      end
    end
  end

  json.aggs do
    json.states do
      json.terms { json.set! 'field', 'state_abbr' }
    end
  end
end
```

Multiple indices work the same way:

```ruby
Esse.cluster.search(CitiesIndex, CountiesIndex) do |json|
  json.query do
    json.match_all
  end
end
```

## Template files

Set the template directory (default `app/searches`):

```ruby
Esse.configure do |config|
  config.search_view_path = 'app/searches'
end
```

Create `app/searches/cities/search.json.jbuilder`:

```jbuilder
json.query do
  json.match do
    json.set! 'name', @name
  end
end
```

Render it:

```ruby
body = Esse::Jbuilder::Template.call('cities/search', name: 'Chicago')
CitiesIndex.search(body: body)
```

## Rails view templates

`Esse::Jbuilder::ViewTemplate` uses Rails' ActionView lookup so you can include partials and share them with normal Rails views:

```ruby
# app/searches/cities/search.json.jbuilder
json.query do
  json.match do
    json.set! 'name', @name
  end
end
json.partial! 'shared/pagination', page: @page
```

```ruby
body = Esse::Jbuilder::ViewTemplate.call('cities/search', name: params[:q], page: params[:page])
CitiesIndex.search(body: body)
```

ViewTemplate must be called in a Rails process (needs `ActionView`). It uses your app's full view lookup context, including partials and helpers.

### Symbol keys

By default `ViewTemplate` returns string-keyed hashes. Opt into symbols globally:

```ruby
Esse::Jbuilder::ViewTemplate.symbolize_keys = true
```

## Searcher pattern

A tidy pattern for non-trivial queries:

```ruby
class Searchers::CitiesSearcher
  extend Forwardable
  def_delegators :search, :response, :results

  def initialize(params)
    @params = params.symbolize_keys
  end

  def call
    search
  end

  private

  def search
    @search ||= CitiesIndex
      .search(body: body)
      .limit(@params.fetch(:limit, 10))
      .offset(@params.fetch(:offset, 0))
  end

  def body
    Esse::Jbuilder::ViewTemplate.call('cities/search', **@params)
  end
end

Searchers::CitiesSearcher.new(params).call.results
```

## Tips

- Jbuilder's `json.set!` avoids method-name collisions with Ruby keywords or symbols ES expects (`match_all`, `terms`, etc.).
- Use `json.child!` to build arrays inside `must`, `filter`, `should`, etc.
- Helpers defined in `ApplicationHelper` are available inside `ViewTemplate` because it uses the standard Rails view context.
