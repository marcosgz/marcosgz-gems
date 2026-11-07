#!/usr/bin/env node
// Imports docs from each source gem into src/content/docs/<project-slug>/,
// injecting Astro frontmatter derived from filename and first H1.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const gemsRoot = path.resolve(process.env.HOME, 'workspace', 'gems');
const contentRoot = path.join(projectRoot, 'src', 'content', 'docs');
const publicImagesRoot = path.join(projectRoot, 'public', 'images');

const mixRoot = path.resolve(process.env.HOME, 'workspace', 'mix_ex');

// Elixir pages are written for Phoenix developers: drop the lines that compare
// a library with its Ruby sibling.
const dropSection = (heading) => (source) =>
  source.replace(new RegExp(`\\n## ${heading}\\n[\\s\\S]*?(?=\\n## )`), '\n');

const projects = [
  { slug: 'esse', gem: 'esse', order: 10 },
  { slug: 'lepus', gem: 'lepus', order: 20 },
  { slug: 'site_maps', gem: 'site_maps', order: 30 },
  { slug: 'multitenancy-rails', gem: 'multitenancy-rails', order: 35 },
  { slug: 'esse-active_record', gem: 'esse-active_record', order: 40 },
  { slug: 'esse-rails', gem: 'esse-rails', order: 50 },
  { slug: 'esse-sequel', gem: 'esse-sequel', order: 60 },
  { slug: 'esse-async_indexing', gem: 'esse-async_indexing', order: 70 },
  { slug: 'esse-hooks', gem: 'esse-hooks', order: 80 },
  { slug: 'esse-jbuilder', gem: 'esse-jbuilder', order: 90 },
  { slug: 'esse-kaminari', gem: 'esse-kaminari', order: 100 },
  { slug: 'esse-pagy', gem: 'esse-pagy', order: 110 },
  { slug: 'esse-rspec', gem: 'esse-rspec', order: 120 },
  { slug: 'esse-will_paginate', gem: 'esse-will_paginate', order: 130 },
  ...['lepus-saga', 'lepus-saga-active_record', 'lepus-saga-sequel'].map((gem) => ({
    slug: gem,
    readme: path.join(gemsRoot, gem),
    title: 'Overview',
    repo: `https://github.com/marcosgz/${gem}`,
    branch: 'master',
  })),
  {
    slug: 'elixir-multitenancy_phoenix',
    readme: path.join(mixRoot, 'multitenancy_phoenix'),
    title: 'Overview',
    repo: 'https://github.com/marcosgz/multitenancy_phoenix',
    branch: 'master',
    transform: (source) =>
      source
        .replace(/: the Elixir counterpart of\s*\n\[multitenancy-rails\]\([^)]*\)\./, '.')
        .replace(/\n\| multitenancy-rails[^\n]*\n(?:\|[^\n]*\n)+/, '\n')
        .replace(/ the same way a Rails fallback view renders inside the theme layout\./, ' inside the theme layout.'),
  },
  {
    slug: 'elixir-site_maps',
    readme: path.join(mixRoot, 'site_maps'),
    title: 'Overview',
    repo: 'https://github.com/marcosgz/site_maps_ex',
    branch: 'master',
    transform: (source) =>
      dropSection('Coming from the Ruby gem')(
        source.replace(/ It is the Elixir port of the\s*\n\[site_maps\]\([^)]*\) Ruby gem\./, ''),
      ),
  },
];

// Site routes for the GitHub repos of imported projects, so README links stay on the site.
const siteRoutes = {
  'https://github.com/marcosgz/lepus': '/lepus/',
  'https://github.com/marcosgz/lepus-saga': '/lepus-saga/',
  'https://github.com/marcosgz/lepus-saga-active_record': '/lepus-saga-active_record/',
  'https://github.com/marcosgz/lepus-saga-sequel': '/lepus-saga-sequel/',
  'https://github.com/marcosgz/multitenancy_phoenix': '/elixir/multitenancy_phoenix/',
  'https://github.com/marcosgz/site_maps_ex': '/elixir/site_maps/',
};

const RUBY_HINT = /\b(ruby|rails|gem)\b/i;

