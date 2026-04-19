---
title: esse-sequel
slug: index
order: -1
project: esse-sequel
---
Sequel ORM integration for [Esse](/esse/). The API mirrors [esse-active_record](/esse-active_record/) — if you know one, you know the other.

## Contents

- [Usage guide](/esse-sequel/usage/)
- [API reference](/esse-sequel/api/)

## What you get

- `collection Model` DSL for repositories.
- `scope`, `batch_context`, `connected_to` inside collections.
- `index_callback` and `update_lazy_attribute_callback` on Sequel models.
- `Esse::Sequel::Hooks` for enabling/disabling indexing globally or per-repo.

## Quick start

```ruby
# Gemfile
gem 'esse', '>= 0.3.0'
gem 'esse-sequel'
gem 'sequel', '>= 5.0'
```

```ruby
class UsersIndex < Esse::Index
  plugin :sequel

  repository :user do
    collection ::User do
      scope :active, -> { where(active: true) }
    end

    document { |u, **| { _id: u.id, name: u.name } }
  end
end

class User < Sequel::Model
  include Esse::Sequel::Model
  index_callback 'users_index:user'
end
```

Every `User.create`, `update`, and `destroy` now syncs to Elasticsearch.

## Version

- Version: **0.0.1.beta1**
- Ruby: `>= 2.4.0`
- Depends on: `esse >= 0.3.0`, `esse-hooks`, `sequel >= 5.0`

## License

MIT.
