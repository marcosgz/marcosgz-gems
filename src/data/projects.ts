export type Lang = 'ruby' | 'elixir';

export interface Language {
  key: Lang;
  name: string;
  registry: string;
  blurb: string;
}

export const languages: Record<Lang, Language> = {
  ruby: {
    key: 'ruby',
    name: 'Ruby',
    registry: 'RubyGems',
    blurb:
      'Search indexing, RabbitMQ messaging and sagas, sitemaps and multi-tenant Rails. Plain Ruby first, with Rails support where it helps.',
  },
  elixir: {
    key: 'elixir',
    name: 'Elixir',
    registry: 'Hex',
    blurb:
      'Multi-site Phoenix apps and sitemaps that stream, run in parallel and serve many tenants from one module.',
  },
};

export interface Project {
  /** Unique key; also the content folder under src/content/docs. */
  id: string;
  /** URL segment under the language's base path. */
  slug: string;
  lang: Lang;
  name: string;
  displayName: string;
  tagline: string;
  /** id of the library this one extends; families render together. */
  family?: string;
  /** An image path, or `mark:<name>` for a mark drawn inline in the text colour. */
  logo?: string;
  /** The project's full logo, shown in place of its name; `dark` is used on the dark theme. */
  wordmark?: { light: string; dark?: string; width: number; height: number };
  repo: string;
  /** Where the imported pages live upstream. */
  source: string;
  /** The line a reader pastes to install it. */
  install: string;
  registryUrl: string;
}

const gem = (name: string) => `https://rubygems.org/gems/${name}`;
const hex = (name: string) => `https://hex.pm/packages/${name}`;
const gh = (name: string) => `https://github.com/marcosgz/${name}`;

