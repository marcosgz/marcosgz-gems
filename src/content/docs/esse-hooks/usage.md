---
title: Usage Guide
slug: usage
order: 3
project: esse-hooks
---
This gem is the state machinery behind `Esse::ActiveRecord::Hooks` and `Esse::Sequel::Hooks`. In most apps, you use the plugin-specific namespace rather than this gem directly.

## For end users

If you are using [esse-active_record](../../esse-active_record/docs/README.md) or [esse-sequel](../../esse-sequel/docs/README.md), use their hook modules:

```ruby
Esse::ActiveRecord::Hooks.disable!
Esse::ActiveRecord::Hooks.enable!

Esse::ActiveRecord::Hooks.without_indexing do
  # callbacks disabled in this block
end

Esse::ActiveRecord::Hooks.without_indexing(UsersIndex.repo(:user)) do
  # only that repo disabled
end

Esse::ActiveRecord::Hooks.without_indexing_for_model(User, UsersIndex.repo(:user)) do
  # only User + that repo disabled
end
```

Call `Esse::Hooks.disable!` to disable **all** registered hook modules (both ActiveRecord and Sequel) at once.

## For plugin authors

Use `Esse::Hooks[store_key: :unique_key]` to create an isolated hook module:

```ruby
module MyPlugin
  module Hooks
    include Esse::Hooks[store_key: :my_plugin_hooks]
  end
end

MyPlugin::Hooks.disable!
```

The `store_key` identifies the backing `Thread.current` slot. Choose a unique symbol per plugin.

### Registering models

Typically when a model includes your plugin, you register it:

```ruby
module MyPlugin::Model
  def self.included(base)
    MyPlugin::Hooks.register_model(base)
  end
end
```

After registration, `MyPlugin::Hooks.models` lists all models that opted into the system.

### Respecting hooks in callbacks

When your plugin runs a callback, check enabled state first:

```ruby
def on_after_commit(model)
  return unless MyPlugin::Hooks.enabled_for_model?(model.class, repo)
  repo.index(document)
end
```

## Global coordination

Any module that `include Esse::Hooks[...]` is tracked by `Esse::Hooks`:

```ruby
Esse::Hooks.hooks
# => { esse_active_record_hooks: Esse::ActiveRecord::Hooks,
#      esse_sequel_hooks:        Esse::Sequel::Hooks }

Esse::Hooks.disable!          # disables all of them
Esse::Hooks.without_indexing  # scoped version
```

## Reference coercion

```ruby
Esse::ActiveRecord::Hooks.resolve_index_repository('users_index:user')
# => UsersIndex.repo(:user)
```

Supported forms:

- `'users'`
- `'users_index'`
- `'users_index:user'`
- `'UsersIndex'`
- `'UsersIndex::User'`
- `'foo/v1/users_index/user'` (namespaced)

## Thread safety

State is stored in `Thread.current[store_key]`, so each thread has an independent view. In forking servers (Puma, Sidekiq), children inherit the parent state at fork time.

Scoped blocks (`with_indexing` / `without_indexing`) save and restore the current thread's state even across exceptions.
