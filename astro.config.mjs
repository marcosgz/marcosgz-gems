import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://projects.marcosz.com.br',
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
    sitemap(),
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
