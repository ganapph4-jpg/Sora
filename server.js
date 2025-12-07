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

// Safe JSON reader
const safe = (obj, path) =>
    path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);

// Downloader Route
app.get("/video", async (req, res) => {
    try {
        let id = req.query.id;

        if (!id) return res.status(400).send("No Sora ID provided.");

        // Extract ID from full link
        if (id.includes("http")) {
            const m = id.match(/s_[A-Za-z0-9]+/);
            if (m) id = m[0];
        }

        if (!id.startsWith("s_")) {
            return res.status(400).send("Invalid Sora ID.");
        }

        const soraURL = `https://sora.chatgpt.com/p/${id}`;
        console.log("Fetching:", soraURL);

        // Cloudflare bypass headers
        const page = await axios.get(soraURL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
                "Accept": "*/*",
                "Referer": "https://sora.chatgpt.com/"
            }
        });

        const html = page.data;
        const $ = cheerio.load(html);

        let cleanURL = null;
        let backup = null;

        // Method 1 – video tag
        const tagURL = $("video").attr("src");
        if (tagURL) backup = tagURL;

        // Method 2 – JSON script
        const script = $('script[type="application/json"]').html();
        if (script) {
            const json = JSON.parse(script);

            cleanURL = safe(json, "props.pageProps.video.url_no_wm");
            if (!backup) {
                backup = safe(json, "props.pageProps.video.url");
            }
        }

        // Auto-clean URL pattern
        if (!cleanURL && backup && backup.includes("/wm/")) {
            cleanURL = backup.replace("/wm/", "/clean/");
        }

        const finalURL = cleanURL || backup;

        if (!finalURL) return res.status(404).send("Cannot find clean MP4.");

        console.log("Downloading:", finalURL);

        const stream = await axios({
            url: finalURL,
            method: "GET",
            responseType: "stream"
        });

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${id}.mp4"`
        );

        stream.data.pipe(res);

    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to download video.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Sora Downloader running at http://localhost:${PORT}`);
});
