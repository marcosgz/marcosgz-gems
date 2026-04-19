---
title: esse-hooks
slug: index
order: -1
project: esse-hooks
---
A small state-management layer for enabling, disabling, and scoping indexing callbacks across [Esse](/esse/) plugins. Used internally by [esse-active_record](/esse-active_record/) and [esse-sequel](/esse-sequel/).

You usually don't call this gem directly — you interact through the plugin-specific modules (`Esse::ActiveRecord::Hooks`, `Esse::Sequel::Hooks`). But if you are building your own plugin and need a consistent hook layer, this is how.

## Contents

- [Usage guide](/esse-hooks/usage/)
- [API reference](/esse-hooks/api/)

## What it provides

- Global `enable!` / `disable!`.
- Per-repository `enable!(repo)` / `disable!(repo)`.
- Per-model granularity.
- Scoped `with_indexing` / `without_indexing` blocks that auto-restore state.
- Thread-local state (safe with multi-threaded servers).
- Coercion of string references like `'users_index:user'` to `UsersIndex.repo(:user)`.

## Quick start

Create a hook module for your plugin:

```ruby
module Esse::ActiveRecord::Hooks
  include Esse::Hooks[store_key: :esse_active_record_hooks]
end
```

Now the module has the full hook API:

```ruby
Esse::ActiveRecord::Hooks.disable!
Esse::ActiveRecord::Hooks.enable!

Esse::ActiveRecord::Hooks.without_indexing do
  100.times { User.create!(...) }
end

Esse::ActiveRecord::Hooks.without_indexing(UsersIndex.repo(:user)) do
  ...
end
```

## Version

- Version: **0.0.2**
- Ruby: `>= 2.7.0`
- Depends on: `esse >= 0.3.0`

## License

MIT.
