---
title: Rake Tasks
slug: rake-tasks
order: 23
project: multitenancy-rails
---
The gem registers tasks under the `multitenancy:` namespace.

## `multitenancy:tailwindcss:build`

Compile Tailwind CSS for every theme.

```bash
bin/rails multitenancy:tailwindcss:build
```

- Discovers `themes/<name>/app/assets/tailwind/<name>/application.css` inputs.
- Writes to `themes/<name>/app/assets/builds/<name>/application.css`.
- Skips themes without a Tailwind input file.
- Creates the builds directory if missing (so Propshaft picks up the output).

This task is wired into `assets:precompile`:

```ruby
Rake::Task['assets:precompile'].enhance(['multitenancy:tailwindcss:build'])
```

So production deploys compile theme CSS automatically — no additional config.

## `multitenancy:tailwindcss:watch`

Watch mode for development.

```bash
bin/rails multitenancy:tailwindcss:watch
```

- Spawns one watcher process per theme.
- Recompiles on file changes under the theme's Tailwind directory.
- Traps `SIGINT` / `SIGTERM` to clean up all child PIDs on exit.

Runs in the foreground. Use it alongside `bin/dev` or a separate terminal.

## Prerequisites

Both tasks require `tailwindcss-rails ~> 4.4`. If the gem isn't in your bundle, the tasks are not registered (no error — they just don't exist).

## Troubleshooting

**"Task 'multitenancy:tailwindcss:build' not found"**  
You're missing `tailwindcss-rails` in your Gemfile. Add it (`gem 'tailwindcss-rails', '~> 4.4'`), `bundle install`, restart.

**Build output not picked up by asset pipeline**  
The integration excludes `themes/<name>/app/assets/tailwind/` from Propshaft (the raw inputs), but includes `themes/<name>/app/assets/builds/` (the outputs). If you're using Sprockets or Vite, you may need to adjust.

**Themes compile to the same path**  
Each theme's output is under its own subdirectory (`builds/<theme-name>/application.css`), so collisions are impossible as long as theme directories have distinct names.
