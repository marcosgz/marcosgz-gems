---
title: API Reference
slug: api
order: 29
project: esse-rails
---
The gem wires everything up at load time. Its public surface is mostly under-the-hood machinery.

## `Esse::Rails::Instrumentation::ControllerRuntime`

A concern mixed into `ActionController::Base` (and the API subclass) via `ActiveSupport.on_load(:action_controller)`.

### Instance methods

| Method | Description |
|--------|-------------|
| `process_action(action, *args)` | Resets the runtime registry before each action. |
| `cleanup_view_runtime` | Captures the runtime spent during view rendering. |
| `append_info_to_payload(payload)` | Adds `:esse_runtime` to the action payload. |

### Attribute

- `esse_runtime` (attr_internal) — total search runtime in seconds for the request.

The payload key name is `:esse_runtime`. Rails' log subscriber picks it up and prints `Search: X.Xms` alongside `Views:` in the log line.

---

## `Esse::Rails::Instrumentation::RuntimeRegistry`

Thread-local runtime accumulator.

| Method | Description |
|--------|-------------|
| `.runtime` | Current cumulative runtime (Float seconds). Defaults to 0. |
| `.runtime = value` | Set the current cumulative runtime. |
| `.reset` | Returns the current value and resets to 0. |

Stored on `Thread.current`, one slot per thread.

---

## `Esse::Rails::CLI::Autoloader`

Prepended into `Esse::CLI::Root`. Hooks into the `after_initialize` phase of the CLI to require `config/environment.rb` if present.

You don't interact with this directly. It just means CLI commands can reference your Rails models without extra setup.

---

## Lograge Railtie

Loaded with:

```ruby
require 'esse/rails/lograge'
```

### Behavior

- Registers a `config.lograge.custom_options` lambda.
- The lambda extracts `:esse_runtime` from the event payload and adds `search: <ms>` to the Lograge output.
- Multiplier: runtime is converted from seconds (internal) to milliseconds (output).

### Customizing further

If you already use `custom_options`, the library's lambda is merged in. To stack options, wrap it yourself:

```ruby
Rails.application.config.lograge.custom_options = lambda do |event|
  existing = { esse_runtime_ms: ((event.payload[:esse_runtime] || 0) * 1000).round(2) }
  existing.merge(my_stuff(event))
end
```

---

## Event subscriptions

On boot the gem does roughly:

```ruby
Esse::Events.event_names.grep(/^elasticsearch/).each do |name|
  Esse::Events.subscribe(name) do |event|
    runtime = event.payload[:runtime] || 0
    Esse::Rails::Instrumentation::RuntimeRegistry.runtime += runtime
  end
end
```

So every ES/OS operation is tracked automatically, no per-controller configuration required.
