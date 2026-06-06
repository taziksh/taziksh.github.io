// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import rehypeLinkFavicons from './src/rehype-link-favicons.mjs';

export default defineConfig({
  site: 'https://tazik.sh',
  markdown: {
    remarkPlugins: [remarkBreaks],
    rehypePlugins: [rehypeLinkFavicons],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
