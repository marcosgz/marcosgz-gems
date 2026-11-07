import { getCollection } from 'astro:content';
import { projectsFor, type Lang } from './projects';

/** Static paths for every imported page of a language's projects. */
export async function docPaths(lang: Lang) {
  const bySlug = new Map(projectsFor(lang).map((p) => [p.id, p]));
  const all = await getCollection('docs');
  return all.flatMap((entry) => {
    const project = bySlug.get(entry.data.project);
    if (!project) return [];
    return [
      {
        params: { project: project.slug, slug: entry.data.slug === 'index' ? undefined : entry.data.slug },
        props: { entry },
      },
    ];
  });
}
