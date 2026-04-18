---
title: esse-rails
slug: index
order: -1
project: esse-rails
---
Rails integration for [Esse](../../esse/docs/README.md). Adds:

- Controller-level instrumentation: "Search: X.Xms" appears alongside "Views" in your logs.
- Lograge integration: a `search` key in your JSON logs.
- Automatic Rails environment loading when the `esse` CLI runs in a Rails app.

## Contents

- [Usage guide](usage.md)
- [API reference](api.md)

## What you see

Without any code changes you get:

```
Processing UsersController#index as HTML
  ...
Completed 200 OK in 125.3ms (Views: 45.2ms | Search: 78.1ms)
```

With Lograge enabled:

```
method=GET path=/search status=200 duration=380.89 view=99.64 db=0.00 search=279.37
```

## Install

```ruby
# Gemfile
gem 'esse'
gem 'esse-rails'
```

That's it. No initializer or DSL is required for controller instrumentation. For Lograge, add a single require (see [Usage](usage.md)).

## Version

- Version: **0.0.4**
- Ruby: `>= 2.5.0`
- Depends on: `esse >= 0.2.2`, `activesupport >= 4.2`

## License

MIT.
