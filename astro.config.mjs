// @ts-check
import { defineConfig } from 'astro/config';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mdx from '@astrojs/mdx';
import rehypeLinkFavicons from './src/rehype-link-favicons.mjs';
import remarkObsidianImages from './src/remark-obsidian-images.mjs';

export default defineConfig({
  site: 'https://tazik.sh',
  integrations: [mdx()],
  markdown: {
    remarkPlugins: [remarkObsidianImages, remarkBreaks, remarkMath],
    rehypePlugins: [rehypeLinkFavicons, rehypeKatex],
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
    },
  },
});
