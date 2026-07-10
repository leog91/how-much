import chalk from 'chalk';

export const builtInProviders = [
    'amazon.ie',
    'viltrox.com',
    'steam',
    'zalando.ie',
    'ticketone',
    'monzagpf1',
] as const;

export async function scrapeWithHttpStrategy(provider: string, url: string): Promise<string | null> {
    if (provider === 'amazon.ie') {
        return scrapeAmazonPrice(url);
    }

    if (provider === 'viltrox.com') {
        return scrapeViltroxPrice(url);
    }

    if (provider === 'steam') {
        return scrapeSteamPrice(url);
    }

    return null;
}

export function isTicketOneProvider(provider: string) {
    const normalized = provider.toLowerCase();
    return normalized.includes('ticketone') || normalized.includes('monzagpf1');
}

export function isZalandoProvider(provider: string) {
    return provider.toLowerCase().includes('zalando');
}

export function parseZalandoPrice(name: string, bodyText: string): string | null {
    const normalizedName = normalizeText(name);
    const nameWithoutFirstWord = normalizedName.split(' ').slice(1).join(' ');
    const nameFragments = [
        normalizedName.slice(0, 20),
        nameWithoutFirstWord.slice(0, 20),
    ].filter((fragment) => fragment.length >= 8);
    const lines = bodyText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const recommendationIndex = lines.findIndex((line) => /Complete the look|Variations of this style|More from/i.test(line));
    const productLines = recommendationIndex >= 0 ? lines.slice(0, recommendationIndex) : lines.slice(0, 80);

    for (let i = 0; i < productLines.length; i++) {
        const normalizedLine = normalizeText(productLines[i] || '');
        if (normalizedLine.length < 8) continue;
        if (!normalizedName.includes(normalizedLine) && !nameFragments.some((fragment) => normalizedLine.includes(fragment))) continue;

        const followingText = productLines.slice(i, i + 8).join(' ');
        const currentPrice = followingText.match(/€\s*[0-9]+(?:[.,][0-9]{2})?/i)?.[0];
        if (currentPrice) return currentPrice.replace(/\s+/g, ' ').trim();
    }

    return null;
}

export function parseTicketOnePrice(name: string, bodyText: string): string | null {
    const normalizedName = name.toLowerCase();
    const lines = bodyText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);

    const target: 'sunday' | 'weekend' | 'any' = normalizedName.includes('sun') || normalizedName.includes('sunday')
        ? 'sunday'
        : normalizedName.includes('weekend') || normalizedName.includes('3 day') || normalizedName.includes('3-day') || normalizedName.includes('abbo')
            ? 'weekend'
            : 'any';

    const rows = splitTicketOneRows(lines);
    const candidates = rows.filter((row) => {
        const text = row.join(' ').toLowerCase();

        if (target === 'sunday') {
            return /\bsun\b|sunday/.test(text) || text.includes('06 sept 2026');
        }

        if (target === 'weekend') {
            return text.includes('abbo') || text.includes('3 giorni') || text.includes('3 events') || text.includes('04/09/2026 to 06/09/2026');
        }

        return /from\s*€/.test(text);
    });

    for (const candidate of candidates) {
        const text = candidate.join(' ');
        if (/not available/i.test(text)) continue;

        const price = text.match(/(?:from\s*)?(€\s*[0-9]+(?:[.,][0-9]{2})?)/i)?.[1];
        if (price) return price.replace(/\s+/g, ' ').trim();
    }

    return null;
}

function splitTicketOneRows(lines: string[]) {
    const rows: string[][] = [];
    let current: string[] = [];

    for (const line of lines) {
        if (isTicketOneRowStart(line) && current.length) {
            rows.push(current);
            current = [];
        }

        current.push(line);
    }

    if (current.length) rows.push(current);
    return rows;
}

function isTicketOneRowStart(line: string) {
    return /^(0[4-6]|04\/09\/2026|05\/09\/2026|06\/09\/2026)$/.test(line.trim());
}

async function scrapeAmazonPrice(url: string): Promise<string | null> {
    const html = await fetchHtml(url);
    if (!html) return null;

    const displayString = html.match(/customerVisiblePrice\]\[displayString\]" value="([^"]+)"/i)?.[1];
    if (displayString) return decodeHtml(displayString);

    const offscreenPrice = html.match(/<span class="a-offscreen">\s*([^<]*[€$£][^<]*)<\/span>/i)?.[1];
    return offscreenPrice?.trim() || null;
}

async function scrapeViltroxPrice(url: string): Promise<string | null> {
    const html = await fetchHtml(url);
    if (!html) return null;

    const metaAmount = html.match(/property="product:price:amount" content="([^"]+)"/i)?.[1];
    const metaCurrency = html.match(/property="product:price:currency" content="([^"]+)"/i)?.[1];
    if (metaAmount && metaCurrency) return formatCurrency(metaAmount, metaCurrency);

    const jsonPrice = html.match(/"price":\{"amount":([0-9.]+),"currencyCode":"([A-Z]+)"\}/i);
    if (jsonPrice?.[1] && jsonPrice[2]) return formatCurrency(jsonPrice[1], jsonPrice[2]);

    return null;
}

async function scrapeSteamPrice(url: string): Promise<string | null> {
    const appId = url.match(/\/app\/(\d+)/)?.[1];
    if (!appId) return null;

    const apiUrl = `https://store.steampowered.com/api/appdetails?appids=${appId}&cc=IE&l=en`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(apiUrl, { signal: controller.signal });
        if (!response.ok) return null;

        const data = await response.json() as Record<string, { success?: boolean; data?: { is_free?: boolean; price_overview?: { final_formatted?: string } } }>;
        const app = data[appId];
        if (!app?.success) return null;
        if (app.data?.is_free) return 'Free';

        return app.data?.price_overview?.final_formatted || null;
    } catch (error) {
        console.warn(chalk.yellow(`Steam API failed: ${error instanceof Error ? error.message : String(error)}`));
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

async function fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'accept-language': 'en-US,en;q=0.9',
            },
        });

        if (!response.ok) {
            console.warn(chalk.yellow(`HTTP scrape returned ${response.status} for ${url}`));
            return null;
        }

        return response.text();
    } catch (error) {
        console.warn(chalk.yellow(`HTTP scrape failed: ${error instanceof Error ? error.message : String(error)}`));
        return null;
    } finally {
        clearTimeout(timeout);
    }
}

function formatCurrency(amount: string, currency: string) {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value)) return `${amount} ${currency}`;

    return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency,
    }).format(value);
}

function decodeHtml(value: string) {
    return value
        .replace(/&euro;/gi, '€')
        .replace(/&pound;/gi, '£')
        .replace(/&amp;/gi, '&')
        .replace(/&quot;/gi, '"')
        .trim();
}

function normalizeText(value: string) {
    return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
