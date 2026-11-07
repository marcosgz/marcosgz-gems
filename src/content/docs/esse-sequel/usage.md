---
title: Usage Guide
slug: usage
order: 3
project: esse-sequel
---
## Installation

```ruby
# Gemfile
gem 'esse'
gem 'esse-sequel'
gem 'sequel'
```

Enable the plugin on any index:

```ruby
class UsersIndex < Esse::Index
  plugin :sequel
end
```

## The `collection` DSL

Pass a Sequel model (or dataset) to `collection`:

```ruby
class UsersIndex < Esse::Index
  plugin :sequel

  repository :user do
    collection ::User
    document { |u, **| { _id: u.id, name: u.name } }
  end
end
```

Options:

| Option | Default | Description |
|--------|---------|-------------|
| `batch_size` | `1000` | Records per batch |
| `connect_with` | — | `{ server: :read_only }` (a server from the Sequel `:servers` option) |

```ruby
repository :user do
  collection ::User, batch_size: 500, connect_with: { server: :read_only }
  document { |u, **| { _id: u.id, name: u.name } }
end
```

The same can be declared inside the collection block with `connected_to server: :read_only`. The collection dataset runs on that server, and when the `server_block` extension is loaded (`DB.extension :server_block`) the whole iteration, `batch_context` queries included, runs inside `DB.with_server`.

## Scopes

```ruby
repository :user do
  collection ::User do
    scope :active, -> { where(active: true) }
    scope :role,   ->(role) { where(role: role) }
    scope :created_after, ->(date) { where(Sequel.lit('created_at > ?', date)) }
  end

  document { |u, **| { _id: u.id, name: u.name, role: u.role } }
end

UsersIndex.import(context: { active: true, role: 'admin' })
```

## Batch context

```ruby
repository :order do
  collection ::Order do
    batch_context :customers do |orders, **|
      Customer.where(id: orders.map(&:customer_id)).all.index_by(&:id)
    end
  end

  document do |order, customers: {}, **|
    { _id: order.id, customer_name: customers[order.customer_id]&.name }
  end
end
```

## Eager loading

```ruby
repository :order do
  collection ::Order.eager(:customer, :line_items)
  document do |order, **|
    { _id: order.id, customer: order.customer.name }
  end
end
```

## Automatic callbacks

```ruby
class User < Sequel::Model
  include Esse::Sequel::Model
  index_callback 'users_index:user'
end
```

Options:

```ruby
index_callback 'users_index:user',
  on:     %i[create update],
  with:   :update,
  if:     :active?,
  unless: :deleted?
```

### Reference format

Same as esse-active_record:

- `'users'`
- `'users_index'`
- `'users_index:user'`
- `'UsersIndex'`
- `'UsersIndex::User'`
- `'foo/v1/users_index:user'` (namespaced)

### Routing changes

When the document has a routing key, the update callback deletes the document from its previous routing when the routing value changes. The previous values come from the Sequel `dirty` plugin, so load it in those models:

```ruby
class City < Sequel::Model
  plugin :dirty
  include Esse::Sequel::Model

  index_callback 'geos_index:city'
end
```

Without the plugin the document is still indexed, but the stale copy under the old routing is not removed.

### Index an associated record

```ruby
class City < Sequel::Model
  many_to_one :state
  include Esse::Sequel::Model

  index_callback('geos_index:state') { state }
end
```

### Update a lazy attribute

```ruby
class Comment < Sequel::Model
  many_to_one :post
  include Esse::Sequel::Model

  update_lazy_attribute_callback('posts_index:post', 'comments_count') { post_id }
end
```

## Disabling callbacks

### Per-block

```ruby
Esse::Sequel::Hooks.without_indexing do
  10_000.times { User.create(...) }
end
```

### Per-repository

```ruby
Esse::Sequel::Hooks.without_indexing(UsersIndex, AccountsIndex) do
  migrate_users!
end
```

### Per-model

```ruby
User.without_indexing { User.create(...) }
User.without_indexing(UsersIndex) { User.create(...) }
```

### Globally

```ruby
Esse::Sequel::Hooks.disable!
# ... bulk work ...
Esse::Sequel::Hooks.enable!
```

## Streaming by primary key range

```ruby
UsersIndex.import(context: { start: 1,     finish: 5000,  batch_size: 500 })
UsersIndex.import(context: { start: 5001,  finish: 10000, batch_size: 500 })
```

## Differences from esse-active_record

Behaviorally the plugins are identical. The differences:

- Uses Sequel datasets (`where`, `eager`, `select`) in lieu of ActiveRecord scopes.
- Collections accept a model class or a model dataset (`User.where(...)`), not `User.all` (which returns an Array in Sequel).
- Callbacks run in the `after_create`/`after_update`/`after_destroy` model hooks and are deferred with `DB.after_commit`. Models overriding these hooks must call `super`.
- `connect_with`/`connected_to` take a Sequel `server:` instead of ActiveRecord `role:`/`shard:`.
- Routing changes on update require the `dirty` plugin (ActiveRecord tracks previous changes natively).
- Async callbacks from esse-async_indexing are not available for Sequel models yet.
- Hook store key differs (`:esse_sequel_hooks` vs `:esse_active_record_hooks`), so you can use both side-by-side in a single process.
