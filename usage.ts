
import { getSelectorsForProvider } from './utils.ts';

const selectors = await getSelectorsForProvider("amazon");


// playwright

// const title = await page.textContent(selectors.titleSelector);
// const price = await page.textContent(selectors.priceSelector);