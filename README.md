# how-much

Basic price tracker with:

- Typescript
- playwright
- drizzle (sqlite)

To install dependencies:

```bash
bun install
bunx playwright install chromium
```

Playwright needs its browser binaries installed separately from npm packages. Run the command above after a fresh clone or after Playwright is updated.

To run:

```bash
bun run front
```

Open http://localhost:3000.

## Workflow

1. Add a provider only when there is no built-in strategy for it.
2. Add a product with a provider name.
3. Use `/manage` to enable/disable products and run the scraper.
4. Use `/data` to see saved price history.

Provider names must match exactly between products and provider selectors.

## Provider Strategies

Some providers have built-in scraper logic and do not need XPath selectors. `/api/providers` returns the current provider list by combining built-ins from `src/provider-strategies.ts` with providers configured in the database.


Unknown providers need a provider record with XPath selectors. If a product has neither a built-in strategy nor configured selectors, the run marks that item as failed and does not save a fake price.

## Scraper Options

```bash
SCRAPER_DRY_RUN=true bun run scrape.ts
SCRAPER_INCLUDE_INACTIVE=true bun run scrape.ts
SCRAPER_HEADLESS=true bun run scrape.ts
SCRAPER_BLOCKER_WAIT_MS=90000 bun run scrape.ts
SCRAPER_COOKIE_HEADER='datadome=...' bun run scrape.ts
```

`SCRAPER_DRY_RUN=true` verifies scraping without writing price history.

`SCRAPER_INCLUDE_INACTIVE=true` tests all configured products, including disabled ones.

StubHub/DataDome may block automated or DevTools-driven browsers. Blocked scrapes fail cleanly and do not write bad prices.

This project was created using `bun init` in bun v1.3.0. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
