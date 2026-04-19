---
title: Getting Started
slug: getting-started
order: 1
project: site_maps
---
## Install

```ruby
# Gemfile
gem 'site_maps'
```

```bash
bundle install
```

## Your first sitemap

Create `config/sitemap.rb`:

```ruby
SiteMaps.use(:file_system) do
  configure do |config|
    config.url       = 'https://example.com/sitemap.xml'
    config.directory = File.expand_path('public', __dir__)
  end

  process do |s|
    s.add('/',       priority: 1.0, changefreq: 'daily')
    s.add('/about',  priority: 0.8, lastmod: Time.now)
    s.add('/contact', priority: 0.5)
  end
end
```

Generate:

```bash
bundle exec site_maps generate --config-file config/sitemap.rb
```

Output: `public/sitemap.xml`.

## Dynamic URLs

Yield `s.add` for every URL you want indexed. Database records work naturally:

```ruby
process :posts do |s|
  Post.published.find_each do |post|
    s.add("/posts/#{post.slug}", lastmod: post.updated_at, priority: 0.7)
  end
end
```

When the URL count of a single process exceeds `max_links` (default 50,000), the file is split into `sitemap1.xml`, `sitemap2.xml`, … and a sitemap index is written at `config.url`.

## Named processes

Named processes get their own file and run in parallel:

```ruby
SiteMaps.use(:file_system) do
  configure { |c| c.url = 'https://example.com/sitemap.xml'; c.directory = 'public' }

  process :static do |s|
    s.add('/')
    s.add('/about')
  end

  process :posts, 'posts/sitemap.xml' do |s|
    Post.find_each { |p| s.add("/posts/#{p.slug}") }
  end

  process :products, 'products/sitemap.xml' do |s|
    Product.find_each { |p| s.add("/products/#{p.id}") }
  end
end
```

Run all:

```bash
bundle exec site_maps generate --config-file config/sitemap.rb --max-threads 4
```

Run one:

```bash
bundle exec site_maps generate posts --config-file config/sitemap.rb
```

See [processes.md](/site_maps/processes/) for the full process DSL including parameterized templates.

## Using it in Rails

Add `site_maps` to your Gemfile and generate from a Rake task, a scheduled job, or your deploy pipeline. The Railtie injects URL helpers:

```ruby
# config/sitemap.rb
SiteMaps.use(:file_system) do
  configure do |config|
    config.url       = 'https://example.com/sitemap.xml'
    config.directory = Rails.public_path.to_s
  end

  process do |s|
    s.add(s.route.root_path, priority: 1.0)
    s.add(s.route.about_path)
    Post.find_each { |post| s.add(s.route.post_path(post), lastmod: post.updated_at) }
  end
end
```

See [rails.md](/site_maps/rails/) for the full Rails integration, including asset precompile hooks and the Rack middleware for serving generated sitemaps.

## Uploading to S3

Swap the adapter line:

```ruby
SiteMaps.use(:aws_sdk) do
  configure do |config|
    config.url    = 'https://my-bucket.s3.amazonaws.com/sitemap.xml'
    config.bucket = 'my-bucket'
    config.region = ENV['AWS_REGION']
    # access_key_id / secret_access_key default to ENV vars
  end

  process { |s| ... }
end
```

See [adapters.md](/site_maps/adapters/) for adapter specifics and how to build your own.

## Next steps

- [Processes](/site_maps/processes/) — split your sitemap into static and dynamic shards
- [SEO extensions](/site_maps/extensions/) — image, video, news, hreflang
- [CLI](/site_maps/cli/) — automation-friendly generate command
- [Rack middleware](/site_maps/middleware/) — serve the generated files with correct headers
