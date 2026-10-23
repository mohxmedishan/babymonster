const ARTIST_MBID = "5829cd4f-e693-4b03-abe5-1226243c23d6";
const ITUNES_URL = "https://itunes.apple.com/search?term=BABYMONSTER&entity=album&limit=200&country=us";
const MB_URL = `https://musicbrainz.org/ws/2/release-group?artist=${ARTIST_MBID}&fmt=json&limit=100`;

function clean(value = "") {
  return String(value).replace(/\s+/g, " ").trim();
}
function key(value = "") {
  return clean(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9가-힣]/g, "");
}
function classify(primaryType, title, trackCount) {
  const type = String(primaryType || "").toLowerCase();
  if (type === "single") return { type: "Digital Single", typeKey: "single" };
  if (type === "ep") return { type: "EP", typeKey: "ep" };
  if (type === "album") return { type: "Album", typeKey: "album" };
  const t = String(title || "").toLowerCase();
  if (/\b(ep|mini album)\b/.test(t)) return { type: "EP", typeKey: "ep" };
  if (/\b(single|digital single)\b/.test(t) || Number(trackCount) <= 2) return { type: "Digital Single", typeKey: "single" };
  return { type: "Album", typeKey: "album" };
}
function yearOf(date) {
  return date && /^\d{4}/.test(date) ? date.slice(0, 4) : "";
}
function artFromItunes(url) {
  return String(url || "").replace(/\/\d+x\d+bb\./, "/600x600bb.");
}
async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: { accept: "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(`Upstream returned ${response.status}`);
  return response.json();
}
function responseRecord(r) {
  const title = clean(r["title"]);
  const date = r["first-release-date"] || "";
  const type = classify(r["primary-type"], title, 0);
  const id = r.id || key(title);
  return {
    id, title, date, year: yearOf(date), ...type, trackCount: 0,
    artwork: `https://coverartarchive.org/release-group/${id}/front-500`,
    tags: ["K-pop", "BABYMONSTER"], tracks: [],
    spotify: `https://open.spotify.com/search/${encodeURIComponent("BABYMONSTER " + title)}`,
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent("BABYMONSTER " + title + " official")}`,
    sourceUrl: `https://musicbrainz.org/release-group/${id}`,
    dateValue: Date.parse(date) || 0
  };
}

export default async function handler(req, res) {
  if (req.method && req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const settled = await Promise.allSettled([
      fetchJson(ITUNES_URL),
      fetchJson(MB_URL, { headers: { "User-Agent": "BABYMONSTER.HUB/1.0 (fan-made discovery interface)" } })
    ]);
    const itunes = settled[0].status === "fulfilled" ? settled[0].value : { results: [] };
    const mb = settled[1].status === "fulfilled" ? settled[1].value : { "release-groups": [] };
    const itunesRows = (itunes.results || []).filter(x =>
      String(x.artistName || "").toLowerCase().includes("babymonster") && x.collectionName
    );
    const mbRows = (mb["release-groups"] || []).filter(x =>
      ["album", "ep", "single"].includes(String(x["primary-type"] || "").toLowerCase()) &&
      !((x["secondary-types"] || []).some(t => ["compilation", "live", "remix"].includes(String(t).toLowerCase())))
    );
    const mbByTitle = new Map(mbRows.map(x => [`${key(x.title)}|${yearOf(x["first-release-date"])}`, x]));
    const used = new Set();
    const releases = [];

    for (const item of itunesRows) {
      const title = clean(item.collectionName);
      const date = item.releaseDate || "";
      const normalizedKey = `${key(title)}|${yearOf(date)}`;
      const match = mbByTitle.get(normalizedKey) ||
        mbRows.find(x => key(x.title) === key(title));
      const type = classify(match?.["primary-type"], title, item.trackCount);
      const id = String(item.collectionId || match?.id || normalizedKey);
      const rec = {
        id, title, date, year: yearOf(date), ...type,
        trackCount: Number(item.trackCount) || 0,
        artwork: artFromItunes(item.artworkUrl100) || (match ? `https://coverartarchive.org/release-group/${match.id}/front-500` : ""),
        tags: [item.primaryGenreName || "K-pop", "BABYMONSTER"],
        tracks: [],
        spotify: `https://open.spotify.com/search/${encodeURIComponent("BABYMONSTER " + title)}`,
        youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent("BABYMONSTER " + title + " official")}`,
        sourceUrl: item.collectionViewUrl || (match ? `https://musicbrainz.org/release-group/${match.id}` : ""),
        dateValue: Date.parse(date) || Date.parse(match?.["first-release-date"] || "") || 0
      };
      releases.push(rec);
      used.add(match?.id);
    }
    for (const row of mbRows) {
      if (used.has(row.id)) continue;
      const rec = responseRecord(row);
      if (!releases.some(x => key(x.title) === key(rec.title) && (!x.year || !rec.year || x.year === rec.year))) releases.push(rec);
    }

    // Enrich a small set of top iTunes results with real track names.
    const enrich = releases.filter(x => /^\d+$/.test(x.id)).sort((a, b) => b.dateValue - a.dateValue).slice(0, 12);
    const details = await Promise.allSettled(enrich.map(x => fetchJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(x.id)}&entity=song&limit=30`)));
    details.forEach((result, index) => {
      if (result.status !== "fulfilled") return;
      const songs = (result.value.results || []).filter(x => x.wrapperType === "track" && x.trackName);
      enrich[index].tracks = songs.slice(0, 8).map(x => ({ name: clean(x.trackName) }));
      if (songs.length) enrich[index].trackCount = Math.max(enrich[index].trackCount, songs.length);
    });

    const deduped = new Map();
    for (const item of releases) {
      const k = `${key(item.title)}|${item.year || ""}`;
      const previous = deduped.get(k);
      if (!previous || (!previous.artwork && item.artwork) || item.tracks.length > (previous.tracks || []).length) deduped.set(k, item);
    }
    const result = [...deduped.values()].sort((a, b) => b.dateValue - a.dateValue);
    if (!result.length) return res.status(502).json({ error: "No releases returned by the music catalogs", releases: [] });
    return res.status(200).json({
      status: "ok",
      source: settled.some(x => x.status === "fulfilled") ? "Apple/iTunes + MusicBrainz" : "Music catalog",
      updatedAt: new Date().toISOString(),
      releases: result
    });
  } catch (error) {
    console.error("Discography lookup failed", error);
    return res.status(502).json({ status: "error", error: "Could not retrieve music catalog", releases: [] });
  }
}
