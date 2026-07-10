
import { eq, sql } from 'drizzle-orm';
import { db } from './src/db.ts';
import { products, productsToScrape, providerSelectors } from './src/schema.ts';


import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { chromium, type BrowserContext, type Page } from 'playwright';
import chalk from 'chalk';
import {
    isTicketOneProvider,
    isZalandoProvider,
    parseTicketOnePrice,
    parseZalandoPrice,
    scrapeWithHttpStrategy,
} from './src/provider-strategies.ts';

const isHeadless = process.env.SCRAPER_HEADLESS === 'true';
const blockerWaitMs = Number(process.env.SCRAPER_BLOCKER_WAIT_MS || 45000);
const cookieHeader = process.env.SCRAPER_COOKIE_HEADER;
const isDryRun = process.env.SCRAPER_DRY_RUN === 'true';
const includeInactive = process.env.SCRAPER_INCLUDE_INACTIVE === 'true';


interface Product {
    title: string;
    price: string;
    url: string;
}

type ScrapeSummary = {
    name: string;
    price: string | null;
    status: 'success' | 'failed';
}

type ScraperBrowser = {
    context: BrowserContext;
    page: Page;
    close: () => Promise<void>;
}

type ScraperRuntime = {
    browser?: ScraperBrowser;
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
    const runtime: ScraperRuntime = {};

    const scrappedSummary: ScrapeSummary[] = [];

    try {
        if (!products.length) {
            console.log(chalk.yellow('No active products to scrape.'));
            return scrappedSummary;
        }

        for (const product of products) {
            const scrapedProductPrice = await scrapeProduct(product, runtime);

            if (!scrapedProductPrice) {
                scrappedSummary.push({
                    name: product.products_to_scrape.name,
                    price: null,
                    status: 'failed',
                });
                continue;
            }

            console.log(chalk.magenta(`Scraped price for ${product.products_to_scrape.name}: ${scrapedProductPrice}`));

            if (isDryRun) {
                console.log(chalk.gray(`Dry run: not saving ${product.products_to_scrape.name}`));
            } else {
                await saveToDB({
                    title: product.products_to_scrape.name,
                    price: scrapedProductPrice,
                    url: product.products_to_scrape.url,
                });
            }

            scrappedSummary.push({
                name: product.products_to_scrape.name,
                price: scrapedProductPrice,
                status: 'success',
            });
        }
    } finally {
        await runtime.browser?.close();
    }

    console.log(chalk.greenBright('Scraping completed.'));
    return scrappedSummary;
}



export async function testLastAdded() {


    const runtime: ScraperRuntime = {};

    const result = await db.select()
        .from(productsToScrape)
        .orderBy(sql`${productsToScrape.dateAdded} COLLATE NOCASE desc`)
        .limit(1)
        .leftJoin(providerSelectors, eq(productsToScrape.provider, providerSelectors.provider))
        .where(eq(productsToScrape.active, true))


    const scrapedProductPrice = await scrapeProduct(result[0]!, runtime);

    console.log(chalk.magenta(`Scraped price for ${result[0]!.products_to_scrape.name}: ${scrapedProductPrice}`));

    await runtime.browser?.close();

}



async function createScraperBrowser(): Promise<ScraperBrowser> {
    if (process.env.SCRAPER_CDP_URL) {
        const browser = await chromium.connectOverCDP(process.env.SCRAPER_CDP_URL);
        const context = browser.contexts()[0] || await browser.newContext();
        const page = await context.newPage();

        console.log(chalk.gray(`Connected to existing Chrome: ${process.env.SCRAPER_CDP_URL}`));

        return {
            context,
            page,
            close: async () => {
                await page.close().catch(() => undefined);
            },
        };
    }

    const configuredUserDataDir = process.env.SCRAPER_USER_DATA_DIR;
    const userDataDir = configuredUserDataDir || await mkdtemp(join(tmpdir(), 'how-much-scraper-'));

    console.log(chalk.gray(`Launching ${process.env.SCRAPER_BROWSER_CHANNEL || 'chrome'} with ${configuredUserDataDir ? 'configured' : 'fresh'} profile: ${userDataDir}`));

    const context = await chromium.launchPersistentContext(userDataDir, {
        channel: process.env.SCRAPER_BROWSER_CHANNEL || 'chrome',
        headless: isHeadless,
        ignoreDefaultArgs: ['--enable-automation'],
        args: [
            '--disable-blink-features=AutomationControlled',
            '--no-first-run',
            '--no-default-browser-check',
        ],
        locale: 'en-US',
        timezoneId: 'Europe/Dublin',
        viewport: { width: 1365, height: 900 },
        extraHTTPHeaders: {
            'Accept-Language': 'en-US,en;q=0.9',
        },
    });

    await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
        });
    });

    const page = context.pages()[0] || await context.newPage();

    return {
        context,
        page,
        close: async () => {
            await context.close();
            if (!configuredUserDataDir) {
                await rm(userDataDir, { recursive: true, force: true });
            }
        },
    };
}



