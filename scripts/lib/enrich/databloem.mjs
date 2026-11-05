// Parsers for the Databloem shop (PrestaShop 1.5 theme).
import { decodeEntities, splitCredit } from "./normalize.mjs";

export const DATABLOEM_SEARCH = "https://databloem.com/index.php?controller=search&search_query=oophoi&n=100";

const stripQuery = (url) => url.replace(/[?#].*$/, "");

function htmlToText(html) {
  return decodeEntities(
    html
      .replace(/<(script|style|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>|<\/(p|li|div|ul)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

// Result titles are <h3><a href=...>; sidebar and footer links are ignored.
export function parseSearchResults(html) {
  const urls = [...html.matchAll(/<h3>\s*<a href="(https:\/\/databloem\.com\/[^"]+\.html)[^"]*"/g)].map((match) => stripQuery(decodeEntities(match[1])));
  return [...new Set(urls)];
}

export function originalImageUrl(url) {
  return url.replace(/(\/\d+)-thickbox_default\//, "$1/");
}

export function parseProductPage(html, url) {
  const rawTitle = decodeEntities(html.match(/<h1>([\s\S]*?)<\/h1>/)?.[1] ?? "")
    .replace(/[‎‏]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const { credit, title } = splitCredit(rawTitle);
  const reference = html.match(/id="product_reference"[\s\S]*?<span class="editable">([^<]*)<\/span>/)?.[1].trim() || null;

  const shortHtml = html.match(/id="short_description_content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/)?.[1] ?? "";
  const facts = htmlToText(shortHtml).split("\n");
  const year = Number(facts.join(" ").match(/Release Year (\d{4})/i)?.[1]) || null;
  const counts = facts.join(" ").match(/(\d+)\s+Tracks?,\s*(\d+)\s+Min/i);
  const packaging = facts.find((line) => /jewel|digipak|digipack|sleeve|box|case/i.test(line)) ?? null;
  const label = facts.find((line) => line === line.toUpperCase() && /[A-Z]/.test(line) && !/\d/.test(line)) ?? null;

  const descriptionHtml = html.match(/<div id="idTab1" class="rte">([\s\S]*?)<\/div>/)?.[1] ?? "";
  const images = [...html.matchAll(/href="(https:\/\/databloem\.com\/\d+-thickbox_default\/[^"]+)"/g)].map((match) => originalImageUrl(match[1]));

  return {
    id: Number(stripQuery(url).match(/\/(\d+)-[^/]*\.html$/)?.[1]) || null,
    url: stripQuery(url),
    rawTitle,
    credit,
    title,
    reference,
    label,
    year,
    trackCount: counts ? Number(counts[1]) : null,
    minutes: counts ? Number(counts[2]) : null,
    packaging,
    description: htmlToText(descriptionHtml),
    images: [...new Set(images)],
  };
}
