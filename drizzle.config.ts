
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    out: './drizzle',
    schema: './src/schema.ts',
    dialect: 'sqlite',
    dbCredentials: {
        // This is just a path, Bun doesn't need the full URL like other drivers
        url: 'scraped_data.db',
    },
});