exports.handler = async function (event) {

    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET, OPTIONS"
    };


    /* =====================================================
       CORS PREFLIGHT
    ===================================================== */

    if (event.httpMethod === "OPTIONS") {

        return {
            statusCode: 204,
            headers,
            body: ""
        };

    }


    /* =====================================================
       ONLY GET IS USED
    ===================================================== */

    if (
        event.httpMethod &&
        event.httpMethod !== "GET"
    ) {

        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: "Method not allowed"
            })
        };

    }


    /* =====================================================
       PARAMETERS
    ===================================================== */

    const params =
        event.queryStringParameters || {};


    const query =
        String(params.q || "").trim();


    const category =
        String(
            params.category || "general"
        )
        .trim()
        .toLowerCase();


    const page =
        Math.max(
            1,
            parseInt(
                params.page || "1",
                10
            ) || 1
        );


    if (!query) {

        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                error: "Missing search query"
            })
        };

    }


    /* =====================================================
       SEARXNG URL
       
       IMPORTANT:
       Set SEARXNG_URL in Netlify environment variables.

       Example value:

       https://your-render-service.onrender.com

       The code automatically adds /search.
    ===================================================== */

    let baseURL =
        process.env.SEARXNG_URL;


    if (!baseURL) {

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error:
                    "SEARXNG_URL is not configured in Netlify."
            })
        };

    }


    baseURL =
        String(baseURL)
        .trim()
        .replace(/\/+$/, "");


    /*
       Allow either:

       https://example.onrender.com

       OR

       https://example.onrender.com/search
    */

    if (
        !baseURL.endsWith("/search")
    ) {

        baseURL += "/search";

    }


    /* =====================================================
       CATEGORY MAPPING
       
       SearXNG does not necessarily have every frontend
       category. Unsupported categories are mapped safely
       to general rather than breaking the request.
    ===================================================== */

    const categoryMap = {

        general: "general",

        images: "images",

        videos: "videos",

        news: "news",

        map: "map",

        books: "general",

        forums: "general",

        files: "files",

        "social media": "social media"

    };


    const selectedCategory =
        categoryMap[category] ||
        "general";


    /* =====================================================
       BUILD SEARXNG REQUEST
    ===================================================== */

    let searchURL;


    try {

        searchURL =
            new URL(baseURL);

    } catch (error) {

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error:
                    "Invalid SEARXNG_URL.",
                details:
                    String(
                        process.env.SEARXNG_URL || ""
                    )
            })
        };

    }


    searchURL.searchParams.set(
        "q",
        query
    );


    searchURL.searchParams.set(
        "format",
        "json"
    );


    searchURL.searchParams.set(
        "pageno",
        String(page)
    );


    searchURL.searchParams.set(
        "categories",
        selectedCategory
    );


    /* =====================================================
       REQUEST TIMEOUT
    ===================================================== */

    const controller =
        new AbortController();


    const timeout =
        setTimeout(
            () => controller.abort(),
            25000
        );


    let response;


    try {

        response =
            await fetch(
                searchURL.toString(),
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json",

                        "User-Agent":
                            "OrangeBrowse/1.0"
                    },

                    signal:
                        controller.signal
                }
            );

    } catch (error) {

        clearTimeout(timeout);


        const message =
            error &&
            error.name === "AbortError"

            ? "SearXNG request timed out after 25 seconds."

            : (
                error &&
                error.message
            )
            ||
            "Unknown network error";


        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({

                error:
                    "Netlify could not connect to SearXNG.",

                details:
                    message,

                searxng:
                    baseURL

            })
        };

    }


    clearTimeout(timeout);


    /* =====================================================
       READ RESPONSE
    ===================================================== */

    let text;


    try {

        text =
            await response.text();

    } catch (error) {

        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({

                error:
                    "Could not read SearXNG response.",

                details:
                    error.message

            })
        };

    }


    /* =====================================================
       SEARXNG HTTP ERROR
    ===================================================== */

    if (!response.ok) {

        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({

                error:
                    "SearXNG returned HTTP " +
                    response.status,

                details:
                    text.slice(0, 1500),

                searxng:
                    baseURL

            })
        };

    }


    /* =====================================================
       PARSE JSON
    ===================================================== */

    let data;


    try {

        data =
            JSON.parse(text);

    } catch (error) {

        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({

                error:
                    "SearXNG did not return valid JSON.",

                details:
                    text.slice(0, 1000),

                searxng:
                    baseURL

            })
        };

    }


    /* =====================================================
       NORMALIZE RESULTS
       
       Keep SearXNG's original result fields so the
       OrangeBrowse frontend can use:
       title, url, content, img_src, thumbnail_src, etc.
    ===================================================== */

    if (
        !data ||
        typeof data !== "object"
    ) {

        return {
            statusCode: 502,
            headers,
            body: JSON.stringify({

                error:
                    "Invalid SearXNG response."

            })
        };

    }


    if (
        !Array.isArray(data.results)
    ) {

        data.results = [];

    }


    /* =====================================================
       RETURN RESULTS
    ===================================================== */

    return {

        statusCode: 200,

        headers: {

            ...headers,

            "Cache-Control":
                "public, max-age=30"

        },

        body:
            JSON.stringify(data)

    };

};
