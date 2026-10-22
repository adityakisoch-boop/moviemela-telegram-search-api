
export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return json({
        status: "OK",
        service: "MovieMela Telegram Search API"
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

    try {
      const response = await fetch(
        "https://t.me/s/MovieMelaIndia",
        {
          headers: {
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

      if (!response.ok) {
        return json({
          result: { status: "TELEGRAM PAGE ERROR" }
        }, 502);
      }

      const html = await response.text();

      const blocks = html.match(
        /<div class="tgme_widget_message_wrap[\s\S]*?(?=<div class="tgme_widget_message_wrap|$)/g
      ) || [];

      const normalize = (text) =>
        text
          .toLowerCase()
          .replace(/&amp;/g, "&")
          .replace(/&#39;|&apos;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&nbsp;/g, " ")
          .replace(/&#(\d+);/g, (_, n) =>
            String.fromCharCode(Number(n))
          )
          .replace(/<[^>]*>/g, " ")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/[^a-z0-9]+/g, " ")
          .trim();

      const wanted = normalize(movie);
      const wantedYear = year.replace(/\D/g, "");

      for (const block of blocks) {
        const postMatch = block.match(
          /data-post="MovieMelaIndia\/(\d+)"/
        );

        if (!postMatch) continue;

        const textMatch = block.match(
          /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/
        );

        const messageText = normalize(
          textMatch ? textMatch[1] : block
        );

        if (!messageText.includes(wanted)) continue;

        if (
          wantedYear &&
          !messageText.includes(wantedYear)
        ) {
          continue;
        }

        return json({
          result: {
            status: "MATCH FOUND",
            telegram_url:
              "https://t.me/MovieMelaIndia/" + postMatch[1]
          }
        });
      }

      return json({
        result: {
          status: "NO MATCH IN RECENT POSTS"
        }
      });

    } catch (error) {
      return json({
        result: {
          status: "SEARCH ERROR"
        }
      }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

