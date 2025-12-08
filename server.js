const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'))); // serve frontend

// Endpoint to grab Sora download link
app.post('/get-sora-link', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'No URL provided' });

    try {
        const response = await axios.get('https://sorai.me/', {
            params: { url },
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });

        const $ = cheerio.load(response.data);

        // Adjust this selector if sorai.me changes
        const downloadLink = $('a#download-link').attr('href');

        if (!downloadLink) return res.status(404).json({ error: 'Download link not found' });

        res.json({ download_link: downloadLink });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: 'Failed to fetch download link' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
