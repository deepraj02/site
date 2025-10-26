import { SITE } from "../config";
import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

const blog = defineCollection({
    type: "content_layer",
    loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
    schema: ({ image }) =>
        z.object({
            author: z.string().default(SITE.author),
            pubDatetime: z.date(),
            modDatetime: z.date().optional().nullable(),
            title: z.string(),
            featured: z.boolean().optional(),
            draft: z.boolean().optional(),
            tags: z.array(z.string()).default(["others"]),
            ogImage: image()
                .refine((img) => img.width >= 1200 && img.height >= 630, {
                    message:
                        "OpenGraph image must be at least 1200 X 630 pixels!",
                })
                .or(z.string())
                .optional(),
            description: z.string(),
            canonicalURL: z.string().optional(),
            editPost: z
                .object({
                    disabled: z.boolean().optional(),
                    url: z.string().optional(),
                    text: z.string().optional(),
                    appendFilePath: z.boolean().optional(),
                })
                .optional(),
        }),
});

const experience = defineCollection({
    type: "content_layer",
    loader: glob({ pattern: "**/*.md", base: "./src/content/experience" }),
    schema: z.object({
        company: z.string(),
        role: z.string(),
        startDate: z.date(),
        endDate: z.date().optional().nullable(),
        companyUrl: z.string().optional(),
        draft: z.boolean().optional(),
    }),
});
const projects = defineCollection({
    type: "content_layer",
    loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
    schema: z.object({
        title: z.string(),
        date: z.date(),
        githubUrl: z.string().optional(),
        projectUrl: z.string().optional(),
        featured: z.boolean().optional(),
        draft: z.boolean().optional(),
        tags: z.array(z.string()).default([]),
    }),
});

export const collections = { blog, experience, projects };
