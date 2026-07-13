import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/notes' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    author: z.string().optional(),
    cover: z.string().optional(),
    image: z.string().optional(),
    public: z.boolean().default(false),
  }),
});

export const collections = { notes };
