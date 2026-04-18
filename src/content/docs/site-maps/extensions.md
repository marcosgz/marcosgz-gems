---
title: SEO Extensions
slug: extensions
order: 21
project: site-maps
---
`s.add` accepts options for every sitemap extension recognized by Google and Bing. Pass any of the following alongside `lastmod`, `priority`, and `changefreq`.

## Image

Up to 1,000 images per URL.

```ruby
s.add('/gallery/summer', images: [
  {
    loc:          'https://cdn.example.com/summer/beach.jpg',
    title:        'Beach sunset',
    caption:      'A photo from the summer trip',
    geo_location: 'Cape Cod, MA',
    license:      'https://creativecommons.org/licenses/by/4.0/'
  }
])
```

## Video

Up to 1,000 video entries per sitemap file.

```ruby
s.add('/videos/how-to', videos: [
  {
    thumbnail_loc:         'https://cdn.example.com/thumbs/how-to.jpg',
    title:                 'How to use site_maps',
    description:           'A quick walkthrough',
    content_loc:           'https://cdn.example.com/videos/how-to.mp4',
    player_loc:            'https://example.com/embed/how-to',
    duration:              600,
    publication_date:      Time.now,
    rating:                4.8,
    view_count:            12_345,
    family_friendly:       true,
    requires_subscription: false,
    live:                  false,
    tags:                  %w[tutorial guide],
    category:              'Technology',
    uploader:              'example-team',
    uploader_info:         'https://example.com/about',
    gallery_loc:           'https://example.com/videos',
    gallery_title:         'Example video gallery',
    price:                 nil,
    allow_embed:           true,
    autoplay:              'ap=1'
  }
])
```

## News

Up to 1,000 news entries per sitemap file (use a dedicated process for news URLs).

```ruby
s.add('/news/breaking', news: {
  publication_name:     'Example Times',
  publication_language: 'en',
  publication_date:     Time.now,
  title:                'Breaking news headline',
  keywords:             'breaking, politics',
  genres:               'PressRelease',
  access:               'Subscription',
  stock_tickers:        'NASDAQ:EXMP'
})
```

## Alternate language / hreflang

```ruby
s.add('/', alternates: [
  { href: 'https://example.com/en', lang: 'en' },
  { href: 'https://example.com/es', lang: 'es' },
  { href: 'https://example.com/fr', lang: 'fr', nofollow: true }
])
```

The `nofollow: true` variant emits `rel="nofollow alternate"` on the link. Use it to declare locale variants without signalling Google to crawl them as equivalents.

## Mobile

Declare a URL as mobile-friendly:

```ruby
s.add('/mobile-page', mobile: true)
```

## PageMap

Structured data for Google Custom Search.

```ruby
s.add('/products/widget', pagemap: {
  dataobjects: [
    {
      type: 'product',
      id:   'sku-123',
      attributes: [
        { name: 'name',  value: 'Widget' },
        { name: 'price', value: '19.99' },
        { name: 'color', value: 'blue' }
      ]
    }
  ]
})
```

## Combined example

Everything can coexist on a single URL:

```ruby
s.add('/products/widget',
  lastmod:    Time.now,
  priority:   0.9,
  changefreq: 'weekly',
  images:     [{ loc: 'https://cdn.example.com/widget.jpg', title: 'Widget' }],
  alternates: [{ href: 'https://example.com/es/products/widget', lang: 'es' }],
  mobile:     true,
  pagemap:    { dataobjects: [{ type: 'product', id: 'sku-123', attributes: [] }] }
)
```

## Disabling `priority` / `changefreq`

Both fields are optional per the sitemap spec, and many search engines ignore them. Disable globally if you want smaller files:

```ruby
configure do |config|
  config.emit_priority   = false
  config.emit_changefreq = false
end
```

## Output size

- Per URL set: 50,000 links **or** 1,000 news items **or** 50 MB uncompressed — whichever comes first. When one of these is hit, the current file is finalized and a new one starts.
- File naming is automatic (`posts/sitemap.xml` → `posts/sitemap1.xml`, `posts/sitemap2.xml`, …).
- Use the `.gz` extension in `config.url` to emit gzipped files — most search engines fetch either form.
