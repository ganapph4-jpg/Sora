const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the UI
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

// Safely read nested JSON values
const safe = (obj, path) =>
    path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);

// Download route
app.get("/video", async (req, res) => {
    try {
        let id = req.query.id;

        if (!id) return res.status(400).send("Missing ID");

        // Extract ID from full URL
        if (id.includes("http")) {
            const m = id.match(/s_[A-Za-z0-9]+/);
            if (m) id = m[0];
        }

        if (!id.startsWith("s_")) {
            return res.status(400).send("Invalid Sora ID.");
        }

        const soraURL = `https://sora.chatgpt.com/p/${id}`;
        console.log("Fetching:", soraURL);

        const page = await axios.get(soraURL, {
            headers: {
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
                "Referer": "https://sora.chatgpt.com/"
            }
        });

        const html = page.data;
        const $ = cheerio.load(html);

        let cleanURL = null;
        let backup = null;

        // method 1: <video src="">
        const tag = $("video").attr("src");
        if (tag) backup = tag;

        // method 2: JSON script
        const script = $('script[type="application/json"]').html();
        if (script) {
            const json = JSON.parse(script);
            cleanURL = safe(json, "props.pageProps.video.url_no_wm");
            if (!backup) backup = safe(json, "props.pageProps.video.url");
        }

        // method 3: replace wm with clean
        if (!cleanURL && backup?.includes("/wm/")) {
            cleanURL = backup.replace("/wm/", "/clean/");
        }

        const finalURL = cleanURL || backup;

        if (!finalURL) return res.status(404).send("No video found.");

        console.log("Downloading:", finalURL);

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
        res.status(500).send("Error downloading video.");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Running at http://localhost:${PORT}`);
});
