const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Serve website UI
app.use(express.static(path.join(__dirname, "public")));

const safe = (obj, path) =>
    path.split(".").reduce((o, k) => (o && o[k] !== undefined ? o[k] : null), obj);

app.get("/video", async (req, res) => {
    try {
        let id = req.query.id;
        if (!id) return res.status(400).send("Missing ID");

        // Extract ID from full link
        if (id.includes("http")) {
            const match = id.match(/s_[A-Za-z0-9]+/);
            if (match) id = match[0];
        }

        if (!id.startsWith("s_")) {
            return res.status(400).send("Invalid Sora ID");
        }

        const soraURL = `https://sora.chatgpt.com/p/${id}`;
        console.log("Fetching:", soraURL);

        const page = await axios.get(soraURL, {
            headers: {
                "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
                "Accept": "*/*",
                "Referer": "https://sora.chatgpt.com/",
            }
        });

        const html = page.data;
        const $ = cheerio.load(html);

        let mp4 = null;
        let backup = null;

        // Method 1
        const tag = $("video").attr("src");
        if (tag) backup = tag;

        // Method 2
        const jsonTag = $('script[type="application/json"]').html();
        if (jsonTag) {
            const json = JSON.parse(jsonTag);
            mp4 = safe(json, "props.pageProps.video.url_no_wm");
            if (!backup) backup = safe(json, "props.pageProps.video.url");
        }

        // Method 3 (pattern)
        if (!mp4 && backup && backup.includes("/wm/")) {
            mp4 = backup.replace("/wm/", "/clean/");
        }

        const finalURL = mp4 || backup;

        if (!finalURL) return res.status(404).send("No video found.");

        console.log("Downloading from:", finalURL);

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
        res.status(500).send("Error downloading video");
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Running at http://localhost:${PORT}`);
});
