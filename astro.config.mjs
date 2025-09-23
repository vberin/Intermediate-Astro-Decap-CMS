import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import icon from "astro-icon";

// Импортируем path для разрешения путей
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://www.yourwebsite.com", // update me!
  integrations: [
    icon(),
    sitemap({
      filter: (page) => !page.includes("/admin"),
      changefreq: "weekly",
      priority: 0.7,
    }),
  ],
  // --- ЭТОТ БЛОК ОБЯЗАТЕЛЕН ДЛЯ КОРРЕКТНОЙ СБОРКИ ---
  vite: {
    resolve: {
      alias: {
        "@layouts": path.resolve(__dirname, "./src/layouts"),
        "@assets": path.resolve(__dirname, "./src/assets"),
        "@data": path.resolve(__dirname, "./src/data"),
        "@styles": path.resolve(__dirname, "./src/styles"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@js": path.resolve(__dirname, "./src/js"),
      },
    },
  },
});
