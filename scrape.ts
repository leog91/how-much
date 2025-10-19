
import { db } from './src/db.ts';
import { products } from './src/schema.ts';


import { chromium } from 'playwright';


interface Product {
    title: string;
    price: string;
    url: string;
}

const TARGET_URL = 'https://www.webscraper.io/test-sites/e-commerce/static';

async function scrapeProducts(): Promise<Product[]> {
    console.log(`Launching browser and navigating to ${TARGET_URL}...`);

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();


    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' });


    await page.waitForSelector('.jumbotron', { timeout: 5000 });

    console.log('Starting data extraction...');
    const evalData = await page.$$eval(

        '.col-md-4.col-xl-4.col-lg-4',
        (cards) => {

            return cards.map(card => {

                const priceEl = card.querySelector('.price span');

                const titleEl = card.querySelector('.title');
                const linkEl = card.querySelector('a.title');
                const url = linkEl ? (linkEl as any).href : 'N/A';

                return {
                    // cleanup
                    title: titleEl ? (titleEl.getAttribute?.('title') || (titleEl.textContent || '').trim()) : 'N/A',
                    price: priceEl?.textContent?.trim() ?? 'N/A',
                    url: url,
                };
            });
        }
    );
    return evalData;

}


async function main() {
    const rawProducts = await scrapeProducts();
    if (rawProducts.length === 0) {
        console.log('No products were scraped. Aborting database insertion.');
        return;
    }

    const insertableData = rawProducts.map(p => ({
        id: crypto.randomUUID(),
        title: p.title,
        price: p.price,
        url: p.url === 'N/A' ? `N/A-${crypto.randomUUID()}` : p.url,
    }));

    console.log(`\nAttempting to insert ${insertableData.length} new price history records...`);

    try {
        await db.insert(products)
            .values(insertableData);
        console.log("✅ Data insertion successful. New rows added for price history.");
    } catch (error) {
        console.error("\n❌ Database insertion failed:", error);
    }
}

main().catch(console.error);

