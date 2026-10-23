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
  res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
  const feeds = [
    "https://news.google.com/rss/search?q=BABYMONSTER+when:7d&hl=en-US&gl=US&ceid=US:en",
    "https://news.google.com/rss/search?q=BABYMONSTER+YG+Entertainment&hl=en-US&gl=US&ceid=US:en"
  ];
  const items = [];
  const feedErrors = [];
  for (const url of feeds) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Mozilla/5.0 BABYMONSTER.HUB/1.0" } });
      if (!response.ok) { feedErrors.push(`RSS returned ${response.status}`); continue; }
      const xml = await response.text();
      const chunks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) || [];
      for (const item of chunks) {
        const title = tagValue(item, "title");
        const link = tagValue(item, "link");
        const parsed = Date.parse(tagValue(item, "pubDate"));
        const sourceMatch = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
        const description = tagValue(item, "description").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
        if (!title || !link) continue;
        items.push({ title, link, date: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "", pubDate: Number.isFinite(parsed) ? new Date(parsed).toISOString() : "", author: sourceMatch ? decodeEntities(sourceMatch[1]).trim() : "Google News", description: description || "Latest coverage and updates about BABYMONSTER." });
      }
    } catch (error) {
      feedErrors.push(String(error && error.message || "RSS fetch failed"));
    }
  }
  const unique = new Map();
  for (const item of items) if (!unique.has(item.link)) unique.set(item.link, item);
  const sorted = [...unique.values()].sort((a, b) => Date.parse(b.date || 0) - Date.parse(a.date || 0));
  return res.status(200).json({ status: sorted.length ? "ok" : "empty", items: sorted, ...(sorted.length ? {} : { message: "News sources returned no articles", details: feedErrors }) });
}
