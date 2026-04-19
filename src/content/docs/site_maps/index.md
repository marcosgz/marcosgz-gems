---
title: site_maps
slug: index
order: -1
project: site_maps
---
Concurrent, adapter-based sitemap.xml generation for Ruby applications.

`site_maps` is a framework-agnostic sitemap builder with built-in Rails support. It produces valid sitemap XML (with full SEO extensions — image, video, news, hreflang, mobile, PageMap), splits large sitemaps into indexed chunks automatically, generates them concurrently across a thread pool, and ships them to the filesystem, S3, or a custom backend through a pluggable adapter layer.

## Contents

- [Getting started](/site_maps/getting-started/) — install, first sitemap, Rails
- [Processes](/site_maps/processes/) — static and dynamic process DSL
- [Adapters](/site_maps/adapters/) — filesystem, S3, no-op, custom
- [CLI](/site_maps/cli/) — `site_maps generate`
- [Rack middleware](/site_maps/middleware/) — serve generated sitemaps from the app
- [SEO extensions](/site_maps/extensions/) — image, video, news, hreflang, mobile, PageMap
- [Events](/site_maps/events/) — instrumentation hooks
- [Rails integration](/site_maps/rails/) — URL helpers, Railtie, precompile
- [API reference](/site_maps/api/) — full public API

## Install

```ruby
# Gemfile
gem 'site_maps'
```

## One-minute tour

```ruby
# config/sitemap.rb
SiteMaps.use(:file_system) do
  configure do |config|
    config.url       = 'https://example.com/sitemap.xml'
    config.directory = Rails.public_path.to_s
  end

  process do |s|
    s.add('/', priority: 1.0, changefreq: 'daily')
    s.add('/about', lastmod: Time.now)

    Post.find_each do |post|
      s.add("/posts/#{post.slug}", lastmod: post.updated_at)
    end
  end
end
```

```bash
bundle exec site_maps generate --config-file config/sitemap.rb
```

Generated: `public/sitemap.xml` (plus an indexed chain if the URL set exceeds 50k links).

## Why site_maps

- **Concurrency.** Processes run in a `Concurrent::FixedThreadPool`; threads share a thread-safe repo that handles file splitting.
- **Pluggable storage.** Write the same sitemap to disk in development and S3 in production by swapping one line.
- **Incremental sitemaps.** Full URL extensions support — images, videos, news, hreflang alternates, mobile, PageMap.
- **Dynamic processes.** Parameterized templates like `posts/%{year}-%{month}/sitemap.xml` let you rebuild a single shard without regenerating the whole site.

## Version

- Ruby: `>= 3.2.0`
- Depends on: `builder ~> 3.0`, `concurrent-ruby >= 1.1`, `rack >= 2.0`, `zeitwerk`, `thor`

## License

MIT.
