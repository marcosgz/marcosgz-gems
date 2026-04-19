---
title: API Reference
slug: api
order: 29
project: multitenancy-rails
---
## `Multitenancy` (module)

| Method | Description |
|--------|-------------|
| `Multitenancy.root` | Rails application root. |
| `Multitenancy.themes_root` | Path to `themes/` directory. |
| `Multitenancy.themes` | Array of `Theme` instances, one per `themes/<name>/` directory. Memoized. |
| `Multitenancy.reset!` | Clear memoized themes. Useful in tests. |
| `Multitenancy.config` | Global `Config` instance. |

Themes are discovered lazily on first access to `.themes` — at Rails boot time they're bootstrapped from the Railtie.

## `Multitenancy::Config`

| Attribute | Default | Purpose |
|-----------|---------|---------|
| `paths` | 20+ standard Rails paths | Autoload directories to register per theme. |

Default `paths`:

```ruby
%w[
  app/controllers app/channels app/helpers app/services app/structs
  app/models app/mailers app/presenters app/decorators app/queries
  app/resources app/serializers app/transformers app/validators
  app/workers app/jobs app/notifications app/policies lib
]
```

Customize in an initializer:

```ruby
Multitenancy.config.paths = %w[app/controllers app/models lib]
```

## `Multitenancy::Theme`

Represents one theme directory.

| Method | Description |
|--------|-------------|
| `#name` | Theme name (basename of the directory). |
| `#path` | `Pathname` to the theme's root. |
| `#namespace` | The dynamically-created `Themes::<Name>` module. |
| `#engine` | The dynamically-created `Themes::<Name>::Engine` class. |
| `#bootstrap(app)` | Creates the namespace, builds the engine, registers paths. Called by the Railtie. |

You rarely construct `Theme`s yourself — iterate `Multitenancy.themes` instead.

## `Multitenancy::Controller`

`ActiveSupport::Concern`. Include in theme application controllers.

```ruby
# themes/storefront/app/controllers/application_controller.rb
module Themes::Storefront
  class ApplicationController < ::ApplicationController
    include Multitenancy::Controller
  end
end
```

Configures:

- `prepend_view_path engine.root.join('app/views')` — theme views win.
- `layout 'application'` — use the theme's layout.
- `before_action { engine.importmap_reloader&.execute_if_updated }` — reload on JS changes in dev.

### Private: `_prefixes`

Overridden to strip the theme namespace prefix from `controller_path`, so view lookup works naturally:

```
Themes::Storefront::HomeController → home/index  (not themes/storefront/home/index)
```

## `Multitenancy::Stim`

Internal — the mixin included into each theme's engine class. It configures:

- `isolate_namespace`
- `called_from` (for `Rails::Engine#root`)
- `paths["app/views"]`
- `paths["app/assets"]`
- `paths["config/locales"]`
- `paths["app/javascript"]`

You should not need to interact with it directly.

## `Multitenancy::Integrations`

Namespace for optional-gem integrations. Each is a class with a `.call(app)` class method.

| Integration | Guarded by | What it does |
|-------------|------------|--------------|
| `Rails` | always | Bootstraps every theme (creates namespace, engine, path registration). |
| `FactoryBot` | `defined?(::FactoryBot)` | Adds each theme's `spec/factories/` to FactoryBot's paths. |
| `RSpec` | `defined?(::RSpec)` | Expands `rspec themes/<name>` to `themes/<name>/spec`; auto-discovers all theme specs by default. |
| `Minitest` | `defined?(::Rails::TestUnit::Runner)` | Same discovery behavior for Minitest. |
| `Importmap` | `defined?(::Importmap::Map)` | Creates per-theme importmaps; removes theme paths from main app's importmap; wires dev reloader. |
| `TailwindCss` | `defined?(::Tailwindcss::Commands)` | Discovers theme Tailwind inputs, sets builds dirs, excludes raw inputs from Propshaft. |

## Load hook

An `ActiveSupport.on_load(:multitenancy)` hook fires after bootstrap completes:

```ruby
# config/initializers/multitenancy_custom.rb
ActiveSupport.on_load(:multitenancy) do |multitenancy|
  # multitenancy is the Multitenancy module
  # Multitenancy.themes is fully populated at this point
end
```

## Generator

```bash
bin/rails generate multitenancy THEME_NAME [--importmap] [--tailwindcss]
```

See [generator.md](generator.md).

## Rake tasks

- `multitenancy:tailwindcss:build`
- `multitenancy:tailwindcss:watch`

See [rake-tasks.md](rake-tasks.md).
