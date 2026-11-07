# marcosgz · projects

Documentation site for the open-source Ruby and Elixir libraries maintained by
[@marcosgz](https://github.com/marcosgz). Built with [Astro](https://astro.build),
deployed to Cloudflare Pages at <https://gems.marcosz.com.br>.

The site is split by language. Each language has its own colour and index page:

- **Ruby** (`/ruby/`, projects at `/<slug>/`): Esse and its extensions, Lepus and
  Lepus Saga (with its ActiveRecord and Sequel stores), SiteMaps, Multitenancy for Rails.
- **Elixir** (`/elixir/`, projects at `/elixir/<slug>/`): Multitenancy for Phoenix, SiteMaps.

Every library is listed in `src/data/projects.ts`; `family` groups extensions under
the library they extend.

## Local development

```bash
npm install
npm run dev           # http://localhost:4321
npm run build         # static site in ./dist
npm run preview       # serve ./dist
```

Node 22.12+ is required (`.node-version` pins the CI version).

## How the docs are sourced

Docs are imported into `src/content/docs/<id>/` by `scripts/import-docs.mjs`:

- Gems with a `docs/` folder: every `.md` file from `~/workspace/gems/<gem>/docs/`,
  with frontmatter (`title`, `slug`, `order`, `project`) and `README.md` as the
  landing page.
- Libraries documented by their README alone (the Lepus Saga gems and the Elixir
  packages in `~/workspace/mix_ex/`): the README becomes the landing page, its
  brand header is dropped and relative links point at the repository. Elixir pages
  also drop the passages that compare them with the Ruby libraries; the script
  warns if any Ruby mention is left.

Re-run after updating upstream docs, for everything or for some projects:

```bash
npm run import:docs
npm run import:docs -- lepus elixir-site_maps
```

The import is deterministic — it wipes each project's destination directory
before writing, so removed upstream pages disappear from the site.

## Deployment

The repo deploys to **Cloudflare Pages** via a GitHub Actions workflow
(`.github/workflows/deploy.yml`).

### One-time setup

1. Create a Cloudflare Pages project named `marcosgz-gems` (Direct Upload).
2. In the GitHub repo, add two secrets:
   - `CLOUDFLARE_API_TOKEN` — a token with "Cloudflare Pages: Edit" scope.
   - `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account ID.
3. In Cloudflare, bind the custom domain `gems.marcosz.com.br` to the
   Pages project.

### On push

Every push to `main` runs:

- `npm ci`
- `npm run build` — produces `./dist`
- `wrangler pages deploy dist --project-name=marcosgz-gems`

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
  components/        # Header, Footer, Band, Family, Install, DocNav, TOC…
  content/
    docs/            # imported markdown, one folder per project
  data/
    projects.ts      # languages and project metadata
    docs.ts          # static paths for a language's docs
  layouts/
    BaseLayout.astro
    DocsLayout.astro
  pages/
    index.astro             # landing: one column per language
    ruby/index.astro        # language pages
    elixir/index.astro
    [project]/[...slug].astro          # Ruby docs
    elixir/[project]/[...slug].astro   # Elixir docs
  styles/
    global.css              # design system
  content.config.ts         # content collection schema
scripts/
  import-docs.mjs
public/
  logos/                    # esse.png (the Lepus mark is inline in Logo.astro)
  favicon.svg
```

## Licence

MIT — see individual gem licences for each library covered.
