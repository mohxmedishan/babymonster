export default async function handler(req, res) {
    try {
        const targetRssUrl = 'https://news.google.com/rss/search?q=BABYMONSTER+kpop&hl=en-US&gl=US&ceid=US:en';
        const response = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(targetRssUrl)}`);
        const data = await response.json();

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch news' });
    }
}
