const express = require('express');
const path = require('path');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/get-sora-link', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    let browser;
    try {
        browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'networkidle2' });

        await page.waitForSelector('a[href*="videos.openai.com"]', { timeout: 10000 });
        const downloadLink = await page.$eval('a[href*="videos.openai.com"]', el => el.href);

        await browser.close();

        if (!downloadLink) return res.status(404).json({ error: 'Download link not found' });
        res.json({ download_link: downloadLink });
    } catch (err) {
        if (browser) await browser.close();
        console.error(err.message);
        res.status(500).json({ error: 'Failed to retrieve download link' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
