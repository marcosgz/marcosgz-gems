---
title: Rack Middleware
slug: middleware
order: 14
project: site-maps
---
`SiteMaps::Middleware` serves generated sitemap files directly from the app. Useful when you've generated to `public/sitemaps/` (filesystem adapter) and want proper `Content-Type`, gzip handling, and XSL stylesheet routing without editing your web-server config.

## Basic usage

```ruby
# config/application.rb (Rails)
config.middleware.use SiteMaps::Middleware, adapter: -> { SiteMaps.current_adapter }
```

Or inline in `config.ru`:

```ruby
require 'site_maps'

use SiteMaps::Middleware, adapter: SiteMaps.current_adapter
run MyApp
```

## Options

```ruby
use SiteMaps::Middleware,
  adapter:        SiteMaps.current_adapter,
  public_prefix:  nil,
  storage_prefix: nil,
  x_robots_tag:   'noindex, follow',
  cache_control:  'public, max-age=3600'
```

| Option | Purpose |
|--------|---------|
| `adapter` | Adapter instance (or a callable returning one — useful if the adapter is reconfigured at boot). |
| `public_prefix` | Strip from request path before lookup — e.g. `/sitemap` if your app mounts them under a sub-path. |
| `storage_prefix` | Prepend to the lookup key — e.g. `tenants/acme` for multi-tenant layouts. |
| `x_robots_tag` | `X-Robots-Tag` header added to served files. |
| `cache_control` | `Cache-Control` header. |

## Behavior

The middleware intercepts requests for `*.xml` and `*.xml.gz` files:

- Matches → serve from the adapter with `Content-Type: application/xml`, plus `X-Robots-Tag` and `Cache-Control`.
- Gzipped sources → auto-decompress on serve so XSL stylesheets render in the browser. Clients asking for `.xml.gz` still get the compressed bytes.
- Doesn't match → `env` passes through to `@app.call`.

## XSL stylesheets

The middleware also serves the built-in XSL stylesheets — pretty sitemap rendering for human visitors — at their referenced paths. Configure their URLs via:

```ruby
configure do |config|
  config.xsl_stylesheet_url       = '/_sitemap-stylesheet.xsl'
  config.xsl_index_stylesheet_url = '/_sitemap-index-stylesheet.xsl'
end
```

## Multi-tenant routing

For per-tenant sitemaps stored under subpaths:

```ruby
use SiteMaps::Middleware,
  adapter:        per_request_adapter,
  storage_prefix: ->(request) { "tenants/#{request.host.split('.').first}" }
```

If the adapter itself already scopes paths by tenant, no prefix is needed — just point it at the right one for each request.

## robots.txt integration

Emit a `Sitemap:` directive for the generated file:

```ruby
# config.ru or a controller
SiteMaps::RobotsTxt.sitemap_directive('https://example.com/sitemap.xml')
# => "Sitemap: https://example.com/sitemap.xml"

SiteMaps::RobotsTxt.render(
  sitemap_url:      'https://example.com/sitemap.xml',
  extra_directives: ['Disallow: /admin']
)
# => "Sitemap: https://example.com/sitemap.xml\nDisallow: /admin"
```
