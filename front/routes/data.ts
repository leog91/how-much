import { db } from "../../src/db";
import { products } from "../../src/schema";

export async function getDataRoute(): Promise<Response> {
    try {
        const rows = await db.select().from(products);
        return new Response(JSON.stringify(rows), {
            headers: { "content-type": "application/json" },
        });
    } catch (err) {
        console.error("Error reading from database:", err);
        return new Response(
            JSON.stringify({ error: "Database error" }),
            { status: 500, headers: { "content-type": "application/json" } }
        );
    }
}