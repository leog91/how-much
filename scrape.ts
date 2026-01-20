
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db.ts';
import { products, productsToScrape, providerSelectors } from './src/schema.ts';


import { chromium, type Locator, type Page } from 'playwright';
import chalk from 'chalk';


interface Product {
    title: string;
    price: string;
    url: string;
}



type ProductToScrapeFull = {
    products_to_scrape: {
        id: string;
        url: string;
        provider: string;
        name: string;
        dateAdded: string | null;
        active: boolean | null;
        notes: string | null;
    };
    provider_selectors: {
        id: string;
        provider: string;
        priceSelector: string;
        priceSelectorNotInSale: string;
        titleSelector: string;
        imageSelector: string | null;
        availabilitySelector: string | null;
        updatedAt: string | null;
        notes: string | null;
    } | null;
}



export async function main() {
    const products = await getProductsFromDb();
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    let scrappedSummary = [];

    for (const product of products) {
        const scrapedProductPrice = await scrapeProduct(product, page);
        console.log(chalk.magenta(`Scraped price for ${product.products_to_scrape.name}: ${scrapedProductPrice}`));

        await saveToDB({
            title: product.products_to_scrape.name,
            price: scrapedProductPrice,
            url: product.products_to_scrape.url,
        });

        scrappedSummary.push({
            name: product.products_to_scrape.name,
            price: scrapedProductPrice,
        });
    }

    await browser.close();
    console.log(chalk.greenBright('Scraping completed.'));
    return scrappedSummary;
}



export async function testLastAdded() {


    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    const result = await db.select()
        .from(productsToScrape)
        .orderBy(sql`${productsToScrape.dateAdded} COLLATE NOCASE desc`)
        .limit(1)
        .leftJoin(providerSelectors, eq(productsToScrape.provider, providerSelectors.provider))
        .where(eq(productsToScrape.active, true))


    const scrapedProductPrice = await scrapeProduct(result[0]!, page);

    console.log(chalk.magenta(`Scraped price for ${result[0]!.products_to_scrape.name}: ${scrapedProductPrice}`));

    await browser.close();

}



async function getProductsFromDb() {

    const activeProducts = await db.select().from(productsToScrape).leftJoin(providerSelectors, eq(productsToScrape.provider, providerSelectors.provider))
        .where(eq(productsToScrape.active, true))

    return activeProducts;
}


async function saveToDB(scrapedProduct: Product) {
    console.log(`\nAttempting to insert ${scrapedProduct.title} new price history records...`);
    try {
        await db.insert(products)
            .values({
                id: crypto.randomUUID(),
                price: scrapedProduct.price,
                title: scrapedProduct.title,
                url: scrapedProduct.url
            });
        console.log(" Data insertion successful. New rows added for price history.");
    } catch (error) {
        console.error("\n Database insertion failed:", error);
    }

    console.log("Saved to DB:", scrapedProduct.title);

}



async function scrapeProduct(productToScrapeFull: ProductToScrapeFull, page: Page): Promise<string> {
    const url = productToScrapeFull.products_to_scrape.url;
    console.log(`Navigating to ${url}...`);

    try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const selectors = [
            productToScrapeFull.provider_selectors?.priceSelector,
            productToScrapeFull.provider_selectors?.priceSelectorNotInSale,
        ];

        let content: string | null = null;

        for (const selector of selectors) {
            if (!selector) continue;
            try {
                const locator = page.locator(`xpath=${selector}`).first();
                await locator.waitFor({ timeout: 10000 });
                content = await locator.textContent();
                console.log(chalk.green(`Found price for ${productToScrapeFull.products_to_scrape.name}: ${content}`));
                break;
            } catch {
                console.warn(chalk.yellow(`Selector failed: ${selector}`));
            }
        }

        if (!content) {
            console.error(chalk.red(`No selectors worked for ${productToScrapeFull.products_to_scrape.name}`));
        }

        return content?.trim() || 'No content found';
    } catch (error) {
        console.error(chalk.red(`Error scraping ${url}:`), error);
        return 'Error occurred';
    }
}

await main();