// Preferred page order within a project.
const pageOrder = [
  'README', 'getting-started', 'configuration', 'usage',
  'index', 'repository', 'document', 'collection',
  'themes', 'generator', 'processes', 'adapters',
  'consumers', 'producers', 'middleware',
  'search', 'import', 'transport',
  'events', 'plugins', 'cli',
  'extensions', 'integrations', 'rake-tasks',
  'supervisor', 'web', 'testing', 'rails',
  'errors', 'api',
];
const orderOf = (name) => {
  const idx = pageOrder.indexOf(name);
  return idx === -1 ? 1000 : idx;
};

async function firstH1(source) {
  const m = source.match(/^#\s+(.+?)\s*$/m);
  return m ? m[1].trim() : null;
}

async function stripTopH1(source) {
  return source.replace(/^#\s+.+?\n+/, '');
}

// Rewrite inline markdown links from gem-relative `.md` paths to Astro routes.
// - `foo.md` (same dir) → `/<slug>/foo/`
// - `README.md` / `index.md` (same dir) → `/<slug>/`
// - `index.md` in a project where README also exists → `/<slug>/esse-index/`
// - `../../<gem>/docs/page.md` → `/<gem>/page/` (README → `/<gem>/`)
// Preserves fragments (`#anchor`). External links (http, mailto, tel, #, /) are untouched.
function rewriteMarkdownLinks(source, { slug, hasReadme }) {
  return source.replace(/(\]\()([^)\s]+?)(\))/g, (match, open, url, close) => {
    if (/^(https?:|mailto:|tel:|ftp:|#|\/)/i.test(url)) return match;

    const hashIdx = url.indexOf('#');
    let pathPart = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
    const fragment = hashIdx >= 0 ? url.slice(hashIdx) : '';

    pathPart = pathPart.replace(/^\.\//, '');

    // Same-dir image reference (`images/file.png`) — the import script already
    // mirrors docs/images/ into public/images/<slug>/, so rewrite to the
    // absolute Astro URL. Keep the check BEFORE the `.md` branches since
    // images don't end in `.md`.
    const imageMatch = pathPart.match(/^images\/(.+)$/);
    if (imageMatch && !pathPart.endsWith('.md')) {
      return `${open}/images/${slug}/${imageMatch[1]}${fragment}${close}`;
    }

    let targetSlug;
    let fileBase;

    const crossGem = pathPart.match(/^\.\.\/\.\.\/([^/]+)\/docs\/(.+)$/);
    if (crossGem) {
      targetSlug = crossGem[1];
      const rest = crossGem[2];
      if (!rest.endsWith('.md')) return match;
      fileBase = rest.slice(0, -3);
    } else if (pathPart.endsWith('.md') && !pathPart.includes('/')) {
      targetSlug = slug;
      fileBase = pathPart.slice(0, -3);
    } else {
      return match;
    }

    const isCrossGem = Boolean(crossGem);
    const targetHasReadme = isCrossGem ? true : hasReadme;

    let targetUrl;
    if (fileBase === 'README') {
      targetUrl = `/${targetSlug}/`;
    } else if (fileBase === 'index' && targetHasReadme) {
      // README wins the index slot, and the source index.md was renamed to esse-index.md
      // (see processProject's collision handling).
      targetUrl = `/${targetSlug}/esse-index/`;
    } else if (fileBase === 'index') {
      targetUrl = `/${targetSlug}/`;
    } else {
      targetUrl = `/${targetSlug}/${fileBase}/`;
    }

    return `${open}${targetUrl}${fragment}${close}`;
  });
}

function yamlEscape(value) {
  if (/[:#'"\\]/.test(value) || value.startsWith('-')) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return value;
}

async function processProject({ slug, gem, order }) {
  const src = path.join(gemsRoot, gem, 'docs');
  const dst = path.join(contentRoot, slug);

  let entries;
  try {
    entries = await fs.readdir(src);
  } catch {
    console.warn(`[skip] no docs at ${src}`);
    return 0;
  }

  await fs.mkdir(dst, { recursive: true });

  // Wipe destination first so stale files from previous imports don't linger.
  for (const stale of await fs.readdir(dst)) {
    if (stale.endsWith('.md')) await fs.unlink(path.join(dst, stale));
  }

  const bases = entries
    .filter((e) => e.endsWith('.md'))
    .map((e) => e.replace(/\.md$/, ''));
  const hasReadme = bases.includes('README');

  // Process README last so it wins the `index` slot on any collision.
  const mdEntries = entries
    .filter((e) => e.endsWith('.md'))
    .sort((a, b) => (a === 'README.md' ? 1 : b === 'README.md' ? -1 : a.localeCompare(b)));

  let count = 0;
  for (const entry of mdEntries) {
    const absSrc = path.join(src, entry);
    const base = entry.replace(/\.md$/, '');
    const isReadme = base === 'README';
    // If both README and index exist, rename the `index` page so README can
    // own the index slot (README is the project overview; index.md in esse
    // documents the Esse::Index class).
    let slugName;
    if (isReadme) {
      slugName = 'index';
    } else if (base === 'index' && hasReadme) {
      slugName = 'esse-index';
    } else {
      slugName = base;
    }
    const absDst = path.join(dst, `${slugName}.md`);

    const raw = await fs.readFile(absSrc, 'utf8');
    const title = (await firstH1(raw)) || base;
    const stripped = await stripTopH1(raw);
    const body = rewriteMarkdownLinks(stripped, { slug, hasReadme });

    // README always sorts first; other pages use the preferred page order.
    const weight = isReadme ? -1 : orderOf(base);
    const frontmatter = [
      '---',
      `title: ${yamlEscape(title)}`,
      `slug: ${slugName}`,
      `order: ${weight}`,
      `project: ${slug}`,
      '---',
      '',
    ].join('\n');

    await fs.writeFile(absDst, frontmatter + body);
    count++;
  }

  // If the gem ships a docs/images/ folder, mirror it under public/images/<slug>/
  // so doc pages can reference `/images/<slug>/<file>`. Non-destructive: never
  // deletes existing images (downstream may have manually-placed screenshots).
  const imagesSrc = path.join(src, 'images');
  try {
    const imageEntries = await fs.readdir(imagesSrc);
    const imagesDst = path.join(publicImagesRoot, slug);
    await fs.mkdir(imagesDst, { recursive: true });
    for (const file of imageEntries) {
      const from = path.join(imagesSrc, file);
      const to = path.join(imagesDst, file);
      const stat = await fs.stat(from);
      if (stat.isFile()) await fs.copyFile(from, to);
    }
    if (imageEntries.length > 0) {
      console.log(`[ok] ${slug}: ${count} pages, ${imageEntries.length} images`);
      return count;
    }
  } catch {
    // no images/ dir — fine
  }

  console.log(`[ok] ${slug}: ${count} pages`);
  return count;
}

// Projects documented by their README alone: it becomes the project's index
// page, the centred brand header is dropped (the site draws its own), and
// relative links point at the repository.
async function processReadme({ slug, readme, title, repo, branch, transform = (s) => s }) {
  const raw = await fs.readFile(path.join(readme, 'README.md'), 'utf8');
  const dst = path.join(contentRoot, slug);
  await fs.mkdir(dst, { recursive: true });

  let body = raw
    .replace(/^<h1[\s\S]*?<\/h1>\s*/, '')
    .replace(/^<p align="center">.*<\/p>\s*/m, '')
    .replace(/^#\s+.+?\n+/, '');
  body = transform(body);
  body = body.replace(/(\]\()([^)\s]+?)(\))/g, (match, open, url, close) => {
    if (siteRoutes[url]) return `${open}${siteRoutes[url]}${close}`;
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(url)) return match;
    return `${open}${repo}/blob/${branch}/${url.replace(/^\.\//, '')}${close}`;
  });

  if (slug.startsWith('elixir-') && RUBY_HINT.test(body)) {
    const lines = body.split('\n').filter((line) => RUBY_HINT.test(line));
    console.warn(`[check] ${slug} still mentions Ruby:\n  ${lines.join('\n  ')}`);
  }

  const frontmatter = ['---', `title: ${yamlEscape(title)}`, 'slug: index', 'order: -1', `project: ${slug}`, '---', ''].join('\n');
  await fs.writeFile(path.join(dst, 'index.md'), frontmatter + body);
  console.log(`[ok] ${slug}: README`);
  return 1;
}

async function main() {
  const only = process.argv.slice(2);
  const selected = only.length ? projects.filter((p) => only.includes(p.slug)) : projects;
  let total = 0;
  for (const project of selected) {
    total += await (project.readme ? processReadme(project) : processProject(project));
  }
  console.log(`\nimported ${total} pages across ${selected.length} projects.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
