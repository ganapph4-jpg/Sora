import express from "express";
import cors from "cors";
import puppeteer from "puppeteer";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(".")); // to serve index.html

app.post("/get-video", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const browser = await puppeteer.launch({
            headless: "new",
            args: ["--no-sandbox"]
        });

        const page = await browser.newPage();
        await page.goto(url, { waitUntil: "networkidle2" });

        // --- wait for button that contains download link ---
        await page.waitForSelector("a[href*='videos.openai.com']", { timeout: 15000 });

        // --- extract real mp4 download URL ---
        const downloadLink = await page.evaluate(() => {
            const link = document.querySelector("a[href*='videos.openai.com']");
            return link ? link.href : null;
        });

        await browser.close();

        if (!downloadLink) {
            return res.status(404).json({ error: "Download link not found" });
        }

        res.json({ download: downloadLink });

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Failed to extract link" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
