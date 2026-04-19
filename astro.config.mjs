import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://gems.marcosz.com.br',
  trailingSlash: 'ignore',
  integrations: [
    expressiveCode({
      themes: ['github-light', 'one-dark-pro'],
      themeCssSelector: (theme) => `[data-theme='${theme.name === 'github-light' ? 'light' : 'dark'}']`,
      styleOverrides: {
        borderRadius: '0',
        borderWidth: '1px',
        codeFontFamily: 'var(--font-mono)',
        codeFontSize: '0.85rem',
        codeLineHeight: '1.6',
        frames: {
          shadowColor: 'transparent',
          editorActiveTabBorderColor: 'var(--accent)',
          editorTabBarBorderBottomColor: 'var(--rule)',
          terminalTitlebarBorderBottomColor: 'var(--rule)',
        },
      },
      defaultProps: { showLineNumbers: false },
    }),
    sitemap({
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        // Home and top-level project pages are more important than deep docs.
        const url = new URL(item.url);
        const depth = url.pathname.split('/').filter(Boolean).length;
        if (depth === 0) item.priority = 1.0;
        else if (depth === 1) item.priority = 0.9;
        else item.priority = 0.6;
        return item;
      },
    }),
  ],
  markdown: {
    smartypants: true,
    gfm: true,
  },
  build: {
    format: 'directory',
  },
  compressHTML: true,
});
