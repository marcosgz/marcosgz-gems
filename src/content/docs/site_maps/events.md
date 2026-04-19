---
title: Events
slug: events
order: 18
project: site_maps
---
`site_maps` ships a lightweight pub/sub system under `SiteMaps::Notification`. Use it for logging, metrics, or reacting to particular generation phases.

## Subscribing

### Block subscribers

```ruby
SiteMaps::Notification.subscribe('sitemaps.finalize_urlset') do |event|
  Rails.logger.info(
    "[sitemap] wrote #{event[:links_count]} urls to #{event[:url]} in #{event[:runtime]}s"
  )
end
```

### Class subscribers

A class with one method per event name (dots become underscores):

```ruby
class SitemapMetrics
  def self.sitemaps_process_execution(event)
    StatsD.timing('sitemaps.process', event[:runtime], tags: ["process:#{event[:process].name}"])
  end

  def self.sitemaps_finalize_urlset(event)
    StatsD.increment('sitemaps.urlset.written', tags: ["url:#{event[:url]}"])
  end

  def self.sitemaps_ping(event)
    event[:results].each do |engine, result|
      StatsD.increment('sitemaps.ping', tags: ["engine:#{engine}", "status:#{result[:status]}"])
    end
  end
end

SiteMaps::Notification.subscribe(SitemapMetrics)
```

### The built-in listener

For colored terminal output during CLI runs:

```ruby
SiteMaps::Notification.subscribe(SiteMaps::Runner::EventListener)
```

This is subscribed automatically by the CLI.

## Events

| Event | Payload keys |
|-------|-------------|
| `sitemaps.enqueue_process` | `process`, `kwargs` |
| `sitemaps.before_process_execution` | `process`, `kwargs` |
| `sitemaps.process_execution` | `process`, `kwargs`, `runtime` |
| `sitemaps.finalize_urlset` | `url`, `links_count`, `news_count`, `last_modified`, `runtime`, `process` |
| `sitemaps.ping` | `results` |

`process` is a `SiteMaps::Process` struct (`name`, `location_template`, `kwargs_template`, `block`).

## Event ordering

For each process the sequence is:

1. `sitemaps.enqueue_process`
2. `sitemaps.before_process_execution`
3. One or more `sitemaps.finalize_urlset` (one per split file)
4. `sitemaps.process_execution`

After all processes complete, one final `sitemaps.finalize_urlset` fires for the sitemap index itself. If pinging is enabled, `sitemaps.ping` fires last.

## Use cases

- **Logging.** Tail-friendly output of what just ran, how many URLs, runtime.
- **Metrics.** StatsD / OpenTelemetry counters for throughput and ping outcomes.
- **Alerting.** Subscribe to `sitemaps.ping`, alert on non-200 results.
- **Cache busting.** After `sitemaps.finalize_urlset`, purge the CDN entry for the written URL.
