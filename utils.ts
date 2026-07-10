import { db } from './src/db.ts';
import { productsToScrape, providerSelectors } from "./src/schema";
import { eq } from "drizzle-orm";
import { builtInProviders } from './src/provider-strategies.ts';

//service.ts maybe 



// try {
//     const activeProducts = db.select().from(productsToScrape).where(eq(productsToScrape.active, true));
//     console.log("Active products to scrape:", activeProducts);
// } catch (error) {
//     console.error("Error while looking actives:", error);
// }





export type Product = {
    url: string;
    provider: string;
    name: string;
    notes?: string;
}

export const addProduct = async (product: Product) => {

    try {
        await db.insert(productsToScrape).values({
            id: crypto.randomUUID(),
            url: product.url,
            provider: product.provider,
            name: product.name,
            notes: product.notes || '',
        });

        console.log("Product added successfully!");
    } catch (error) {
        console.error("Error inserting product:", error);
    }
}

export const getScrapers = async () => {
    try {
        const result = await db.select().from(productsToScrape);
        return result;
    } catch (error) {
        console.error("Error fetching scrapers:", error);
        return [];
    }
}

export const toggleProductActive = async (id: string, active: boolean) => {
    try {
        await db.update(productsToScrape)
            .set({ active })
            .where(eq(productsToScrape.id, id));
        console.log(`Product ${id} active status updated to ${active}`);
    } catch (error) {
        console.error("Error updating product active status:", error);
    }
}


export async function getSelectorsForProvider(provider: string) {
    const result = await db
        .select()
        .from(providerSelectors)
        .where(eq(providerSelectors.provider, provider));
    return result[0];
}

export const getAvailableProviders = async () => {
    try {
        const configuredProviders = await db.select({ provider: providerSelectors.provider }).from(providerSelectors);
        return [...new Set([
            ...builtInProviders,
            ...configuredProviders.map((row) => row.provider),
        ])].sort();
    } catch (error) {
        console.error("Error fetching providers:", error);
        return [...builtInProviders].sort();
    }
}

export type Provider = {
    // id: crypto.randomUUID(),
    priceSelector: string,
    priceSelectorNotInSale?: string,
    titleSelector: string,
    availabilitySelector: string,
    imageSelector: string,
    // updatedAt,
    provider: string,
    notes: string
}


export const addProvider = async (provider: Provider) => {

    try {
        await db.insert(providerSelectors).values({
            id: crypto.randomUUID(),
            priceSelector: provider.priceSelector,
            priceSelectorNotInSale: provider.priceSelectorNotInSale || '',
            titleSelector: provider.titleSelector,
            availabilitySelector: provider.availabilitySelector,
            imageSelector: provider.imageSelector,
            // updatedAt,
            provider: provider.provider,
            notes: provider.notes


        });

        console.log("Provider added successfully!");
    } catch (error) {
        console.error("Error inserting Provider:", error);
    }
}





// const product = { url: "https://www.amazon.com/dp/B0D123EXAMPLE", provider: "amazon", name: "Apple AirPods Pro (2nd Gen)" };
