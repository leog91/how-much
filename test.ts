import chalk from "chalk";
import { main } from "./scrape";



// const test = await scrapeProducts()

const test = await main()



console.log('Scraped Products:', JSON.stringify(test), null, 2);


