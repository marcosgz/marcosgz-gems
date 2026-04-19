---
title: Generator
slug: generator
order: 9
project: multitenancy-rails
---
```bash
bin/rails generate multitenancy THEME_NAME [options]
```

Scaffolds a new theme under `themes/<theme_name>/` with a minimal but runnable structure.

## Options

| Flag | Adds |
|------|------|
| `--importmap` | `app/javascript/<name>/application.js` and a sample Stimulus controller. |
| `--tailwindcss` | `app/assets/tailwind/<name>/application.css` with a Tailwind v4 `@import` and a default theme block. |

Flags can be combined:

```bash
bin/rails g multitenancy storefront --importmap --tailwindcss
```

## What gets created

### Always

```
themes/<name>/
├── app/controllers/application_controller.rb
├── app/controllers/home_controller.rb
├── app/views/layouts/application.html.erb
├── app/views/home/index.html.erb
├── config/routes.rb
└── config/locales/en.yml
```

- `ApplicationController` subclasses the main app's `::ApplicationController` and includes `Multitenancy::Controller`.
- `HomeController` has a single `index` action.
- `routes.rb` has `root to: 'home#index'`.

### With `--tailwindcss`

```
themes/<name>/
└── app/assets/tailwind/<name>/application.css
```

```css
@import 'tailwindcss';

@theme {
  /* design tokens here */
}
```

A `bin/rails multitenancy:tailwindcss:build` run compiles this to `themes/<name>/app/assets/builds/<name>/application.css`, and it's hooked into `assets:precompile` so production deploys compile it automatically.

### With `--importmap`

```
themes/<name>/
└── app/javascript/<name>/
    ├── application.js        # Stimulus entrypoint
    └── controllers/
        ├── application.js    # Stimulus Application instance
        ├── hello_controller.js  # Example controller
        └── index.js             # Eager-register controllers
```

The theme's layout is wired to draw the theme-scoped importmap and `javascript_importmap_tags` tag:

```erb
<%= javascript_importmap_tags "<name>/application" %>
```

In development, changes to JS files trigger the theme's importmap reloader automatically (wired by the `Multitenancy::Controller` concern).

## Prerequisites for flags

- `--tailwindcss` requires `tailwindcss-rails ~> 4.4`. The gem targets Tailwind CSS v4 (CSS-first config).
- `--importmap` requires `importmap-rails` in your Gemfile.

If a flag's gem isn't present, the generator skips that part silently — but the theme still works, you just won't get the asset/JS scaffolding.

## After generating

1. Mount the theme in `config/routes/multitenancy.rb` (see [getting-started.md](getting-started.md)).
2. If you used `--tailwindcss`, run `bin/rails multitenancy:tailwindcss:build` once to generate the compiled CSS.
3. If you used `--importmap`, pin any shared libraries in the theme's layout or in the main `config/importmap.rb`.
