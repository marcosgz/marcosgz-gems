---
title: Usage Guide
slug: usage
order: 3
project: esse-rails
---
## Installation

```ruby
# Gemfile
gem 'esse'
gem 'esse-rails'
```

No initializer or configuration is required. On boot the gem:

- Subscribes to every `elasticsearch.*` event published by Esse.
- Adds a thread-local runtime accumulator.
- Includes `ControllerRuntime` into `ActionController::Base` (and API subclass) via `ActiveSupport.on_load`.
- Prepends a CLI autoloader that loads `config/environment.rb` before commands execute.

## Default instrumentation

Every controller action logs the aggregate ES/OS runtime:

```
Completed 200 OK in 125.3ms (Views: 45.2ms | Search: 78.1ms)
```

The runtime is reset at the start of each action, accumulated across all `elasticsearch.*` events during request processing, and appended to the action's payload.

## Lograge integration

If you use [Lograge](https://github.com/roidrage/lograge), require the adapter in your app initializer:

```ruby
# config/application.rb
require 'esse/rails/lograge'

config.lograge.enabled = true
config.lograge.formatter = Lograge::Formatters::Json.new
```

You now get a `search` key (in milliseconds) in every Lograge entry:

```
{"method":"GET","path":"/search","status":200,"duration":380.89,"view":99.64,"db":0.0,"search":279.37}
```

No other changes are needed — the Railtie registers a `custom_options` lambda for you.

## CLI integration

Run `esse` commands inside a Rails app and the environment is loaded automatically:

```bash
bundle exec esse index reset UsersIndex
bundle exec esse index import UsersIndex
```

The autoloader loads `config/environment.rb` before executing the command, giving you access to:

- Models, constants, and the rest of your Rails autoload paths.
- Your `config/esse.rb` or `config/initializers/esse.rb` initializer.
- Rails-dependent plugins (like `esse-active_record`).

## What events are tracked?

The gem subscribes to every event matching `/^elasticsearch/`, which includes:

- `elasticsearch.search`, `elasticsearch.execute_search_query`
- `elasticsearch.bulk`, `elasticsearch.index`, `elasticsearch.update`, `elasticsearch.delete`
- `elasticsearch.get`, `elasticsearch.mget`, `elasticsearch.count`, `elasticsearch.exist`
- `elasticsearch.create_index`, `elasticsearch.delete_index`, `elasticsearch.refresh`
- And others — see [Events](../../esse/docs/events.md).

The runtime of each event is added to `RuntimeRegistry.runtime`. The registry is reset per-action, so the number shown is the sum of time spent in ES/OS during that controller action.

## Thread safety

`RuntimeRegistry` uses `Thread.current`, so each request has an independent view. This matches the pattern that `ActiveRecord::LogSubscriber` uses for `db=` timings.

## Turning it off

You can't turn off the event subscribers from the outside, but you can:

- Subclass `ActionController::Base` with a custom parent and skip including `ControllerRuntime`.
- Log at a different level (Rails' request logging already respects `config.log_level`).

In practice, the instrumentation is low-cost — a hash lookup per event.
