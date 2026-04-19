---
title: CLI
slug: cli
order: 20
project: site_maps
---
The gem installs a `site_maps` executable backed by Thor.

```bash
bundle exec site_maps generate [PROCESS_NAMES...] [options]
```

If no process names are given, every process in the config file is enqueued.

## Options

| Flag | Default | Purpose |
|------|---------|---------|
| `--config-file`, `-r` | — | Path to the config file defining processes. **Required.** |
| `--max-threads`, `-c` | `4` | Thread pool size for concurrent process execution. |
| `--context` | `{}` | Hash-style kwargs passed to `SiteMaps.define` blocks: `--context=tenant:acme locale:en`. |
| `--enqueue-remaining` | `false` | In addition to specified processes, enqueue any others. |
| `--ping` | `false` | Override config to ping search engines after generation. |
| `--debug` | `false` | Set logger to DEBUG level. |
| `--logfile` | — | Write logs to a file instead of stdout. |

## Examples

Generate everything:

```bash
bundle exec site_maps generate --config-file config/sitemap.rb
```

Regenerate a single shard of a dynamic process:

```bash
bundle exec site_maps generate monthly_posts \
  --config-file config/sitemap.rb \
  --context=year:2024 month:3
```

Generate `posts` and `products`, then let the config decide what else to include:

```bash
bundle exec site_maps generate posts products \
  --config-file config/sitemap.rb \
  --enqueue-remaining
```

Tune concurrency:

```bash
bundle exec site_maps generate --config-file config/sitemap.rb --max-threads 10
```

Ping Bing and any custom engines (config-driven — see below):

```bash
bundle exec site_maps generate --config-file config/sitemap.rb --ping
```

## Search-engine pinging

Pinging is off by default. Enable globally in config or flip it on per run via `--ping`.

```ruby
SiteMaps.use(:file_system) do
  configure do |config|
    config.url                 = 'https://example.com/sitemap.xml'
    config.ping_search_engines = true
    config.ping_engines = {
      bing:   'https://www.bing.com/ping?sitemap=%{url}',
      custom: 'https://search.example.com/ping?url=%{url}'
    }
  end
end
```

`%{url}` in the template is replaced with a URL-encoded `config.url` at ping time.

## Rails / bundler

The CLI auto-requires `config/environment` if it detects a `config/application.rb`, so Rails URL helpers (via the Railtie) are available inside your config file.

If you don't want that — say, a Ruby-only script in a Rails repo — pass a config file outside the Rails root or invoke the library directly via `SiteMaps.generate(...)`.

## Logging

- `--debug` sets the logger to `Logger::DEBUG`.
- `--logfile PATH` writes to a file; otherwise stdout.
- A built-in event listener prints one line per finalized URL set with link counts and runtime.

## Exit codes

- `0` — success.
- Non-zero — any process raised. Errors are captured per-future and re-raised after all futures complete, so you see the real backtrace rather than a generic runner failure.
