---
title: Integrations
slug: integrations
order: 22
project: multitenancy-rails
---
Every integration in this gem is optional and guard-checked: if the underlying gem isn't in your Gemfile, the integration is silently skipped.

## Importmap (`importmap-rails`)

### Per-theme importmaps

Each theme gets its own `Importmap::Map` stored on `theme.engine.importmap`. Theme pins don't leak into the main app, and vice versa.

The integration also removes theme paths from the main app's importmap config so they don't appear in the root importmap twice:

```
app.config.importmap.paths.delete_if { |p| p.to_s.start_with?(themes_root) }
```

### Development hot-reload

A `before_action` in `Multitenancy::Controller` calls `engine.importmap_reloader&.execute_if_updated` on each request. When you edit a file under `themes/<name>/app/javascript/`, the theme's importmap is re-drawn — no server restart needed.

### Drawing the importmap in a layout

```erb
<%# themes/storefront/app/views/layouts/application.html.erb %>
<%= javascript_importmap_tags "storefront/application" %>
```

### Pinning packages

Pin inside the theme's `config/importmap.rb` (same DSL as the main app):

```ruby
# themes/storefront/config/importmap.rb
pin 'application', preload: true
pin '@hotwired/stimulus', to: '@hotwired--stimulus.js'
pin_all_from 'app/javascript/storefront/controllers', under: 'storefront/controllers'
```

## Tailwind CSS (`tailwindcss-rails`, v4 only)

### Compilation

Each theme has its own input file (`app/assets/tailwind/<name>/application.css`) compiled to its own output (`app/assets/builds/<name>/application.css`). Tailwind input directories are excluded from Propshaft so unprocessed CSS doesn't leak into the asset pipeline.

### Asset precompile hook

```ruby
Rake::Task['assets:precompile'].enhance(['multitenancy:tailwindcss:build'])
```

This is wired automatically by the integration — no setup needed.

### Watch mode (dev)

```bash
bin/rails multitenancy:tailwindcss:watch
```

Forks a watcher process per theme, traps `Ctrl-C` to clean up children.

See [rake-tasks.md](/multitenancy-rails/rake-tasks/) for task details.

## RSpec (`rspec-rails`)

### Auto-discovery

Running `rspec` with no args discovers every theme's `spec/` directory:

```bash
bundle exec rspec
```

### Explicit paths

Passing an explicit directory expands it to include the matching theme's `spec/`:

```bash
bundle exec rspec themes/storefront
# Expands to: themes/storefront/spec
```

### Nested themes

If `storefront` and `storefront-admin` exist, `rspec themes/storefront` runs both. Disambiguate by going one level deeper:

```bash
bundle exec rspec themes/storefront-admin
```

## Minitest (`railties` test runner)

Mirrors the RSpec integration. Theme `test/` directories are auto-discovered:

```bash
bin/rails test
```

Explicit paths expand the same way:

```bash
bin/rails test themes/storefront     # runs themes/storefront/test
```

## FactoryBot (`factory_bot_rails`)

Theme factories under `themes/<name>/spec/factories/` are added to FactoryBot's definition paths automatically. Build, create, and define as usual:

```ruby
# themes/storefront/spec/factories/products.rb
FactoryBot.define do
  factory :storefront_product, class: 'Themes::Storefront::Product' do
    name { 'Widget' }
  end
end
```

## Writing a custom integration

Follow the pattern used by every built-in integration: a class under `Multitenancy::Integrations::<Name>` with a `.call(app)` method, guarded against optional-gem absence:

```ruby
# lib/multitenancy/integrations/my_integration.rb
module Multitenancy::Integrations
  class MyIntegration
    def self.call(app)
      return unless defined?(::SomeGem)

      Multitenancy.themes.each do |theme|
        # wire up per-theme stuff here
      end
    end
  end
end
```

Hook it into the Railtie in your application:

```ruby
# config/initializers/multitenancy_custom.rb
ActiveSupport.on_load(:multitenancy) do
  Multitenancy::Integrations::MyIntegration.call(Rails.application)
end
```

The `:multitenancy` load hook fires after every built-in integration has run, so you can safely inspect `Multitenancy.themes` at that point.
