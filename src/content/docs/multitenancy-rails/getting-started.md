---
title: Getting Started
slug: getting-started
order: 1
project: multitenancy-rails
---
## Install

```ruby
# Gemfile
gem 'multitenancy-rails'
```

```bash
bundle install
```

## Generate your first theme

```bash
bin/rails generate multitenancy storefront
```

Optional flags:

```bash
bin/rails generate multitenancy storefront --tailwindcss --importmap
```

The generator creates `themes/storefront/` with a minimal Rails app structure:

```
themes/storefront/
├── app/
│   ├── controllers/application_controller.rb   # includes Multitenancy::Controller
│   ├── controllers/home_controller.rb
│   ├── views/layouts/application.html.erb
│   └── views/home/index.html.erb
├── config/
│   ├── routes.rb
│   └── locales/en.yml
```

See [generator.md](generator.md) for the full list of flags and what they add.

## Mount your themes

The gem does not mount themes for you — you decide how they reach the request path.

### Path-based

`config/routes.rb`:

```ruby
Rails.application.routes.draw do
  draw(:multitenancy)
  root 'home#index'
end
```

`config/routes/multitenancy.rb`:

```ruby
Multitenancy.themes.each do |theme|
  mount theme.engine, at: "/#{theme.name}"
end
```

`http://localhost:3000/storefront` → `Themes::Storefront::HomeController#index`.

### Subdomain-based

```ruby
# config/routes/multitenancy.rb
Multitenancy.themes.each do |theme|
  constraints subdomain: theme.name do
    mount theme.engine, at: '/'
  end
end
```

`http://storefront.lvh.me:3000/` → `Themes::Storefront::HomeController#index`.

## Verify

```bash
bin/rails runner 'pp Multitenancy.themes.map(&:name)'
# => ["storefront"]

bin/rails server
```

Visit the mount point — you should see the scaffolded `home/index` view.

## What you get per theme

Each theme is a fully isolated `Rails::Engine`:

- Namespaced under `Themes::<Name>` — classes don't collide with main app
- Its own view path (prepended to the lookup chain)
- Its own route namespace
- Its own `app/assets/` and `app/javascript/` (if importmap enabled)
- Its own locales (`config/locales/en.yml`)
- Its own RSpec / Minitest / FactoryBot directories (auto-discovered)

What you **don't** get automatically:

- Database isolation. Every theme talks to the same database. Scope via `tenant_id` columns or schemas yourself if you need that.
- Request-scoped tenant context. The theme is determined by the mount point, not by runtime lookup. If you need `Current.tenant`, add it as a `before_action`.

## Next steps

- [Themes](themes.md) — anatomy of a theme, namespace rules, view resolution quirks
- [Integrations](integrations.md) — ES modules, Stimulus, Tailwind v4, spec discovery
- [API reference](api.md)
