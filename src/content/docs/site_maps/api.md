---
title: API Reference
slug: api
order: 29
project: site_maps
---
## `SiteMaps` (top-level module)

| Method | Description |
|--------|-------------|
| `SiteMaps.use(adapter, **opts, &block)` | Register an adapter (`:file_system`, `:aws_sdk`, `:noop`, or a class) and yield its configuration block. |
| `SiteMaps.define(&block)` | Register a context-aware definition. Called by `.generate` with the `context:` hash splatted as kwargs. |
| `SiteMaps.configure { |config| ... }` | Mutate global defaults. |
| `SiteMaps.config` | Return global `Configuration`. |
| `SiteMaps.generate(config_file:, context: {}, **runner_opts) → Runner` | Load `config_file` and return a `Runner` ready to `.enqueue` and `.run`. |
| `SiteMaps.current_adapter` | Last-registered adapter (thread-local during `.generate`). |
| `SiteMaps.logger` | Configurable logger (default `Logger.new($stdout)`). |

### Constants

```ruby
SiteMaps::MAX_LENGTH   # { links: 50_000, images: 1_000, news: 1_000 }
SiteMaps::MAX_FILESIZE # 50_000_000 bytes
```

### Errors

- `SiteMaps::Error` — base error
- `SiteMaps::AdapterNotFound` — unknown adapter symbol
- `SiteMaps::AdapterNotSetError` — generate called without an adapter
- `SiteMaps::FileNotFoundError` — missing file at adapter read
- `SiteMaps::FullSitemapError` — internal signal that a URL set is full (triggers split)
- `SiteMaps::ConfigurationError` — invalid config

---

## `SiteMaps::Configuration`

Base configuration. Adapter configs subclass this.

| Attribute | Default | Purpose |
|-----------|---------|---------|
| `url` | — (required) | Public URL of the main sitemap index. |
| `directory` | `"/tmp/sitemaps"` | Local storage directory. |
| `max_links` | `50_000` | URLs per file before split. |
| `emit_priority` | `true` | Emit `<priority>`. |
| `emit_changefreq` | `true` | Emit `<changefreq>`. |
| `xsl_stylesheet_url` | `nil` | Stylesheet for URL sets. |
| `xsl_index_stylesheet_url` | `nil` | Stylesheet for the sitemap index. |
| `ping_search_engines` | `false` | Auto-ping after generation. |
| `ping_engines` | `{ bing: '...' }` | URL templates per engine; `%{url}` is URL-encoded at ping time. |

---

## `SiteMaps::Adapters::Adapter` (base class)

Abstract base. Subclass to build custom adapters.

| Method | Description |
|--------|-------------|
| `.config_class` | Override to return a `Configuration` subclass with adapter-specific attributes. |
| `#write(url, raw_data, **kwargs)` | Abstract. Persist `raw_data` at the storage location implied by `url`. |
| `#read(url) → [raw_data, { content_type: '…' }]` | Abstract. |
| `#delete(url)` | Abstract. |
| `#configure { |c| ... }` | Yield the adapter's configuration. |
| `#process(name = :default, location = nil, **kwargs, &block)` | Register a process. |
| `#external_sitemap(url, lastmod:)` | Add an external sitemap to the index. |
| `#extend_processes_with(mod)` | Mix `mod` into all process blocks. |
| `#url_filter { |url, options| ... }` | Register a URL filter. |
| `#apply_url_filters(url, options)` | Run all filters; returns modified options or `nil` if excluded. |
| `#reset!` | Clear index and repo. Called before `Runner#run`. |

---

## `SiteMaps::Runner`

Executes enqueued processes concurrently.

```ruby
Runner.new(adapter = SiteMaps.current_adapter, max_threads: 4, ping: nil)
```

| Method | Description |
|--------|-------------|
| `#enqueue(process_name, **kwargs)` | Queue one process with kwargs. |
| `#enqueue_remaining` / `#enqueue_all` | Queue every process not yet enqueued. |
| `#run` | Execute queued processes, finalize index, optionally ping. |

---

## `SiteMaps::SitemapBuilder`

Yielded as `s` inside every `process` block.

| Method | Description |
|--------|-------------|
| `#add(path, **options)` | Add one URL to the current URL set. Automatically splits when full. |
| `#finalize!` | Finalize the current URL set. Called automatically when the process block returns. |

`options` supports every extension documented in [extensions.md](/site_maps/extensions/): `lastmod`, `priority`, `changefreq`, `images`, `videos`, `news`, `alternates`, `mobile`, `pagemap`.

In Rails apps, `s.route` is an object exposing all URL helpers.

---

## `SiteMaps::Middleware`

Rack middleware for serving generated sitemaps. See [middleware.md](/site_maps/middleware/).

```ruby
use SiteMaps::Middleware,
  adapter: ...,
  public_prefix: nil,
  storage_prefix: nil,
  x_robots_tag: 'noindex, follow',
  cache_control: 'public, max-age=3600'
```

---

## `SiteMaps::Notification`

| Method | Description |
|--------|-------------|
| `.subscribe(event_or_class, &block)` | Subscribe to one event (string) or every event named on a class. |
| `.unsubscribe(subscriber)` | Remove a subscription. |
| `.instrument(event, payload) { ... }` | Emit an event, wrapping the block in a timer. |

See [events.md](/site_maps/events/) for the event catalog.

---

## `SiteMaps::RobotsTxt`

| Method | Description |
|--------|-------------|
| `.sitemap_directive(url) → String` | Return `"Sitemap: <url>"`. |
| `.render(sitemap_url:, extra_directives: []) → String` | Build a full robots.txt body. |

---

## `SiteMaps::Ping`

| Method | Description |
|--------|-------------|
| `.ping(url, engines: { bing: '...' }) → Hash` | Fire a GET to each engine's template (substituting `%{url}`). Returns a hash of `{engine => { status:, url: }}`. |

---

## CLI entry point

`exec/site_maps` — the executable shipped with the gem.

```bash
bundle exec site_maps generate [processes] [options]
```

See [cli.md](/site_maps/cli/).