async function getProductsFromDb() {

    if (includeInactive) {
        return db.select().from(productsToScrape).leftJoin(providerSelectors, eq(productsToScrape.provider, providerSelectors.provider));
    }

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



async function scrapeProduct(productToScrapeFull: ProductToScrapeFull, runtime: ScraperRuntime): Promise<string | null> {
    const url = productToScrapeFull.products_to_scrape.url;
    const provider = productToScrapeFull.products_to_scrape.provider;
    console.log(`Navigating to ${url}...`);

    const httpPrice = await scrapeWithHttpStrategy(provider, url);
    if (httpPrice) return httpPrice;

    const supportsBrowserTextStrategy = isTicketOneProvider(provider) || isZalandoProvider(provider);

    if (!productToScrapeFull.provider_selectors && !supportsBrowserTextStrategy) {
        console.error(chalk.red(`No selectors configured for provider ${productToScrapeFull.products_to_scrape.provider}`));
        return null;
    }

    try {
        runtime.browser ??= await createScraperBrowser();
        const page = runtime.browser.page;

        await applyCookieHeader(page.context(), url);

        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        if (supportsBrowserTextStrategy) {
            await page.waitForFunction("/€\\s*\\d/.test(document.body?.innerText || '')", undefined, { timeout: 8000 }).catch(() => undefined);
        } else {
            await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => undefined);
        }

        const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
        if (!isHeadless && blockerWaitMs > 0 && (response?.status() === 403 || !bodyText.trim())) {
            console.warn(chalk.yellow(`Page may be blocked for ${productToScrapeFull.products_to_scrape.name}. Waiting ${blockerWaitMs / 1000}s for manual browser access...`));
            await page.waitForTimeout(blockerWaitMs);
            await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => undefined);
        }

        if (await isBlockedByDataDome(page, response?.status())) {
            console.error(chalk.red(`Blocked by StubHub/DataDome for ${productToScrapeFull.products_to_scrape.name}. Try running with SCRAPER_COOKIE_HEADER from a normal Chrome session.`));
            return null;
        }

        const currentBodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');
        if (isTicketOneProvider(provider)) {
            const ticketOnePrice = parseTicketOnePrice(productToScrapeFull.products_to_scrape.name, currentBodyText);
            if (ticketOnePrice) return ticketOnePrice;

            console.error(chalk.red(`No available TicketOne price found for ${productToScrapeFull.products_to_scrape.name}`));
            return null;
        }

        if (isZalandoProvider(provider)) {
            const zalandoPrice = parseZalandoPrice(productToScrapeFull.products_to_scrape.name, currentBodyText);
            if (zalandoPrice) return zalandoPrice;

            console.error(chalk.red(`No Zalando text price found for ${productToScrapeFull.products_to_scrape.name}`));
            return null;
        }

        if (!productToScrapeFull.provider_selectors) {
            console.error(chalk.red(`No selectors configured for provider ${productToScrapeFull.products_to_scrape.provider}`));
            return null;
        }

        const selectors = [
            productToScrapeFull.provider_selectors?.priceSelector,
            productToScrapeFull.provider_selectors?.priceSelectorNotInSale,
        ];

        let content: string | null = null;

        for (const selector of selectors) {
            if (!selector) continue;
            try {
                const locator = page.locator(`xpath=${selector}`).first();
                await locator.waitFor({ timeout: 3000 });
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

        return content?.trim() || null;
    } catch (error) {
        console.error(chalk.red(`Error scraping ${url}:`), error);
        return null;
    }
}



async function applyCookieHeader(context: BrowserContext, url: string) {
    if (!cookieHeader) return;

    const cookies = cookieHeader
        .split(';')
        .map((cookie) => cookie.trim())
        .filter(Boolean)
        .flatMap((cookie) => {
            const [name, ...valueParts] = cookie.split('=');
            const value = valueParts.join('=');
            if (!name || !value) return [];

            return {
                name,
                value,
                url,
            };
        });

    if (cookies.length) {
        await context.addCookies(cookies);
        console.log(chalk.gray(`Applied ${cookies.length} cookie(s) from SCRAPER_COOKIE_HEADER.`));
    }
}



async function isBlockedByDataDome(page: Page, status?: number) {
    const hasDataDomeFrame = page.frames().some((frame) => frame.url().includes('captcha-delivery.com'));
    const title = await page.title().catch(() => '');
    const bodyText = await page.locator('body').innerText({ timeout: 5000 }).catch(() => '');

    return status === 403 || hasDataDomeFrame || title === 'stubhub.com' && !bodyText.trim();
}

// Only run if this file is executed directly (not imported)
if (import.meta.main) {
    await main();
}
