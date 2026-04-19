# marcosgz · projects

Documentation site for the open-source Ruby gems maintained by
[@marcosgz](https://github.com/marcosgz). Built with [Astro](https://astro.build),
deployed to Cloudflare Pages at <https://projects.marcosz.com.br>.

Covers:

- **Esse** — Elasticsearch/OpenSearch toolkit for Ruby
- **Lepus** — RabbitMQ producer/consumer framework
- **SiteMaps** — concurrent sitemap.xml generation
- The full **Esse ecosystem** (ActiveRecord, Rails, Sequel, Sidekiq, Jbuilder,
  Kaminari, Pagy, Hooks, Async Indexing)

## Local development

```bash
npm install
npm run dev           # http://localhost:4321
npm run build         # static site in ./dist
npm run preview       # serve ./dist
```

Node 20+ is required (`.node-version` pins the CI version).

## How the docs are sourced

Each project's Markdown docs live in its own gem under `docs/`. They are imported
into `src/content/docs/<slug>/` by `scripts/import-docs.mjs`, which:

1. Reads every `.md` file from `~/workspace/gems/<gem>/docs/`.
2. Injects Astro frontmatter (`title`, `slug`, `order`, `project`).
3. Maps `README.md` → `index.md` (the project landing page).

Re-run after updating upstream gem docs:

```bash
npm run import:docs
```

The import is deterministic — it wipes each project's destination directory
before writing, so removed upstream pages disappear from the site.

## Deployment

The repo deploys to **Cloudflare Pages** via a GitHub Actions workflow
(`.github/workflows/deploy.yml`).

### One-time setup

1. Create a Cloudflare Pages project named `marcosgz-projects` (Direct Upload).
2. In the GitHub repo, add two secrets:
   - `CLOUDFLARE_API_TOKEN` — a token with "Cloudflare Pages: Edit" scope.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
3. In Cloudflare, bind the custom domain `projects.marcosz.com.br` to the
   Pages project.

### On push

Every push to `main` runs:

- `npm ci`
- `npm run build` — produces `./dist`
- `wrangler pages deploy dist --project-name=marcosgz-projects`

Pull requests deploy to preview URLs automatically.

## Theming

Light and dark themes are both first-class.

- **Auto-detect**: the initial theme follows `prefers-color-scheme`.
- **Manual override**: the toggle in the header writes to `localStorage`.
- **No flash**: an inline script in `BaseLayout.astro` resolves the theme
  before first paint.

Themed code blocks are rendered by [`astro-expressive-code`](https://expressive-code.com/)
with `github-light` for light mode and `one-dark-pro` for dark mode. The
themes are switched via `[data-theme='...']` selectors.

## Layout

```
src/
  components/        # Header, Footer, ProjectCard, ConstellationHero, DocNav, TOC…
  content/
    docs/            # imported markdown, one folder per project
    config.ts        # content collection schema
  data/
    projects.ts      # project metadata + constellation coordinates
  layouts/
    BaseLayout.astro
    DocsLayout.astro
  pages/
    index.astro             # landing
    [project]/[...slug].astro
  styles/
    global.css              # design system
scripts/
  import-docs.mjs
public/
  logos/                    # esse.png, lepus.svg, site_maps.svg, multitenancy-rails.svg
  favicon.svg
```

## Licence

MIT — see individual gem licences for each library covered.
