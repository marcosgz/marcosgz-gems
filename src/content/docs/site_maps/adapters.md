---
title: Adapters
slug: adapters
order: 11
project: site_maps
---
An **adapter** is the storage backend for generated sitemap files. Three adapters ship with the gem; a clean interface makes it easy to write your own.

## Built-in adapters

| Adapter | When to use |
|---------|-------------|
| `:file_system` | Write to disk. Ideal for local dev, or for serving via the bundled Rack middleware. |
| `:aws_sdk` | Upload to S3. Production deployments behind CloudFront or similar. |
| `:noop` | Discard writes. Ideal for tests that care about "what URLs got added" but not "what ended up on disk". |

Select with `SiteMaps.use(<symbol>)`.

## `:file_system`

```ruby
SiteMaps.use(:file_system) do
  configure do |config|
    config.url       = 'https://example.com/sitemap.xml'
    config.directory = Rails.public_path.to_s     # default: "public/sitemaps"
  end
  process { |s| ... }
end
```

**Config attributes:**

| Key | Purpose |
|-----|---------|
| `url` | Public URL — drives filename layout and is written into sitemap `<loc>` entries. |
| `directory` | Filesystem root under which files land. |

If `config.url` ends in `.gz`, the adapter writes gzipped files. The middleware transparently decompresses on serve.

## `:aws_sdk`

```ruby
SiteMaps.use(:aws_sdk) do
  configure do |config|
    config.url           = 'https://my-bucket.s3.amazonaws.com/sitemap.xml'
    config.directory     = '/tmp/sitemaps'          # local scratch space
    config.bucket        = 'my-bucket'
    config.region        = ENV.fetch('AWS_REGION', 'us-east-1')
    config.access_key_id = ENV['AWS_ACCESS_KEY_ID']
    config.secret_access_key = ENV['AWS_SECRET_ACCESS_KEY']
    config.acl           = 'public-read'            # default
    config.cache_control = 'private, max-age=0, no-cache'
  end
  process { |s| ... }
end
```

**Config attributes:**

| Key | Default |
|-----|---------|
| `bucket` | `ENV['AWS_BUCKET']` |
| `region` | `ENV.fetch('AWS_REGION', 'us-east-1')` |
| `access_key_id` | `ENV['AWS_ACCESS_KEY_ID']` |
| `secret_access_key` | `ENV['AWS_SECRET_ACCESS_KEY']` |
| `acl` | `"public-read"` |
| `cache_control` | `"private, max-age=0, no-cache"` |
| `directory` | Local scratch dir for staging before upload |

The adapter writes locally first (to `directory`), then uploads to S3 with the configured ACL and Cache-Control headers. You'll need `aws-sdk-s3` in your Gemfile:

```ruby
gem 'aws-sdk-s3'
```

## `:noop`

```ruby
SiteMaps.use(:noop) do
  configure { |c| c.url = 'https://example.com/sitemap.xml' }
  process { |s| ... }
end
```

Writes are discarded. Use it in tests when you want to assert on the URLs being added (via events, for example) without hitting disk.

## Writing a custom adapter

Subclass `SiteMaps::Adapters::Adapter` and implement `write`, `read`, `delete`:

```ruby
class GoogleCloudStorageAdapter < SiteMaps::Adapters::Adapter
  class Config < SiteMaps::Configuration
    attribute :bucket
    attribute :project_id
  end

  def write(url, raw_data, **_kwargs)
    storage = Google::Cloud::Storage.new(project_id: config.project_id)
    bucket  = storage.bucket(config.bucket)
    bucket.create_file(StringIO.new(raw_data), path_from(url))
  end

  def read(url)
    file = storage.bucket(config.bucket).file(path_from(url))
    [file.download.string, { content_type: 'application/xml' }]
  end

  def delete(url)
    storage.bucket(config.bucket).file(path_from(url))&.delete
  end

  private

  def path_from(url)
    URI(url).path[1..]
  end

  def storage
    @storage ||= Google::Cloud::Storage.new(project_id: config.project_id)
  end
end
```

Register and use it:

```ruby
SiteMaps.use(GoogleCloudStorageAdapter) do
  configure do |config|
    config.url        = 'https://cdn.example.com/sitemap.xml'
    config.bucket     = 'my-bucket'
    config.project_id = 'my-project'
  end
  process { |s| ... }
end
```

## Adapter interface

| Method | Purpose |
|--------|---------|
| `#write(url, raw_data, **kwargs)` | Persist `raw_data` at the location implied by `url`. |
| `#read(url)` | Return `[raw_data, { content_type: '…' }]` for the given URL. |
| `#delete(url)` | Remove the file at the URL. |
| `.config_class` | (optional) Return a `Configuration` subclass to expose adapter-specific settings. |

The adapter base class handles everything else: URL filters, the process registry, and thread-safe URL tracking.
