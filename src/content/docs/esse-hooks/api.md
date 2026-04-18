---
title: API Reference
slug: api
order: 29
project: esse-hooks
---
## `Esse::Hooks`

Top-level coordinator module. Each plugin that `include`s `Esse::Hooks[...]` is registered here.

### Module methods

| Method | Description |
|--------|-------------|
| `Esse::Hooks[store_key: :my_key]` | Returns a new `Mixin` module. `include` it in your plugin's hook module. |
| `hooks` | Frozen hash `{ store_key => Module }` of all registered hooks. |
| `enable!(*repos)` | Enable hooks across all registered modules. |
| `disable!(*repos)` | Disable hooks across all registered modules. |
| `with_indexing(*repos, &block)` | Scoped enable, auto-restore. |
| `without_indexing(*repos, &block)` | Scoped disable, auto-restore. |
| `with_indexing_for_model(model, *repos, &block)` | Scoped enable for a specific model. |
| `without_indexing_for_model(model, *repos, &block)` | Scoped disable for a specific model. |
| `enabled?(*repos)` | `true` if all modules report enabled. |
| `disabled?(*repos)` | `true` if all modules report disabled. |

---

## `Esse::Hooks::Mixin`

The module returned by `Esse::Hooks[store_key: ...]`. Once included, a plugin-specific hook module gets all the methods below.

### Included module's `store_key`

Identifies the slot in `Thread.current` used to hold state. Each plugin must choose a unique key:

```ruby
module MyPlugin::Hooks
  include Esse::Hooks[store_key: :my_plugin_hooks]
end

MyPlugin::Hooks.store_key # => :my_plugin_hooks
```

### Model registration

- `register_model(model_class)` — add a model to the registry.
- `models` — array of registered model classes.
- `model_names` — array of model class names.

### Repository-level state

- `enable!(*repos)` — enable globally or for specific repos.
- `disable!(*repos)` — disable globally or for specific repos.
- `enabled?(*repos)` / `disabled?(*repos)` — check state.

When called with no args, applies to the whole plugin. When called with one or more repos, applies only to those.

### Scoped execution

- `with_indexing(*repos, &block)` — force enabled, restore after.
- `without_indexing(*repos, &block)` — force disabled, restore after.

Both auto-restore state even if the block raises.

### Model-specific state

- `enable_model!(model, *repos)` / `disable_model!(model, *repos)` — direct toggle.
- `enabled_for_model?(model, *repos)` — check.
- `with_indexing_for_model(model, *repos, &block)` / `without_indexing_for_model(model, *repos, &block)` — scoped versions.

### Reference resolution

- `resolve_index_repository(reference)` — coerce a string to an `Esse::Repository` class.

Supported reference forms:

- `'users'`
- `'users_index'`
- `'users_index:user'`
- `'UsersIndex'`
- `'UsersIndex::User'`
- `'foo/v1/users_index/user'` (namespaced)

Returns the repository class (e.g., `UsersIndex::User`) or raises if not found.

---

## `Esse::Hooks::Primitive::String`

Internal helper with two methods used by reference coercion:

- `underscore` — CamelCase → snake_case.
- `classify` — snake_case → CamelCase.

Only used internally by `resolve_index_repository`.

---

## Thread-local storage

State is kept under `Thread.current[store_key]` with this shape:

```ruby
{
  repositories: { 'users_index:user' => false },
  models: { User => { 'users_index:user' => false } }
}
```

Scoped blocks capture and restore this hash atomically.
