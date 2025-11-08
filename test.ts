import chalk from "chalk";
import { main, testLastAdded } from "./scrape";





const test = await main()

// const test = await testLastAdded();

console.log('Scraped Products:', test);


