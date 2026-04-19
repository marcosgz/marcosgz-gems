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
];

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
    const body = await stripTopH1(raw);

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

async function main() {
  let total = 0;
  for (const project of projects) {
    total += await processProject(project);
  }
  console.log(`\nimported ${total} pages across ${projects.length} projects.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
