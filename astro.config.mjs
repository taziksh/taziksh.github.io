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
  redirects: {
    '/notes/greedy-algorithms-i': '/notes/greedy-algorithms-do-all-the-activities',
    '/notes/job-probs': '/notes/job-probabilities',
    '/notes/crispy-tofu': '/notes/how-to-make-crispy-tofu',
    '/notes/i-replaced-my-framer-subscription-with-claude-code':
      '/notes/i-reverse-engineered-my-framer-site-and-saved-200',
  },
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
