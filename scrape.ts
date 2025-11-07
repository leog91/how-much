
import { eq } from 'drizzle-orm';
import { db } from './src/db.ts';
import { products, productsToScrape, providerSelectors } from './src/schema.ts';


import { chromium, type Locator } from 'playwright';
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


    const products = await getProductsFromDb()

    let scrappedSummary = [];


    for (const product of products) {


        const scrapedProductPrice = await scrapeProduct(product);
        console.log(chalk.magenta(`Scraped price for ${product.products_to_scrape.name}: ${scrapedProductPrice}`));

        saveToDB({
            title: product.products_to_scrape.name,
            price: scrapedProductPrice,
            url: product.products_to_scrape.url,
        });

        scrappedSummary.push({
            name: product.products_to_scrape.name,
            price: scrapedProductPrice,
        });


    }


    console.log('Scraping completed.');
    return scrappedSummary;


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



//checkType
async function scrapeProduct(productToScrapeFull: ProductToScrapeFull): Promise<string> {
    const url = productToScrapeFull.products_to_scrape.url

    console.log(`Launching browser and navigating to ${url}...`);

    //to-do >> check first headless  false 
    const browser = await chromium.launch({ headless: false });


    const page = await browser.newPage();


    await page.goto(url, {
        waitUntil: 'networkidle', // waits until no network requests for 500 ms
        timeout: 60000,           // 1 minute
    });


    let priceElement = null;

    let content = null;

    try {
        const priceSector = productToScrapeFull.provider_selectors?.priceSelector;
        priceElement = await page.waitForSelector(`xpath=${priceSector}`, { timeout: 10000 });

        const locator = page.locator(`xpath=${priceSector}`).first();
        content = await locator.textContent();
        console.log(content);
        console.log("info", 'Price element found using primary selector.', productToScrapeFull.products_to_scrape.name);

    }
    catch (error) {

        console.error("info", `Primary selector failed, trying fallback selector...`);

        const NotInSaleSelector = productToScrapeFull.provider_selectors?.priceSelectorNotInSale;

        try {
            priceElement = await page.waitForSelector(`xpath=${NotInSaleSelector}`, { timeout: 10000 });



            const locator = page.locator(`xpath=${NotInSaleSelector}`).first();
            content = await locator.textContent();
            console.log(content);

        } catch (error) {
            console.error("FAIL>>", `Both primary and fallback selectors failed.`, productToScrapeFull.products_to_scrape.name);
        }
    }
    await browser.close();

    return content || 'No content found';
}



