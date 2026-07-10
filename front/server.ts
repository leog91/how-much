import { serve } from "bun";
import { readFileSync } from "fs";
import { addProduct, addProvider, getAvailableProviders, type Product, type Provider } from "../utils";
import { getDataRoute } from "./routes/data";
import { getScrapersRoute, toggleScraperRoute } from "./routes/scrapers";
import { runScraperRoute, getScraperStatusRoute } from "./routes/run-scraper";

const HTML: string = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const HTML_PROVIDER: string = readFileSync(new URL("./provider.html", import.meta.url), "utf8");
const HTML_DATA: string = readFileSync(new URL("./data.html", import.meta.url), "utf8");
const HTML_MANAGE: string = readFileSync(new URL("./manage.html", import.meta.url), "utf8");



serve({
    port: 3000,
    fetch(req: Request): Response | Promise<Response> {
        const url = new URL(req.url);

        // Serve static pages
        if (url.pathname === "/" && req.method === "GET") {
            return new Response(HTML, {
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        }

        if (url.pathname === "/provider" && req.method === "GET") {
            return new Response(HTML_PROVIDER, {
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        }

        if (url.pathname === "/data" && req.method === "GET")
            return new Response(HTML_DATA, { headers: { "content-type": "text/html; charset=utf-8" } });

        if (url.pathname === "/manage" && req.method === "GET")
            return new Response(HTML_MANAGE, { headers: { "content-type": "text/html; charset=utf-8" } });



        if (url.pathname === "/api/data" && req.method === "GET") {
            return getDataRoute();
        }

        if (url.pathname === "/api/scrapers" && req.method === "GET") {
            return getScrapersRoute();
        }

        if (url.pathname === "/api/toggle-scraper" && req.method === "POST") {
            return toggleScraperRoute(req);
        }

        if (url.pathname === "/api/run-scraper" && req.method === "POST") {
            return runScraperRoute();
        }

        if (url.pathname === "/api/scraper-status" && req.method === "GET") {
            return getScraperStatusRoute();
        }

        if (url.pathname === "/api/providers" && req.method === "GET") {
            return (async (): Promise<Response> => {
                const providers = await getAvailableProviders();
                return new Response(JSON.stringify(providers), {
                    headers: { "content-type": "application/json" },
                });
            })();
        }



        // Handle /submit
        if (url.pathname === "/submit" && req.method === "POST") {
            return (async (): Promise<Response> => {
                try {
                    const data = (await req.json()) as Record<string, unknown>;
                    console.log("Form submitted:", data);

                    const product: Product = {
                        url: typeof data.url === "string" ? data.url : "",
                        provider: typeof data.provider === "string" ? data.provider : "",
                        name: typeof data.name === "string" ? data.name : "",
                        notes: typeof data.notes === "string" ? data.notes : "",
                    };

                    if (!product.url || !product.provider || !product.name) {
                        return new Response(JSON.stringify({ error: "Missing required product fields" }), {
                            status: 400,
                            headers: { "content-type": "application/json" },
                        });
                    }

                    console.log("Adding product to scrape:", product);
                    await addProduct(product);

                    return new Response(JSON.stringify({ success: true, message: "Product added" }), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    });
                } catch (err) {
                    console.error("Error parsing request body:", err);
                    return new Response("Bad request", { status: 400 });
                }
            })();
        }

        // Handle /submit_provider
        if (url.pathname === "/submit_provider" && req.method === "POST") {
            return (async (): Promise<Response> => {
                try {
                    const data = (await req.json()) as Record<string, unknown>;
                    console.log("Provider submitted:", data);


                    //validation
                    // add zod later
                    const provider: Provider = {
                        provider:
                            typeof data.provider_name === "string" ? data.provider_name : "",
                        priceSelector:
                            typeof data.priceSelector === "string" ? data.priceSelector : "",
                        priceSelectorNotInSale:
                            typeof data.priceSelectorNotInSale === "string"
                                ? data.priceSelectorNotInSale
                                : "",
                        titleSelector:
                            typeof data.titleSelector === "string" ? data.titleSelector : "",
                        availabilitySelector:
                            typeof data.availabilitySelector === "string"
                                ? data.availabilitySelector
                                : "",
                        imageSelector:
                            typeof data.imageSelector === "string"
                                ? data.imageSelector
                                : "",
                        notes: typeof data.notes === "string" ? data.notes : "",
                    };

                    if (!provider.provider || !provider.priceSelector) {
                        return new Response(JSON.stringify({ error: "Missing required provider fields" }), {
                            status: 400,
                            headers: { "content-type": "application/json" },
                        });
                    }

                    await addProvider(provider);
                    return new Response(JSON.stringify({ success: true, message: "Provider added" }), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    });
                } catch (err) {
                    console.error("Error parsing request body:", err);
                    return new Response("Bad request", { status: 400 });
                }
            })();
        }

        // Fallback 404
        return new Response("Not found", { status: 404 });
    },
});

console.log("Bun server running on http://localhost:3000");
