
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return json({
        status: "OK",
        service: "MovieMela Telegram Search API",
        version: "2.0"
      });
    }

    if (url.pathname !== "/search") {
      return json({ error: "Not found" }, 404);
    }

    const movie = (url.searchParams.get("movie") || "").trim();
    const year = (url.searchParams.get("year") || "").trim();

    if (!movie) {
      return json({
        result: { status: "MOVIE NAME REQUIRED" }
      }, 400);
    }

    const normalize = (value) =>
      decodeEntities(value)
        .replace(/<[^>]*>/g, " ")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    const wanted = normalize(movie);
    const wantedYear = year.replace(/\D/g, "");

    if (!wanted) {
      return json({
        result: { status: "INVALID MOVIE NAME" }
      }, 400);
    }

    const MAX_PAGES = 6;
    const seenPosts = new Set();
    let before = "";
    let pagesScanned = 0;

    try {
      for (let page = 0; page < MAX_PAGES; page++) {
        let telegramURL = "https://t.me/s/MovieMelaIndia";

        if (before) {
          telegramURL += "?before=" + encodeURIComponent(before);
        }

        const response = await fetch(telegramURL, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html"
          },
          signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
          return json({
            result: {
              status: "TELEGRAM PAGE ERROR",
              http_status: response.status,
              pages_scanned: pagesScanned
            }
          }, 502);
        }

        const html = await response.text();
        pagesScanned++;

        const blocks = html.match(
          /<div class="tgme_widget_message_wrap[^"]*"[\s\S]*?(?=<div class="tgme_widget_message_wrap|$)/g
        ) || [];

        if (blocks.length === 0) {
          if (page === 0) {
            return json({
              result: {
                status: "NO POSTS FOUND ON TELEGRAM PAGE",
                pages_scanned: pagesScanned
              }
            });
          }

          break;
        }

        let oldestId = null;

        for (const block of blocks) {
          const postMatch = block.match(
            /data-post="MovieMelaIndia\/(\d+)"/
          );

          if (!postMatch) continue;

          const postId = postMatch[1];

          if (!oldestId || Number(postId) < Number(oldestId)) {
            oldestId = postId;
          }

          if (seenPosts.has(postId)) continue;
          seenPosts.add(postId);

          const textMatch = block.match(
            /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
          );

          const rawText = textMatch
            ? textMatch[1]
            : block;

          const message = normalize(rawText);

          if (!message.includes(wanted)) continue;

          if (wantedYear) {
            const yearPattern = new RegExp(
              "(^| )" + wantedYear + "( |$)"
            );

            if (!yearPattern.test(message)) continue;
          }

          return json({
            result: {
              status: "MATCH FOUND",
              movie: movie,
              year: wantedYear || null,
              telegram_url:
                "https://t.me/MovieMelaIndia/" + postId,
              pages_scanned: pagesScanned
            }
          });
        }

        if (!oldestId || oldestId === before) break;

        before = oldestId;
      }

      return json({
        result: {
          status: "NO MATCH IN SCANNED POSTS",
          movie: movie,
          year: wantedYear || null,
          pages_scanned: pagesScanned,
          posts_checked: seenPosts.size,
          note:
            "Only publicly accessible preview posts were searched. Full channel history is not guaranteed."
        }
      });

    } catch (error) {
      return json({
        result: {
          status: "SEARCH ERROR",
          message: String(error.message || error),
          pages_scanned: pagesScanned
        }
      }, 500);
    }
  }
};

function decodeEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCodePoint(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16))
    );
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store"
    }
  });
}
