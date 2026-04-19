---
title: Themes
slug: themes
order: 8
project: multitenancy-rails
---
A theme is a directory under `themes/` that gets bootstrapped into a `Rails::Engine` at boot.

## Anatomy

```
themes/storefront/
├── app/
│   ├── controllers/       # Themes::Storefront::XxxController
│   ├── models/            # Themes::Storefront::Xxx (optional; main app models are also reachable)
│   ├── views/             # Resolved first, ahead of main app views
│   ├── helpers/
│   ├── services/
│   ├── jobs/
│   ├── policies/
│   ├── assets/
│   ├── javascript/        # If importmap is enabled
│   └── ...
├── config/
│   ├── routes.rb          # Engine-scoped routes
│   └── locales/
├── spec/                  # Auto-discovered by RSpec (if present)
└── test/                  # Auto-discovered by Minitest (if present)
```

Only directories that actually exist are registered. You don't need to create empty `app/mailers/` just for the gem to work.

The autoloaded paths by default are:

```
app/controllers app/channels app/helpers app/services app/structs
app/models app/mailers app/presenters app/decorators app/queries
app/resources app/serializers app/transformers app/validators
app/workers app/jobs app/notifications app/policies lib
```

Customize in an initializer:

```ruby
# config/initializers/multitenancy.rb
Multitenancy.config.paths = %w[app/controllers app/models app/views lib]
```

## Namespace rules

All Ruby code in a theme lives under `Themes::<Name>`:

```ruby
# themes/storefront/app/controllers/home_controller.rb
module Themes::Storefront
  class HomeController < ApplicationController
    def index
      @products = Product.all  # main-app model — no namespacing needed
    end
  end
end
```

The namespace module is created dynamically at boot. You can rely on it existing:

```ruby
Themes::Storefront                 # => Themes::Storefront
Themes::Storefront::Engine         # => Themes::Storefront::Engine
Themes::Storefront::HomeController # => Themes::Storefront::HomeController
```

## Engine isolation

Each theme's engine runs through `isolate_namespace(Themes::<Name>)`. That means:

- Routes are scoped (`home_path` in the engine is NOT `Rails.application.routes.url_helpers.home_path`).
- Helpers don't leak between themes.
- Generators inside the theme generate into its namespace.

## Controllers

Theme `ApplicationController`s typically include the gem's `Controller` concern:

```ruby
# themes/storefront/app/controllers/application_controller.rb
module Themes::Storefront
  class ApplicationController < ::ApplicationController
    include Multitenancy::Controller
  end
end
```

The generator does this for you. The concern sets:

- `prepend_view_path` — theme views win over main-app views with the same name.
- `layout "application"` — uses the theme's `layouts/application.html.erb`.
- A `before_action` that re-executes the theme's importmap reloader in development when JS files change.

### View resolution quirk

Without the concern, `Themes::Storefront::HomeController` would look up views under `themes/storefront/home/` — a path that doesn't exist, because views are at `home/`. The concern strips the theme namespace prefix from `_prefixes` so view lookup works naturally:

```
theme module = Themes::Storefront
controller   = Themes::Storefront::HomeController
lookup path  = home/  (not themes/storefront/home/)
```

That means `app/views/home/index.html.erb` inside the theme renders for the index action.

## Models

Shared across themes by default. You can add theme-specific models in `themes/<name>/app/models/`:

```ruby
# themes/storefront/app/models/product.rb
module Themes::Storefront
  class Product < ApplicationRecord
    self.table_name = 'storefront_products'
  end
end
```

Inside the theme, `Product` means `Themes::Storefront::Product`. To reach the main app's model, use `::Product`.

## Database

All themes share the main app's database connection. If you want per-tenant data, handle it at the model level — a `tenant_id` column plus a default scope, or multiple DB configs in `database.yml` with `connects_to`. The gem doesn't touch this.

## Routes

Each theme's `config/routes.rb` is a standard engine routes file:

```ruby
# themes/storefront/config/routes.rb
Themes::Storefront::Engine.routes.draw do
  root to: 'home#index'
  resources :products
end
```

The main app's `config/routes/multitenancy.rb` decides how each engine gets mounted — see [getting-started.md](getting-started.md).

## Assets & JavaScript

- CSS: each theme has its own `app/assets/` paths registered with Propshaft.
- JS (importmap): each theme has its own `Importmap::Map` with its own pins, separate from the main app. The `javascript_importmap_tags` helper in the theme's layout draws the theme's importmap.
- Tailwind: each theme has its own input file and gets its own build output under `app/assets/builds/<theme>/`.

See [integrations.md](integrations.md) for the asset and JS story in detail.

## Locales

`themes/<name>/config/locales/*.yml` is added to `I18n.load_path`. Keys aren't automatically namespaced — if two themes define the same key, the last loaded wins. Scope keys manually if you want them isolated:

```yaml
# themes/storefront/config/locales/en.yml
en:
  themes:
    storefront:
      home:
        title: Welcome to Storefront
```
