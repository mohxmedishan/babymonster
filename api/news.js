export default async function handler(req, res) {
    try {
        const targetRssUrl = 'https://news.google.com/rss/search?q=BABYMONSTER+kpop&hl=en-US&gl=US&ceid=US:en';
        const response = await fetch(targetRssUrl);
        const xmlText = await response.text();

        // Simple lightweight regex XML parser for Vercel serverless environment
        const items = [];
        const itemMatches = xmlText.match(/<item>([\s\S]*?)<\/item>/g) || [];

        for (const itemStr of itemMatches) {
            const titleMatch = itemStr.match(/<title>([\s\S]*?)<\/title>/);
            const linkMatch = itemStr.match(/<link>([\s\S]*?)<\/link>/);
            const dateMatch = itemStr.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
            const sourceMatch = itemStr.match(/<source[^>]*>([\s\S]*?)<\/source>/);

            if (titleMatch && linkMatch) {
                // Clean up CDATA and HTML entities if present
                const cleanTitle = titleMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
                const cleanLink = linkMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim();
                const pubDate = dateMatch ? new Date(dateMatch[1]).toLocaleDateString() : 'Recent';
                const source = sourceMatch ? sourceMatch[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1') : 'Google News';

                items.push({
                    title: cleanTitle,
                    link: cleanLink,
                    pubDate: pubDate,
                    author: source,
                    description: "Latest updates and coverage regarding BABYMONSTER."
                });
            }
        }

        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json({ status: 'ok', items });
    } catch (error) {
        return res.status(500).json({ error: 'Failed to fetch RSS feed' });
    }
}
