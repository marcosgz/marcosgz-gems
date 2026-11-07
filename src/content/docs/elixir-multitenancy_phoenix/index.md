---
title: Overview
slug: index
order: -1
project: elixir-multitenancy_phoenix
---
Multi-site, theme-based multitenancy for Phoenix.

A request host resolves to a **site**, every site points to a **theme**, and every
theme is a self-contained slice of the app under `themes/<name>/`. Each theme has its own
router, controllers, templates, layouts, LiveViews, CSS/JS bundle, gettext backend and
default settings. Templates a theme does not override fall back to the base app.

```
request ─▶ Multitenancy.Plug.ResolveSite ─▶ Multitenancy.Plug.Dispatch ─┬─▶ Themes.Alpha.Router
            host → %Site{theme: …}            (endpoint)                ├─▶ Themes.Beta.Router
                                                                        └─▶ MyAppWeb.Router (platform hosts)
```


## Installation

```elixir
# mix.exs
defp elixirc_paths(:test), do: ["lib", "test/support" | Path.wildcard("themes/*/lib")]
defp elixirc_paths(_), do: ["lib" | Path.wildcard("themes/*/lib")]

defp deps do
  [{:multitenancy_phoenix, "~> 0.2"}, ...]
end
```

`mix.exs` cannot call dependency code, so the `themes/*/lib` wildcard is written inline.
Add `"multitenancy.assets"` to the `assets.build` alias and `"multitenancy.assets --minify"`
to `assets.deploy`, before `phx.digest`.

```elixir
# config/config.exs
config :multitenancy_phoenix,
  resolver: Multitenancy.SiteResolver.YAML, # default
  platform_hosts: ["localhost"],             # hosts served by MyAppWeb.Router
  platform_paths: ["/admin", "/health"]      # served by MyAppWeb.Router on every host

# lib/my_app/application.ex
children = [
  ...,
  {Multitenancy.SiteResolver.YAML, path: Application.app_dir(:my_app, "priv/sites.yml")},
  MyAppWeb.Endpoint
]

# lib/my_app_web/endpoint.ex, replacing `plug MyAppWeb.Router`
plug Multitenancy.Plug.ResolveSite
plug Multitenancy.Plug.Dispatch, platform: MyAppWeb.Router

# lib/my_app_web.ex
def static_paths, do: ~w(assets themes fonts images favicon.ico robots.txt)

# config/dev.exs: endpoint watcher and live_reload pattern
themes: {Mix.Tasks.Multitenancy.Assets, :run, [~w(--watch)]}
~r"themes/.*/lib/.*\.(ex|heex)$"E
```

## Sites

```yaml
# priv/sites.yml
alpha:
  theme: alpha            # defaults to the site key
  hosts: [alpha.example.com, www.alpha.example.com]
  locale: en              # optional, calls Gettext.put_locale/1
  settings:
    title: Alpha Daily    # deep merged over themes/alpha/config/settings.yml
```

Controllers and LiveViews get `@current_site` (`%Multitenancy.Site{}`) and
`@current_theme` (`%Multitenancy.Theme{}`). Unknown hosts get a 404.

To load sites from somewhere else, such as a database, implement the behaviour:

```elixir
defmodule MyApp.SiteResolver do
  @behaviour Multitenancy.SiteResolver

  @impl true
  def resolve(host) do
    case MyApp.Sites.get_by_host(host) do
      nil -> :error
      site -> {:ok, %Multitenancy.Site{slug: site.slug, theme: Multitenancy.theme!(site.theme_name), hosts: [host], data: site}}
    end
  end
end
```

`:data` carries any application value along with the site, such as the database record.
Define the optional `resolve_conn/1` callback when the lookup needs more than the host,
for example a header that picks the site in local testing. `ResolveSite` then calls it
instead of `resolve/1`.

### Platform paths

Paths listed in `:platform_paths` are routed to the platform router on every host, with the
site still assigned when the host resolves to one. Unknown hosts get a 404 everywhere else.
Use it for an admin area or health checks shared by all sites.

## Themes

```
$ mix multitenancy.gen.theme alpha
```

```
themes/alpha/
  lib/alpha.ex                # Themes.Alpha: `use Multitenancy.Theme` + use Themes.Alpha, :html/:controller/...
  lib/alpha/router.ex         # Themes.Alpha.Router (its own routes and pipelines)
  lib/alpha/layouts.ex        # Themes.Alpha.Layouts (app/1) + layouts/root.html.heex
  lib/alpha/page_controller.ex
  lib/alpha/page_html.ex      # embed_theme_templates "page_html/*", base: MyAppWeb.PageHTML
  lib/alpha/page_html/        # overrides only; empty means everything falls back
  lib/alpha/counter_live.ex   # live_session with on_mount: [Multitenancy.LiveView]
  lib/alpha/gettext.ex        # priv: themes/alpha/priv/gettext
  assets/css/app.css          # @import the base app.css + @source ../../lib + @theme tokens
  assets/js/app.js            # imports the base app.js
  config/settings.yml         # default settings
```

`Themes.Alpha` plays the role of `MyAppWeb` inside the theme. Its verified routes point to
`Themes.Alpha.Router`, its `Layouts` alias points to `Themes.Alpha.Layouts`, and it uses
its own gettext backend.

### Template fallback

```elixir
defmodule Themes.Alpha.PageHTML do
  use Themes.Alpha, :html

  embed_theme_templates "page_html/*", base: MyAppWeb.PageHTML
end
```

Templates in `themes/alpha/lib/alpha/page_html/` win. Every other template of
`MyAppWeb.PageHTML` is compiled **into the theme module**. This means a base template that
calls `<Layouts.app>`, `~p"/..."`, imported components or `gettext` renders through the
theme, inside the theme layout. Adding or removing
an override recompiles the module.

Function components defined directly in the base HTML module are not copied. Share them
through an imported components module.

### Reusing base controllers

A theme router can route to base controllers. Add `plug :put_theme_view` (from
`use Multitenancy.Controller`) so that `MyAppWeb.PageHTML` becomes `Themes.Alpha.PageHTML`
whenever the theme defines it.

## Assets

`mix multitenancy.assets` builds, for every theme:

- `themes/<t>/assets/css/app.css` with tailwind, into `priv/static/themes/<t>/app.css`
- `themes/<t>/assets/js/app.js` with esbuild, into `priv/static/themes/<t>/app.js`

It reads the tailwind and esbuild versions from your config. It also reuses the esbuild
`:env` (for example `NODE_PATH`) of your app's main esbuild profile.
Extra esbuild arguments for every theme bundle (aliases, `--splitting --format=esm`, loaders)
go in `config :multitenancy_phoenix, esbuild_args: [...]`.

## Example

[`examples/two_sites`](https://github.com/marcosgz/multitenancy_phoenix/blob/master/examples/two_sites/README.md) is a Phoenix 1.8 app serving
`alpha.localtest.me` and `beta.localtest.me` from two themes, with `localhost` as the
platform host.

```
cd examples/two_sites
mix setup
mix test
mix phx.server   # http://alpha.localtest.me:4000, http://beta.localtest.me:4000, http://localhost:4000
```
