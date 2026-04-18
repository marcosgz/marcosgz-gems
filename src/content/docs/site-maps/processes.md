---
title: Processes
slug: processes
order: 10
project: site-maps
---
A **process** is a unit of work that produces part of a sitemap. Each process runs on its own thread, writes its own URL set, and becomes an entry in the sitemap index.

## Static processes

A static process has no parameters. It runs once and writes one (possibly split) sitemap file.

```ruby
SiteMaps.use(:file_system) do
  configure { |c| c.url = 'https://example.com/sitemap.xml'; c.directory = 'public' }

  process do |s|
    s.add('/', priority: 1.0)
    s.add('/about')
  end

  process :posts, 'posts/sitemap.xml' do |s|
    Post.find_each { |post| s.add("/posts/#{post.slug}", lastmod: post.updated_at) }
  end
end
```

- Without an explicit name, the process is named `:default`.
- Without an explicit location, a default filename is assigned.
- The block receives a `SitemapBuilder` (`s`), on which `add` is called per URL.

## Dynamic processes

A dynamic process has placeholders in its location template and corresponding kwargs. Each unique combination of kwargs produces a separate sitemap file.

```ruby
process :monthly_posts, 'posts/%{year}-%{month}/sitemap.xml', year: 2024, month: 1 do |s, year:, month:, **|
  Post.where('extract(year from published_at) = ? AND extract(month from published_at) = ?', year, month)
      .find_each { |p| s.add("/posts/#{p.slug}", lastmod: p.updated_at) }
end
```

The kwargs passed to `process` are **defaults**; the real values come from `Runner#enqueue`:

```ruby
runner = SiteMaps.generate(config_file: 'config/sitemap.rb')
runner.enqueue(:monthly_posts, year: 2024, month: 1)
runner.enqueue(:monthly_posts, year: 2024, month: 2)
runner.enqueue(:monthly_posts, year: 2024, month: 3)
runner.run
```

Or from the CLI:

```bash
bundle exec site_maps generate monthly_posts \
  --config-file config/sitemap.rb \
  --context=year:2024 month:1
```

## Execution model

When you call `runner.run`:

1. Each enqueued process is wrapped in a `Concurrent::Future`.
2. The pool (default 4 threads, configurable via `--max-threads`) runs them in parallel.
3. Each process builds a `URLSet`. When the set fills up (50,000 links, 1,000 news items, or 50 MB uncompressed), it's finalized and written, and a new URLSet starts — automatically.
4. After every process finishes, the sitemap index is aggregated and written to `config.url`.

## Splitting rules

A URL set is finalized and rolled over when **any** of these apply:

- Links reach `config.max_links` (default 50,000 — the sitemap spec limit).
- News entries reach 1,000.
- Uncompressed XML reaches 50 MB.

Split files are named by `IncrementalLocation`: `posts/sitemap.xml` becomes `posts/sitemap1.xml`, `posts/sitemap2.xml`, etc.

## Index generation

A sitemap index is produced when:

- More than one process exists,
- A single process was split across multiple files, or
- External sitemaps were added.

Otherwise a single `urlset` is written directly at `config.url` (the "inline" optimization).

## Adding external sitemaps

Reference third-party or pre-existing sitemaps in the index:

```ruby
SiteMaps.use(:file_system) do
  configure { |c| c.url = 'https://example.com/sitemap.xml'; c.directory = 'public' }

  external_sitemap('https://cdn.example.com/legacy-sitemap.xml', lastmod: Time.parse('2024-01-15'))

  process { |s| s.add('/') }
end
```

## Shared helpers across processes

Use `extend_processes_with` to add methods that every process block can call:

```ruby
module Helpers
  def post_path(post) = "/posts/#{post.slug}"
  def published_posts = Post.where.not(published_at: nil)
end

SiteMaps.use(:file_system) do
  configure { |c| c.url = 'https://example.com/sitemap.xml'; c.directory = 'public' }
  extend_processes_with(Helpers)

  process :posts do |s|
    published_posts.find_each { |p| s.add(post_path(p), lastmod: p.updated_at) }
  end
end
```

## URL filters

Filters run per URL inside every process — use them for global exclusions or default attributes:

```ruby
SiteMaps.use(:file_system) do
  configure { |c| c.url = 'https://example.com/sitemap.xml'; c.directory = 'public' }

  # Exclude any /admin path
  url_filter { |url, _options| false if url.include?('/admin') }

  # Boost blog priority
  url_filter do |url, options|
    if url.include?('/blog/')
      options.merge(priority: 0.9, changefreq: 'daily')
    else
      options
    end
  end

  process { |s| ... }
end
```

A filter returning `false` (or `nil`) excludes the URL entirely. Returning a hash replaces the options.

## Re-running a single shard

Only regenerate what changed — the rest is preserved from the existing sitemap index:

```ruby
runner = SiteMaps.generate(config_file: 'config/sitemap.rb')
runner.enqueue(:monthly_posts, year: 2024, month: 3)  # only March
runner.run                                             # Jan and Feb kept as-is
```

This is the main advantage of parameterized dynamic processes: you can rebuild one month's shard on a cron and leave the rest untouched.
