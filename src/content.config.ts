import { z, defineCollection } from "astro:content";
import { glob } from "astro/loaders";

const blogsCollection = defineCollection({
	loader: glob({ pattern: "**/[^_]*.{md,mdx}", base: "./src/content/blog" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			description: z.string(),
			author: z.string(),
			date: z.date(),
			image: image(),
			imageAlt: z.string(),
			isFeatured: z.boolean().optional().default(false),
			// --- НОВЫЕ ПОЛЯ ДЛЯ SEO-ДВИГАТЕЛЯ ---
			// Определяем тип контента: "столп" или "кластер"
			contentType: z.enum(['pillar', 'cluster']).optional().default('cluster'),
			// Если это "кластер", указываем ID родительского "столпа"
			parentPillar: z.string().optional(),
		}),
});

export const collections = {
	blog: blogsCollection,
};
