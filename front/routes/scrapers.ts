import { getScrapers, toggleProductActive } from "../../utils";

export async function getScrapersRoute(): Promise<Response> {
    try {
        const scrapers = await getScrapers();
        return new Response(JSON.stringify(scrapers), {
            headers: { "content-type": "application/json" },
        });
    } catch (err) {
        console.error("Error reading scrapers from database:", err);
        return new Response(
            JSON.stringify({ error: "Database error" }),
            { status: 500, headers: { "content-type": "application/json" } }
        );
    }
}

export async function toggleScraperRoute(req: Request): Promise<Response> {
    try {
        const { id, active } = (await req.json()) as { id: string; active: boolean };
        if (!id || typeof active !== "boolean") {
            return new Response(JSON.stringify({ error: "Invalid data" }), {
                status: 400,
                headers: { "content-type": "application/json" },
            });
        }
        await toggleProductActive(id, active);
        return new Response(JSON.stringify({ success: true }), {
            headers: { "content-type": "application/json" },
        });
    } catch (err) {
        console.error("Error toggling scraper:", err);
        return new Response(
            JSON.stringify({ error: "Database error" }),
            { status: 500, headers: { "content-type": "application/json" } }
        );
    }
}
