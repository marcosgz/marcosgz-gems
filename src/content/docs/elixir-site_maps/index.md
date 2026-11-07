---
title: Overview
slug: index
order: -1
project: elixir-site_maps
---
Sitemap generation for Elixir: streaming, parallel and incremental.

- **Simple setup:** declare your processes in one module, set the URL in `config/runtime.exs`, and run `mix site_maps.generate`.
- **Streaming:** each process returns a `Stream` of URLs, written to disk as it is consumed. Memory stays flat, however many URLs there are.
- **Protocol limits:** files rotate before they cross 50,000 URLs, 50 MB uncompressed or 1,000 news entries, and the index is capped at 50,000 entries.
- **Parallel:** processes run concurrently, and dynamic processes (one shard per year or month) can be regenerated alone. The rest of the existing index is kept, and stale shard files can be pruned.
- **Storage:** local disk or network mounts (NFS/EFS) with atomic writes, AWS S3 and S3-compatible stores, and Cloudflare R2.
- **Extras:** a Plug that serves the files and XSL stylesheets, `robots.txt`, mix tasks, an optional Oban worker and telemetry.
- **Multiple sites:** every callback receives a `context`, and nothing is stored globally, so one module can serve many sites. See [Multiple sites](#multiple-sites) and [multitenancy_phoenix](/elixir/multitenancy_phoenix/).

## Installation

```elixir
def deps do
  [
    {:site_maps, "~> 0.1"},
    # only for the S3 and R2 adapters
    {:ex_aws, "~> 2.5"},
    {:ex_aws_s3, "~> 2.5"},
    {:req, "~> 0.5"},
    # only for SiteMaps.Oban.Worker
    {:oban, "~> 2.19"}
  ]
end
```

If you use the S3 or R2 adapter, also add `config :ex_aws, http_client: ExAws.Request.Req`.

## Quick start

`mix site_maps.gen MyApp.Sitemaps` writes a starter module. A minimal one looks like this:

```elixir
defmodule MyApp.Sitemaps do
  use SiteMaps,
    otp_app: :my_app,
    adapter: {SiteMaps.Adapters.FileSystem, directory: "priv/sitemaps"}

  process :static

  @impl SiteMaps
  def urls(:static, _args, _context) do
    [url("/", changefreq: :daily, priority: 1.0), url("/about")]
  end
end
```

Set the public URL of the index, per environment:

```elixir
# config/runtime.exs
config :my_app, MyApp.Sitemaps, url: "https://example.com/sitemap.xml.gz"
```

Generate the files:

```elixir
SiteMaps.generate(MyApp.Sitemaps)
#=> {:ok, %SiteMaps.Result{index: "https://example.com/sitemap.xml.gz", links: 2, ...}}
```

```
mix site_maps.generate MyApp.Sitemaps
```

Serve them from the endpoint, before the router:

```elixir
plug SiteMaps.Plug, sitemaps: {MyApp.Sitemaps, %{}}
```

`https://example.com/sitemap.xml.gz` is now answered from `priv/sitemaps`.

## Configuration

Options (see `SiteMaps.Config` for the full list) come from three sources, merged in this order so
later sources win:

1. **`use SiteMaps` options**, fixed at compile time: `use SiteMaps, adapter: ..., max_links: 10_000`.
2. **The application environment**, read at runtime when `otp_app:` is given: `config :my_app, MyApp.Sitemaps, url: ...`.
3. **The `config/1` callback**, when the module defines it. It receives the context, so options can depend on the site.

`url` and `adapter` are required. A `url` ending in `.xml.gz` gzips every file.

## Defining sitemaps

```elixir
defmodule MyApp.Sitemaps do
  use SiteMaps,
    otp_app: :my_app,
    adapter: {SiteMaps.Adapters.FileSystem, directory: "/mnt/nfs/sitemaps"},
    xsl_stylesheet_url: "/_sitemap-stylesheet.xsl",
    xsl_index_stylesheet_url: "/_sitemap-index-stylesheet.xsl"

  process :static
  process :news, "news/sitemap.xml"

  process :posts, "posts/%{year}-%{month}/sitemap.xml",
    args: [year: :integer, month: :integer],
    defaults: [year: &__MODULE__.this_year/0, month: &__MODULE__.this_month/0]

  @impl SiteMaps
  def urls(:static, _args, _context), do: [url("/", changefreq: :daily, priority: 1.0), url("/about")]

  def urls(:posts, %{year: year, month: month}, _context) do
    MyApp.Posts.stream_published(year, month)
    |> Stream.map(&url("/posts/#{&1.slug}", lastmod: &1.updated_at, images: [loc: &1.cover_url]))
  end

  def urls(:news, _args, _context) do
    for post <- MyApp.Posts.latest(100) do
      url("/posts/#{post.slug}",
        news: [publication_name: "My App", publication_language: "en", title: post.title, publication_date: post.published_at]
      )
    end
  end

  def this_year, do: Date.utc_today().year
  def this_month, do: Date.utc_today().month
end
```

`url/2` takes a path, which is resolved against the site origin, or an absolute URL. Options are:

- **Core tags:** `lastmod` (`DateTime`, `Date`, or `NaiveDateTime`, which is read as UTC), `changefreq` and `priority`. Each is written only when set. The `default_changefreq` and `default_priority` options supply values for URLs that don't set one.
- **Extensions:** `images` (up to 1,000 per URL), `videos`, `news`, `alternates` (hreflang), `mobile` and `pagemap`.

Values are checked against the sitemap XSDs, and invalid ones raise. Tags Google deprecated in 2022, such as image caption/title/license, video category/gallery/price, news keywords/genres, mobile and PageMap, are supported but written only when you set them.

Optional callbacks:
- `external_sitemaps/1`: entries added to the index as they are.
- `url_filter/2`: return `nil` to drop a URL, or a changed URL to replace it.
- `config/1`: options that depend on the context, see [Configuration](#configuration).
- `load_context/1`: builds the context from strings, for the mix task and Oban jobs.

## Generating

```elixir
SiteMaps.generate(MyApp.Sitemaps)
# every process, dynamic ones with their default args (here: the current month)

SiteMaps.generate(MyApp.Sitemaps,
  only: [:static, posts: [year: 2026, month: 3], posts: [year: 2026, month: 4]],
  prune: true,
  max_concurrency: 8
)
#=> {:ok, %SiteMaps.Result{index: "https://example.com/sitemap.xml.gz", links: 1234, files: [...], pruned: [...]}}
```

- **File names:** a process writes numbered files at its location, e.g. `posts/2026-3/sitemap1.xml.gz`, `posts/2026-3/sitemap2.xml.gz`, and so on. A process without a location writes `sitemap_<name>1.xml.gz` next to the index. When a file name ends in a digit, a `-` goes before the counter (`posts-12-1.xml`).
- **Location rules:**
  - A dynamic process must interpolate every argument in its location, so each shard gets its own files.
  - Two processes can't share a location.
  - Locations and interpolated values may only use `A-Z a-z 0-9 . _ ~ -`, and a value can't contain `/`.
- **The index:** written last, and only when every process succeeded.
- **Partial runs:** the existing index is read through the adapter. Only the entries of the regenerated shards are replaced. Entries of the other shards of declared processes are kept, while entries of removed processes and former external sitemaps are dropped.
- **Pruning:** `prune: true` deletes files of the regenerated shards that the new index no longer lists.
- **Inline mode:** a module with exactly one process, which is static and has no location, and no `external_sitemaps/1`, writes its URLs straight to the configured URL with no index, as long as they fit in one file. Otherwise it writes numbered files and an index.

From the command line:

```
mix site_maps.generate MyApp.Sitemaps
mix site_maps.generate MyApp.Sitemaps posts --arg year=2025 --arg month=12 --prune
mix site_maps.gen MyApp.Sitemaps           # starter module
mix site_maps.gen MyApp.Sitemaps --multi   # starter module for multiple sites
```

Process arguments are cast to their declared types.

## Protocol limits

| Limit | Default | Max |
|---|---|---|
| URLs per file (`max_links`) | 50,000 | 50,000 |
| Uncompressed bytes per file (`max_bytes`), header and footer included | 50,000,000 | 52,428,800 |
| News URLs per file (`max_news`) | 1,000 | 1,000 |
| Index entries (`max_index_links`) | 50,000 | 50,000 |
| Images per URL | | 1,000 |
| URL length | | 2,047 characters |

What happens at a limit:
- A file is closed **before** an entry would cross a limit, and the entry goes to the next file.
- An entry that can't fit in an empty file fails the run: `generate/2` returns `{:error, {:process_failed, name, args, :error, %SiteMaps.EntryTooLargeError{}, stacktrace}}`.
- An index that would pass its limit fails the run, because sitemap indexes can't be nested.

## Storage adapters

| Adapter | Use |
|---|---|
| `SiteMaps.Adapters.FileSystem` | Local disk, NFS/EFS/SMB mounts and volumes. Files are written to a temp file in the target directory, fsynced and renamed into place, so other nodes never read a partial file. |
| `SiteMaps.Adapters.S3` | AWS S3 and S3-compatible stores (MinIO, Spaces, Wasabi, Ceph). It sends no ACL header unless you set `acl:`, and uploads large files in parts. |
| `SiteMaps.Adapters.R2` | Cloudflare R2. A preset over S3 with `account_id:`, `region: "auto"`, path style and no ACLs. |
| `SiteMaps.Adapters.Memory` | Tests. |
| `SiteMaps.Adapters.Noop` | Dry runs. |

```elixir
config :my_app, MyApp.Sitemaps,
  url: "https://example.com/sitemap.xml.gz",
  adapter: {SiteMaps.Adapters.S3, bucket: "sitemaps", prefix: "example", region: "us-east-1"}

config :my_app, MyApp.Sitemaps,
  url: "https://example.com/sitemap.xml.gz",
  adapter:
    {SiteMaps.Adapters.R2,
     account_id: "...", bucket: "sitemaps", prefix: "example",
     access_key_id: System.fetch_env!("R2_ACCESS_KEY_ID"), secret_access_key: System.fetch_env!("R2_SECRET_ACCESS_KEY")}
```

Storage keys are relative to the directory of the configured `url`. The public URL and the storage location are independent: the files above live under `example/` in the bucket, while their `<loc>` stays `https://example.com/...`.

To use another store, implement the `SiteMaps.Adapter` behaviour (`write/4`, `read/2`, `delete/2`, `list/2`).

## Serving

```elixir
# endpoint.ex, before the router
plug SiteMaps.Plug, sitemaps: {MyApp.Sitemaps, %{}}
```

The plug serves:
- the sitemap files of the resolved site (`.xml` and `.xml.gz`), answering `304` to a matching `if-modified-since`
- the built-in XSL stylesheets at `/_sitemap-stylesheet.xsl` and `/_sitemap-index-stylesheet.xsl`

Everything else passes through. An `.xml` request for a gzipped file is answered uncompressed, so browsers can render it with the stylesheet.

Files on S3 or R2 can also be served straight from the bucket or its custom domain.

```elixir
SiteMaps.RobotsTxt.render(sitemaps: SiteMaps.config!(MyApp.Sitemaps, %{}), extra: ["Disallow: /admin"])
```

## Background jobs

```elixir
MyApp.Sitemaps
|> SiteMaps.Oban.Worker.new_job(only: [posts: [year: 2026, month: 3]])
|> Oban.insert()
```

- **Queue:** jobs run on the `:sitemaps` queue.
- **Uniqueness:** a job isn't inserted while an identical run (same module, context, processes and arguments) is available, scheduled, executing or retryable.
- **Defaults are fixed at enqueue time:** missing arguments, including those of every process when `:only` is omitted, are filled in when the job is built, so a retry regenerates the same shards.
- **Serializing runs:** different runs, e.g. a full run and a partial one, can overlap. Run `:sitemaps` with `limit: 1`. The package doesn't lock storage, because NFS locks aren't reliable.

## Telemetry

The package emits these events:
- `[:site_maps, :run | :process, :start | :stop | :exception]`
- `[:site_maps, :urlset, :write]`
- `[:site_maps, :index, :write]`
- `[:site_maps, :url, :foreign_host]`

`SiteMaps.Telemetry.attach_default_logger/1` logs the `:stop`, `:exception`, `:write` and `:foreign_host` events.

## Multiple sites

Most apps have one site and need nothing from this section. When one app serves several sites, for
example a host→site→theme Phoenix app built with
[multitenancy_phoenix](/elixir/multitenancy_phoenix/), pass a `context` that
identifies the site and implement `config/1` to build each site's options from it:

```elixir
defmodule MyApp.Sitemaps do
  use SiteMaps,
    xsl_stylesheet_url: "/_sitemap-stylesheet.xsl",
    xsl_index_stylesheet_url: "/_sitemap-index-stylesheet.xsl"

  @impl SiteMaps
  def config(%{site: site}) do
    [
      url: "https://#{site.host}/sitemap.xml.gz",
      adapter: {SiteMaps.Adapters.FileSystem, directory: "/mnt/nfs/sitemaps/#{site.slug}"}
    ]
  end

  @impl SiteMaps
  def load_context(%{"site" => slug}), do: %{site: MyApp.Sites.get_by_slug!(slug)}

  process :static

  @impl SiteMaps
  def urls(:static, _args, %{site: site}) do
    site |> MyApp.Pages.stream_published() |> Stream.map(&url("/#{&1.slug}", lastmod: &1.updated_at))
  end
end
```

`config/1` is merged over the `use` options and the application environment. Nothing is stored
globally, so different sites can generate at the same time:

```elixir
SiteMaps.generate(MyApp.Sitemaps, context: %{site: site})
```

```
mix site_maps.generate MyApp.Sitemaps --context site=acme
```

- **Context from strings:** context values from the CLI and Oban arrive as strings. `load_context/1` turns `%{"site" => "acme"}` into your context.
- **Serving:** give the plug a function that resolves the site from the request host. It returns `{module, context}`, or `nil` to pass through:

  ```elixir
  # endpoint.ex, before the router
  plug SiteMaps.Plug, sitemaps: &MyAppWeb.Sitemaps.for_conn/1

  def for_conn(conn) do
    if site = MyApp.Sites.by_host(conn.host), do: {MyApp.Sitemaps, %{site: site}}
  end
  ```

- **robots.txt:** `SiteMaps.RobotsTxt.render(sitemaps: SiteMaps.config!(MyApp.Sitemaps, %{site: site}))`.
- **Background jobs:** pass a JSON serializable context, `SiteMaps.Oban.Worker.new_job(MyApp.Sitemaps, context: %{site: "acme"})`. Uniqueness covers the context, so each site has its own runs. To serialize the runs of one site, give each site its own queue with `limit: 1` (`queue:` option of `new_job/2`).
- **Storage:** keep the files of each site apart, with a directory or a bucket `prefix` per site.

## Examples

- [`examples/single_site`](https://github.com/marcosgz/site_maps_ex/tree/master/examples/single_site) is a Phoenix app with one site: the module, the runtime configuration, generation and serving.
- [`examples/two_tenants`](https://github.com/marcosgz/site_maps_ex/tree/master/examples/two_tenants) is a Phoenix app that serves sitemaps for two tenants (`acme.localtest.me` and `globex.localtest.me`) from one module.


## License

MIT
