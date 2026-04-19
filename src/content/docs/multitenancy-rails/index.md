---
title: multitenancy-rails
slug: index
order: -1
project: multitenancy-rails
---
Engine-based multitenancy for Rails — each tenant is a self-contained Rails engine auto-discovered from `themes/<name>/`.

Every theme gets its own controllers, views, routes, assets, JavaScript, locales, factories, and specs. Isolation is enforced by Ruby namespacing and Rails' `isolate_namespace`. The gem hooks into Rails at boot, scans `themes/`, builds a `Rails::Engine` per directory, and wires asset/JS/importmap/Tailwind paths through the Railtie.

This gem does **not** handle database-level isolation (schemas, per-tenant databases, or tenant-id scoping). All themes share the main app's database. If you need row-level multitenancy, add it at the ActiveRecord layer; if you need schema-level, pair this gem with one that does that.

## Contents

- [Getting started](getting-started.md) — install, generate a theme, mount it
- [Themes](themes.md) — structure, namespaces, view resolution
- [Generator](generator.md) — `bin/rails g multitenancy <name>` options
- [Integrations](integrations.md) — importmap, Tailwind, RSpec, Minitest, FactoryBot
- [Rake tasks](rake-tasks.md) — theme asset compilation
- [API reference](api.md)

## Install

```ruby
# Gemfile
gem 'multitenancy-rails'
```

## One-minute tour

```bash
bin/rails generate multitenancy storefront --tailwindcss --importmap
```

Generates:

```
themes/storefront/
├── app/
│   ├── controllers/{application,home}_controller.rb
│   ├── views/layouts/application.html.erb
│   ├── views/home/index.html.erb
│   ├── assets/tailwind/storefront/application.css
│   └── javascript/storefront/application.js
├── config/routes.rb
└── config/locales/en.yml
```

Mount it:

```ruby
# config/routes.rb
Rails.application.routes.draw do
  draw(:multitenancy)      # reads config/routes/multitenancy.rb
  root 'home#index'
end
```

```ruby
# config/routes/multitenancy.rb
Multitenancy.themes.each do |theme|
  mount theme.engine, at: "/#{theme.name}"
end
```

Visit `/storefront` — served by `Themes::Storefront::HomeController`.

## Version

- Ruby: `>= 3.1`
- Depends on: `railties`, `activesupport`, `zeitwerk`
- Optional: `importmap-rails`, `tailwindcss-rails ~> 4.4`, `rspec-rails`, `factory_bot_rails`

## License

MIT.
