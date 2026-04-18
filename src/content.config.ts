import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const docs = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/docs',
    // Use the full path (project/page) so pages with the same filename
    // across projects (index.md, api.md, …) don't collide.
    generateId: ({ entry }) => entry.replace(/\.md$/, ''),
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    order: z.number().default(1000),
    project: z.string(),
  }),
});

export const collections = { docs };
