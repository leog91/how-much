import { main } from "../../scrape";

let isRunning = false;

export async function runScraperRoute(): Promise<Response> {
    if (isRunning) {
        return new Response(
            JSON.stringify({ error: "Scraper is already running" }),
            { status: 409, headers: { "content-type": "application/json" } }
        );
    }

    // Run scraper asynchronously
    isRunning = true;
    main()
        .then(() => {
            console.log("Scraper completed successfully");
            isRunning = false;
        })
        .catch((err) => {
            console.error("Scraper failed:", err);
            isRunning = false;
        });

    return new Response(
        JSON.stringify({ success: true, message: "Scraper started" }),
        { headers: { "content-type": "application/json" } }
    );
}

export async function getScraperStatusRoute(): Promise<Response> {
    return new Response(
        JSON.stringify({ isRunning }),
        { headers: { "content-type": "application/json" } }
    );
}
