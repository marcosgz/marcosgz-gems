export type ProjectGroup = 'core' | 'esse-ecosystem';

export interface Project {
  slug: string;
  name: string;
  displayName: string;
  tagline: string;
  group: ProjectGroup;
  stars: [number, number]; // [cx, cy] on a 1000x600 grid, for the constellation
  magnitude: number; // 1 = brightest, 4 = dim (controls star size)
  logo?: { type: 'image'; src: string } | { type: 'svg'; href: string };
  repo: string;
  language: string;
  badge?: string;
}

export const projects: Project[] = [
  {
    slug: 'esse',
    name: 'esse',
    displayName: 'Esse',
    tagline:
      'An Elasticsearch/OpenSearch toolkit for Ruby applications — ETL-style indices, repositories, and documents.',
    group: 'core',
    stars: [180, 220],
    magnitude: 1,
    logo: { type: 'image', src: '/logos/esse.png' },
    repo: 'https://github.com/marcosgz/esse',
    language: 'Ruby',
    badge: 'core',
  },
  {
    slug: 'lepus',
    name: 'lepus',
    displayName: 'Lepus',
    tagline:
      'RabbitMQ-backed producer/consumer framework for Ruby — supervisor, middleware, CLI, and a live web dashboard.',
    group: 'core',
    stars: [520, 140],
    magnitude: 1,
    logo: { type: 'svg', href: '/logos/lepus.svg' },
    repo: 'https://github.com/marcosgz/lepus',
    language: 'Ruby',
    badge: 'core',
  },
  {
    slug: 'site_maps',
    name: 'site_maps',
    displayName: 'SiteMaps',
    tagline:
      'Concurrent, adapter-based sitemap.xml generation with full SEO extensions — image, video, news, hreflang.',
    group: 'core',
    stars: [820, 300],
    magnitude: 1,
    logo: { type: 'svg', href: '/logos/site_maps.svg' },
    repo: 'https://github.com/marcosgz/site_maps',
    language: 'Ruby',
    badge: 'core',
  },
  {
    slug: 'multitenancy-rails',
    name: 'multitenancy-rails',
    displayName: 'Multitenancy · Rails',
    tagline:
      'White-label, multi-tenant Rails applications — per-tenant themes, view namespaces, and isolated asset pipelines.',
    group: 'core',
    stars: [380, 80],
    magnitude: 1,
    logo: { type: 'svg', href: '/logos/multitenancy-rails.svg' },
    repo: 'https://github.com/marcosgz/multitenancy-rails',
    language: 'Ruby',
    badge: 'core',
  },
  {
    slug: 'esse-active_record',
    name: 'esse-active_record',
    displayName: 'Esse · ActiveRecord',
    tagline: 'ActiveRecord integration for Esse — auto-index on record lifecycle.',
    group: 'esse-ecosystem',
    stars: [260, 430],
    magnitude: 2,
    repo: 'https://github.com/marcosgz/esse-active_record',
    language: 'Ruby',
  },
  {
    slug: 'esse-rails',
    name: 'esse-rails',
    displayName: 'Esse · Rails',
    tagline: 'Rails integration, generators, and Railtie for Esse.',
    group: 'esse-ecosystem',
    stars: [400, 490],
    magnitude: 2,
    repo: 'https://github.com/marcosgz/esse-rails',
    language: 'Ruby',
  },
  {
    slug: 'esse-sequel',
    name: 'esse-sequel',
    displayName: 'Esse · Sequel',
    tagline: 'Sequel integration — auto-index records from Sequel models.',
    group: 'esse-ecosystem',
    stars: [540, 440],
    magnitude: 2,
    repo: 'https://github.com/marcosgz/esse-sequel',
    language: 'Ruby',
  },
  {
    slug: 'esse-async_indexing',
    name: 'esse-async_indexing',
    displayName: 'Esse · Async Indexing',
    tagline: 'Background-job indexing via Sidekiq or Faktory.',
    group: 'esse-ecosystem',
    stars: [680, 510],
    magnitude: 2,
    repo: 'https://github.com/marcosgz/esse-async_indexing',
    language: 'Ruby',
  },
  {
    slug: 'esse-hooks',
    name: 'esse-hooks',
    displayName: 'Esse · Hooks',
    tagline: 'Lifecycle callbacks around index operations.',
    group: 'esse-ecosystem',
    stars: [820, 490],
    magnitude: 3,
    repo: 'https://github.com/marcosgz/esse-hooks',
    language: 'Ruby',
  },
  {
    slug: 'esse-jbuilder',
    name: 'esse-jbuilder',
    displayName: 'Esse · Jbuilder',
    tagline: 'Define documents with Jbuilder templates.',
    group: 'esse-ecosystem',
    stars: [140, 380],
    magnitude: 3,
    repo: 'https://github.com/marcosgz/esse-jbuilder',
    language: 'Ruby',
  },
  {
    slug: 'esse-kaminari',
    name: 'esse-kaminari',
    displayName: 'Esse · Kaminari',
    tagline: 'Kaminari pagination for Esse search queries.',
    group: 'esse-ecosystem',
    stars: [900, 380],
    magnitude: 3,
    repo: 'https://github.com/marcosgz/esse-kaminari',
    language: 'Ruby',
  },
  {
    slug: 'esse-pagy',
    name: 'esse-pagy',
    displayName: 'Esse · Pagy',
    tagline: 'Pagy pagination backend for Esse.',
    group: 'esse-ecosystem',
    stars: [80, 510],
    magnitude: 3,
    repo: 'https://github.com/marcosgz/esse-pagy',
    language: 'Ruby',
  },
  {
    slug: 'esse-rspec',
    name: 'esse-rspec',
    displayName: 'Esse · RSpec',
    tagline: 'RSpec matchers and index stubs for testing Esse-backed code without a live cluster.',
    group: 'esse-ecosystem',
    stars: [700, 380],
    magnitude: 3,
    repo: 'https://github.com/marcosgz/esse-rspec',
    language: 'Ruby',
  },
];

export const coreProjects = projects.filter((p) => p.group === 'core');
export const ecosystemProjects = projects.filter((p) => p.group === 'esse-ecosystem');

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}

// Edges of the constellation — connect related projects.
export const constellationEdges: [string, string][] = [
  ['esse', 'esse-active_record'],
  ['esse', 'esse-rails'],
  ['esse', 'esse-sequel'],
  ['esse', 'esse-jbuilder'],
  ['esse', 'esse-pagy'],
  ['esse', 'esse-async_indexing'],
  ['esse-active_record', 'esse-rails'],
  ['esse-rails', 'esse-async_indexing'],
  ['esse-async_indexing', 'esse-hooks'],
  ['esse-sequel', 'esse-hooks'],
  ['esse-hooks', 'esse-kaminari'],
  ['esse', 'esse-rspec'],
  ['esse', 'lepus'],
  ['lepus', 'site_maps'],
];