export const projects: Project[] = [
  {
    id: 'esse',
    slug: 'esse',
    lang: 'ruby',
    name: 'esse',
    displayName: 'Esse',
    tagline:
      'Elasticsearch and OpenSearch for Ruby apps: indices, repositories and documents defined in plain Ruby, imported in bulk.',
    logo: '/logos/esse.png',
    wordmark: { light: '/logos/esse.png', width: 785, height: 298 },
    repo: gh('esse'),
    source: `${gh('esse')}/tree/main/docs`,
    install: 'gem "esse"',
    registryUrl: gem('esse'),
  },
  {
    id: 'lepus',
    slug: 'lepus',
    lang: 'ruby',
    name: 'lepus',
    displayName: 'Lepus',
    tagline:
      'RabbitMQ consumers and producers with retries, delayed messages, a supervisor, a CLI and a live topology dashboard.',
    logo: 'mark:lepus',
    wordmark: { light: '/logos/lepus-light.svg', dark: '/logos/lepus-dark.svg', width: 278, height: 90 },
    repo: gh('lepus'),
    source: `${gh('lepus')}/tree/main/docs`,
    install: 'gem "lepus"',
    registryUrl: gem('lepus'),
  },
  {
    id: 'site_maps',
    slug: 'site_maps',
    lang: 'ruby',
    name: 'site_maps',
    displayName: 'SiteMaps',
    tagline:
      'Concurrent, incremental sitemap generation with image, video, news and hreflang extensions.',
    repo: gh('site_maps'),
    source: `${gh('site_maps')}/tree/main/docs`,
    install: 'gem "site_maps"',
    registryUrl: gem('site_maps'),
  },
  {
    id: 'multitenancy-rails',
    slug: 'multitenancy-rails',
    lang: 'ruby',
    name: 'multitenancy-rails',
    displayName: 'Multitenancy for Rails',
    tagline:
      'White-label Rails apps: each host resolves to a site, each site to a theme with its own views, routes and assets.',
    repo: gh('multitenancy-rails'),
    source: `${gh('multitenancy-rails')}/tree/main/docs`,
    install: 'gem "multitenancy-rails"',
    registryUrl: gem('multitenancy-rails'),
  },
  {
    id: 'lepus-saga',
    slug: 'lepus-saga',
    lang: 'ruby',
    name: 'lepus-saga',
    displayName: 'Lepus Saga',
    tagline:
      'Multi-step workflows on Lepus: ordered steps with retries and compensations, safe against duplicate and lost messages, with a live web console.',
    family: 'lepus',
    wordmark: { light: '/logos/lepus-saga-light.svg', dark: '/logos/lepus-saga-dark.svg', width: 359, height: 81 },
    repo: gh('lepus-saga'),
    source: gh('lepus-saga'),
    install: 'gem "lepus-saga"',
    registryUrl: gem('lepus-saga'),
  },
  {
    id: 'lepus-saga-active_record',
    slug: 'lepus-saga-active_record',
    lang: 'ruby',
    name: 'lepus-saga-active_record',
    displayName: 'Lepus Saga · ActiveRecord',
    tagline: 'ActiveRecord store for Lepus Saga, with a Rails generator. PostgreSQL, MySQL/MariaDB and SQLite.',
    family: 'lepus',
    repo: gh('lepus-saga-active_record'),
    source: gh('lepus-saga-active_record'),
    install: 'gem "lepus-saga-active_record"',
    registryUrl: gem('lepus-saga-active_record'),
  },
  {
    id: 'lepus-saga-sequel',
    slug: 'lepus-saga-sequel',
    lang: 'ruby',
    name: 'lepus-saga-sequel',
    displayName: 'Lepus Saga · Sequel',
    tagline: 'Sequel store for Lepus Saga with bundled migrations; shares its schema with the ActiveRecord store.',
    family: 'lepus',
    repo: gh('lepus-saga-sequel'),
    source: gh('lepus-saga-sequel'),
    install: 'gem "lepus-saga-sequel"',
    registryUrl: gem('lepus-saga-sequel'),
  },
  ...(
    [
      ['esse-active_record', 'ActiveRecord', 'Index ActiveRecord models and keep them in sync on commit.'],
      ['esse-rails', 'Rails', 'Rails generators, Railtie and instrumentation for Esse.'],
      ['esse-sequel', 'Sequel', 'Index Sequel models and keep them in sync.'],
      ['esse-async_indexing', 'Async Indexing', 'Index in the background with Sidekiq or Faktory.'],
      ['esse-hooks', 'Hooks', 'Turn model callbacks on and off around index operations.'],
      ['esse-jbuilder', 'Jbuilder', 'Write search queries as Jbuilder templates.'],
      ['esse-kaminari', 'Kaminari', 'Kaminari pagination for search results.'],
      ['esse-pagy', 'Pagy', 'Pagy pagination for search results.'],
      ['esse-will_paginate', 'WillPaginate', 'WillPaginate pagination for search results.'],
      ['esse-rspec', 'RSpec', 'Matchers and stubs to test Esse code without a running cluster.'],
    ] as const
  ).map(([name, label, tagline]): Project => ({
    id: name,
    slug: name,
    lang: 'ruby',
    name,
    displayName: `Esse · ${label}`,
    tagline,
    family: 'esse',
    repo: gh(name),
    source: `${gh(name)}/tree/main/docs`,
    install: `gem "${name}"`,
    registryUrl: gem(name),
  })),
  {
    id: 'elixir-multitenancy_phoenix',
    slug: 'multitenancy_phoenix',
    lang: 'elixir',
    name: 'multitenancy_phoenix',
    displayName: 'Multitenancy for Phoenix',
    tagline:
      'Serve many sites from one Phoenix app: each host resolves to a site, each site to a theme with its own router, templates, LiveViews and assets.',
    repo: gh('multitenancy_phoenix'),
    source: gh('multitenancy_phoenix'),
    install: '{:multitenancy_phoenix, "~> 0.2"}',
    registryUrl: hex('multitenancy_phoenix'),
  },
  {
    id: 'elixir-site_maps',
    slug: 'site_maps',
    lang: 'elixir',
    name: 'site_maps',
    displayName: 'SiteMaps',
    tagline:
      'Sitemaps streamed to disk, S3 or R2: parallel processes, incremental shards, every protocol extension, and one module for many sites.',
    repo: gh('site_maps_ex'),
    source: gh('site_maps_ex'),
    install: '{:site_maps, "~> 0.1"}',
    registryUrl: hex('site_maps'),
  },
];

export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export function projectsFor(lang: Lang): Project[] {
  return projects.filter((p) => p.lang === lang);
}

/** Top-level libraries of a language, each with the ones that extend it. */
export function familiesFor(lang: Lang): { lead: Project; members: Project[] }[] {
  const all = projectsFor(lang);
  return all
    .filter((p) => !p.family)
    .map((lead) => ({ lead, members: all.filter((p) => p.family === lead.id) }));
}

export function langBase(lang: Lang): string {
  return lang === 'ruby' ? '' : `/${lang}`;
}

export function projectHref(project: Project, page = 'index'): string {
  const base = `${langBase(project.lang)}/${project.slug}/`;
  return page === 'index' ? base : `${base}${page}/`;
}
