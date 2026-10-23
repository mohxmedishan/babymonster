function decodeEntities(value = "") {
  return String(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}
function tagValue(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}
export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  const feeds = [
    "https://news.google.com/rss/search?q=BABYMONSTER+when:7d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=BABYMONSTER+YG+Entertainment&hl=en-US&gl=US&ceid=US:en"
  ];
  try {
    const items = [];
    for (const url of feeds) {
      const response = await fetch(url, { signal: AbortSignal.timeout(9000), headers: { "User-Agent": "BABYMONSTER.HUB/1.0" } });
      if (!response.ok) continue;
      const xml = await response.text();
      const chunks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      for (const item of chunks) {
        const title = tagValue(item, "title");
        const link = tagValue(item, "link");
        const dateRaw = tagValue(item, "pubDate");
        const parsed = Date.parse(dateRaw);
        const sourceMatch = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
        const description = tagValue(item, "description").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (!title || !link) continue;
        items.push({
          title,
          link,
          date: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "",
          pubDate: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "",
          author: sourceMatch ? decodeEntities(sourceMatch[1]).trim() : "Google News",
          description: description || "Latest coverage and updates about BABYMONSTER."
        });
      }
    }
    const unique = new Map();
    for (const item of items) if (!unique.has(item.link)) unique.set(item.link, item);
    return res.status(200).json({ status: "ok", items: [...unique.values()].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0)) });
  } catch (error) {
    console.error("News RSS fetch failed", error);
    return res.status(502).json({ status: "error", error: "Failed to fetch Google News RSS" });
  }
}
