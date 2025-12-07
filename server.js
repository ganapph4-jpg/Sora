const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve index.html
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Helper
const safe = (obj, path) =>
    path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);

// DOMAIN LIST TO TRY
const SORA_DOMAINS = [
    "https://sora.com/p/",
    "https://openai.com/sora/p/"
];

async function fetchSoraPage(id) {
    for (const base of SORA_DOMAINS) {
        const url = base + id;
        try {
            console.log("Trying:", url);
            const response = await axios.get(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "*/*",
                    "Referer": "https://openai.com/"
                },
                validateStatus: () => true
            });

            if (response.status !== 404 && response.data) {
                console.log("SUCCESS:", url);
                return response.data;
            }

        } catch (e) {
            console.log("FAILED:", url);
            continue;
        }
    }
    return null;
}

// DOWNLOAD ROUTE
app.get("/video", async (req, res) => {
    try {
        let id = req.query.id;

        if (!id) return res.status(400).send("Missing ID");

        // extract ID from full link
        if (id.includes("http")) {
            const match = id.match(/s_[A-Za-z0-9]+/);
            if (match) id = match[0];
        }

        if (!id.startsWith("s_")) {
            return res.status(400).send("Invalid Sora ID");
        }

        // FETCH PAGE (TRY MULTIPLE DOMAINS)
        const html = await fetchSoraPage(id);

        if (!html) {
            return res.status(404).send("This Sora link is not publicly accessible.");
        }

        const $ = cheerio.load(html);

        let cleanURL = null;
        let backup = null;

        // <video> tag
        const tag = $("video").attr("src");
        if (tag) backup = tag;

        // JSON script
        const script = $('script[type="application/json"]').html();
        if (script) {
            const json = JSON.parse(script);

            cleanURL = safe(json, "props.pageProps.video.url_no_wm");
            if (!backup) backup = safe(json, "props.pageProps.video.url");
        }

        // pattern fallback
        if (!cleanURL && backup?.includes("/wm/")) {
            cleanURL = backup.replace("/wm/", "/clean/");
        }

        const finalURL = cleanURL || backup;

        if (!finalURL) {
            return res.status(404).send("Unable to extract MP4 URL.");
        }

        console.log("DOWNLOADING:", finalURL);

        const stream = await axios({
            url: finalURL,
            method: "GET",
            responseType: "stream"
        });

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="${id}.mp4"`);

        stream.data.pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).send("Download error.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Downloader online at http://localhost:${PORT}`);
});
