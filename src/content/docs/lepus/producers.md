---
title: Producers
slug: producers
order: 13
project: lepus
---
A producer publishes messages to an exchange. It's a subclass of `Lepus::Producer` with a `configure` call and whatever convenience methods you want on top.

> **Looking for a one-off publish?** Skip straight to [`Lepus::Publisher`](#lepuspublisher--one-off-publishing) — a lower-level API for pushing a single message without declaring a `Producer` class, middleware chain, or DSL.

## Minimal example

```ruby
class OrdersProducer < Lepus::Producer
  configure(
    exchange: { name: 'orders', type: :topic, durable: true },
    publish:  { persistent: true }
  )

  use :json
  use :correlation_id
end
```

Publish from anywhere in your app:

```ruby
OrdersProducer.publish(
  { order_id: 42, total: 99.99 },
  routing_key: 'order.created'
)
```

## `configure` DSL

```ruby
configure(
  exchange: { name: 'orders', type: :topic, durable: true },
  publish:  { persistent: true, mandatory: false }
)
```

| Key | Purpose |
|-----|---------|
| `exchange` | String (name only) or hash (`name`, `type`, `durable`, `auto_delete`). Auto-declared on first publish. |
| `publish` | Default publish options merged into every `publish` call: `persistent`, `mandatory`, `content_type`, `expiration`, etc. |

## Publishing

```ruby
OrdersProducer.publish(payload, routing_key: 'order.created')
OrdersProducer.publish(payload, routing_key: 'order.paid', headers: { tenant_id: 123 })
OrdersProducer.publish(payload, routing_key: 'order.created', expiration: 60_000)
```

All Bunny publish options are supported. Frequently useful:

| Option | Purpose |
|--------|---------|
| `routing_key` | Routing key. |
| `persistent` | Persist the message across RabbitMQ restarts. |
| `headers` | Custom headers. |
| `correlation_id` | RPC pattern correlation. Auto-set by `:correlation_id` middleware. |
| `content_type` | MIME type. Auto-set to `application/json` by `:json` middleware. |
| `expiration` | Per-message TTL in milliseconds. |
| `mandatory` | Return the message if it can't be routed. |

## Payload types

- A Hash — pair with `:json` middleware to serialize.
- A String — sent as-is.
- Anything else — pair with a middleware that turns it into bytes.

## Middleware

```ruby
class OrdersProducer < Lepus::Producer
  use :json
  use :correlation_id
  use :instrumentation
  use :header, 'X-Service', 'orders-api'
end
```

Built-in producer middlewares:

| Name | Purpose |
|------|---------|
| `:json` | Serialize a hash into JSON; sets `content_type`. |
| `:correlation_id` | Auto-generate a UUID `correlation_id` if absent. |
| `:header` | Add a static or dynamic header: `use :header, 'X-Foo', 'bar'`. |
| `:instrumentation` | Emit `ActiveSupport::Notifications` events around each publish. |
| `:unique` | Reject duplicate publishes (by correlation id — needs external storage). |

Write your own — see [middleware.md](middleware.md).

## Convenience class methods

Wrap `publish` with domain-specific signatures:

```ruby
class OrdersProducer < Lepus::Producer
  configure(exchange: { name: 'orders', type: :topic, durable: true })
  use :json
  use :correlation_id

  def self.order_created(order)
    publish(
      { order_id: order.id, total: order.total, created_at: order.created_at },
      routing_key: 'order.created'
    )
  end

  def self.order_shipped(order)
    publish(
      { order_id: order.id, shipped_at: order.shipped_at },
      routing_key: 'order.shipped'
    )
  end
end

# In your code:
OrdersProducer.order_created(order)
```

## Connection pooling

Producers share a single connection pool across the process:

```ruby
Lepus.configure do |config|
  config.producer do |p|
    p.pool_size    = 5
    p.pool_timeout = 5.0
  end
end
```

## Enable / disable publishing

Useful when you want to disable side effects in tests or a specific environment.

```ruby
# Globally
Lepus::Producers.disable!
Lepus::Producers.enabled?(OrdersProducer)  # => false

# By producer class
Lepus::Producers.disable!(OrdersProducer)

# By exchange name
Lepus::Producers.disable!('orders')

# Block-scoped
Lepus::Producers.without_publishing do
  OrdersProducer.publish(...)  # no-op
end

Lepus::Producers.with_publishing do
  OrdersProducer.publish(...)  # forced through even if disabled
end
```

## Error handling

A publish can fail for many reasons — connection down, channel closed, etc. By default, Bunny retries with exponential backoff within `recovery_attempts`. For anything beyond that, you catch and handle it:

```ruby
begin
  OrdersProducer.order_created(order)
rescue Bunny::Exception => e
  Rails.logger.error("publish failed: #{e.message}")
  # queue for later retry, fall back to a DB outbox, etc.
end
```

## Testing

See [testing.md](testing.md) — there's a `Lepus::Testing.producer_messages(ProducerClass)` helper that captures publishes in-memory.

## `Lepus::Publisher` — one-off publishing

Not every publish deserves a whole `Producer` class. When you just need to drop a message onto an exchange — a throwaway admin script, a rake task, a one-off migration notifier — reach for `Lepus::Publisher`.

```ruby
publisher = Lepus::Publisher.new('orders', type: :topic, durable: true)

publisher.publish(
  { order_id: 42, total: 99.99 },
  routing_key: 'order.created'
)
```

That's it — no subclass, no `configure` block, no middleware chain.

### Constructor

```ruby
Lepus::Publisher.new(exchange_name, **exchange_options)
```

- `exchange_name` — the exchange to publish to. Declared on first publish if it doesn't exist.
- `exchange_options` — merged over the defaults `{ type: :topic, durable: true, auto_delete: false }`.

### Publishing

```ruby
publisher.publish(payload, **publish_options)
```

- `payload` — a `String` (sent as-is, `content_type: text/plain`) or any other object (serialized with `MultiJson`, `content_type: application/json`).
- `publish_options` — merged over `{ persistent: true }`. All Bunny publish options are supported (`routing_key`, `headers`, `expiration`, `mandatory`, etc.).

### Reusing an existing channel

For batch publishes within an existing transaction, use `channel_publish` to reuse a channel you already hold:

```ruby
Lepus.config.producer_config.with_connection do |connection|
  connection.with_channel do |channel|
    10.times do |i|
      publisher.channel_publish(channel, { seq: i }, routing_key: 'bulk.row')
    end
  end
end
```

### When to pick `Publisher` vs `Producer`

| Use `Lepus::Publisher` when… | Use `Lepus::Producer` when… |
|---|---|
| One-off publish from a script or task | The same exchange is used from many call sites |
| You don't need middleware (`:json`, `:correlation_id`, `:instrumentation`) | You want reusable payload serialization or tracing |
| You don't need `Lepus::Testing.producer_messages` to capture it | You want tests to capture the calls |
| You don't need `Lepus::Producers.disable!(ProducerClass)` | You want per-class kill-switches |

Both go through the same connection pool (`Lepus.config.producer_config`) and both respect `Lepus::Producers.enabled?(exchange_name)` — so `without_publishing { }` silences `Publisher` calls too.
