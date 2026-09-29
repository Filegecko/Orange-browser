exports.handler = async function (event) {

    const params = event.queryStringParameters || {};

    const query = String(params.q || "").trim();

    const category =
        String(params.category || "general").trim();

    const page =
        Math.max(
            1,
            parseInt(params.page || "1", 10)
        );

    if (!query) {

        return {
            statusCode: 400,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                error: "Missing search query"
            })
        };

    }


    /*
       IMPORTANT:
       Replace this with the SearXNG instance
       you are allowed to use.

       This is NOT the public search.anoni.net
       instance that was rate-limiting you.
    */

    const SEARXNG_URL =
        process.env.SEARXNG_URL ||
        "https://YOUR-SEARXNG-DOMAIN/search";


    const allowedCategories = [
        "general",
        "images",
        "videos",
        "news",
        "map",
        "files",
        "social media"
    ];


    const selectedCategory =
        allowedCategories.includes(category)
            ? category
            : "general";


    const url =
        new URL(SEARXNG_URL);


    url.searchParams.set(
        "q",
        query
    );


    url.searchParams.set(
        "format",
        "json"
    );


    url.searchParams.set(
        "pageno",
        String(page)
    );


    url.searchParams.set(
        "categories",
        selectedCategory
    );


    try {

        const response =
            await fetch(
                url.toString(),
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const text =
            await response.text();


        if (!response.ok) {

            return {
                statusCode: response.status,

                headers: {
                    "Content-Type":
                        "application/json",

                    "Access-Control-Allow-Origin":
                        "*"
                },

                body: JSON.stringify({
                    error:
                        "SearXNG returned HTTP " +
                        response.status,

                    details:
                        text.slice(0, 1000)
                })
            };

        }


        let data;

        try {

            data =
                JSON.parse(text);

        } catch {

            return {
                statusCode: 502,

                headers: {
                    "Content-Type":
                        "application/json",

                    "Access-Control-Allow-Origin":
                        "*"
                },

                body: JSON.stringify({
                    error:
                        "SearXNG did not return JSON."
                })
            };

        }


        return {

            statusCode: 200,

            headers: {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*",

                "Cache-Control":
                    "public, max-age=30"
            },

            body:
                JSON.stringify(data)
        };


    } catch (error) {

        return {

            statusCode: 502,

            headers: {

                "Content-Type":
                    "application/json",

                "Access-Control-Allow-Origin":
                    "*"
            },

            body:
                JSON.stringify({

                    error:
                        "Could not reach SearXNG.",

                    details:
                        error.message

                })
        };

    }

};
