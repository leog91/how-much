import { main } from "../../scrape";

let isRunning = false;
let lastResult: Awaited<ReturnType<typeof main>> | null = null;
let lastError: string | null = null;

export async function runScraperRoute(): Promise<Response> {
    if (isRunning) {
        return new Response(
            JSON.stringify({ error: "Scraper is already running" }),
            { status: 409, headers: { "content-type": "application/json" } }
        );
    }

    // Run scraper asynchronously
    isRunning = true;
    lastError = null;
    main()
        .then((result) => {
            lastResult = result;
            const failedCount = result.filter((item) => item.status === 'failed').length;
            if (failedCount > 0) {
                console.warn(`Scraper completed with ${failedCount} failed item(s)`);
            } else {
                console.log("Scraper completed successfully");
            }
            isRunning = false;
        })
        .catch((err) => {
            console.error("Scraper failed:", err);
            lastError = err instanceof Error ? err.message : String(err);
            isRunning = false;
        });

    return new Response(
        JSON.stringify({ success: true, message: "Scraper started" }),
        { headers: { "content-type": "application/json" } }
    );
}

export async function getScraperStatusRoute(): Promise<Response> {
    return new Response(
        JSON.stringify({ isRunning, lastResult, lastError }),
        { headers: { "content-type": "application/json" } }
    );
}
