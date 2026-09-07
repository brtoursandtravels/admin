import { z } from "zod";

const envSchema = z.object({
  apiBaseUrl: z.string().startsWith("/"),
  publicSiteUrl: z.string().url(),
});

export const env = envSchema.parse({
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  publicSiteUrl: import.meta.env.VITE_PUBLIC_SITE_URL,
});
