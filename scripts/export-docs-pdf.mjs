/**
 * Exports the documents in docs/final/ to PDF, and saves each rendered Mermaid diagram as an SVG
 * in docs/final/assets/diagrams/.
 *
 *   node scripts/export-docs-pdf.mjs
 *
 * Markdown is rendered with marked; Mermaid diagrams are drawn in Chromium (Mermaid is loaded from
 * cdn.jsdelivr.net, so this needs a network connection) and the page is printed with Playwright.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { Marked } from "marked";

const ROOT = process.cwd();
const FINAL = path.join(ROOT, "docs", "final");
const DIAGRAMS = path.join(FINAL, "assets", "diagrams");
const MERMAID = "https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js";
const DOCS = [
  { file: "User_Guide.md", prefix: "user-guide" },
  { file: "Functional_Specification.md", prefix: "fsd" },
  { file: "Technical_Specification.md", prefix: "tsd" },
];

/** GitHub-style heading ids, so the tables of contents link inside the PDF too. */
function slugger() {
  const seen = new Map();
  return (text) => {
    const base = text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .trim()
      .replace(/\s/g, "-");
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}-${count}`;
  };
}

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function render(markdown) {
  const slug = slugger();
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const html = this.parser.parseInline(tokens);
        return `<h${depth} id="${slug(html)}">${html}</h${depth}>\n`;
      },
      code({ text, lang }) {
        if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
        return `<pre><code>${escapeHtml(text)}</code></pre>\n`;
      },
    },
  });
  // Keep IDs such as FR-012 or SCR-05 on one line in narrow table columns (not inside code blocks or tags).
  return marked
    .parse(markdown)
    .split(/(<pre[\s\S]*?<\/pre>)/)
    .map((part) => (part.startsWith("<pre") ? part : part.replace(/(^|>)([^<]+)/g, (_, open, text) => open + text.replace(/\b([A-Z]{1,5}-\d{2,3})\b/g, '<span class="id">$1</span>'))))
    .join("");
}

const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  body { font: 10.5pt/1.5 "Segoe UI", system-ui, -apple-system, sans-serif; color: #17211d; }
  h1 { font-size: 22pt; margin: 0 0 8pt; color: #0b4f37; }
  h2 { font-size: 15pt; margin: 22pt 0 8pt; color: #0b4f37; break-after: avoid; border-bottom: 1px solid #d6ddd9; padding-bottom: 3pt; }
  h3 { font-size: 12pt; margin: 16pt 0 6pt; break-after: avoid; }
  h4 { font-size: 10.5pt; margin: 12pt 0 4pt; break-after: avoid; }
  p, li { orphans: 3; widows: 3; }
  a { color: #0b6b4a; text-decoration: none; }
  table { border-collapse: collapse; width: 100%; margin: 8pt 0 12pt; font-size: 8.8pt; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th, td { border: 1px solid #d6ddd9; padding: 4pt 5pt; text-align: left; vertical-align: top; }
  th { background: #eef3f0; }
  .id { white-space: nowrap; }
  td code { overflow-wrap: anywhere; }
  code { font: 8.8pt/1.4 Consolas, "Cascadia Mono", monospace; background: #f3f5f4; padding: 0 2pt; border-radius: 2pt; }
  pre { background: #f6f8f7; border: 1px solid #e2e7e4; border-radius: 4pt; padding: 7pt; white-space: pre-wrap; word-break: break-word; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  pre.mermaid { background: #fff; border: none; text-align: center; }
  img { max-width: 100%; height: auto; break-inside: avoid; border: 1px solid #e2e7e4; border-radius: 4pt; }
  img[src$=".svg"] { border: none; }
  img[src*="logos/"] { width: 26mm; height: auto; }
  p:has(> img) { break-inside: avoid; text-align: center; }
  em { color: #4b5852; }
  blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3pt solid #0b4f37; background: #f3f7f5; }
  hr { border: none; border-top: 1px solid #d6ddd9; margin: 16pt 0; }
`;

async function main() {
  fs.mkdirSync(DIAGRAMS, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const doc of DOCS) {
    const source = path.join(FINAL, doc.file);
    if (!fs.existsSync(source)) {
      console.log(`Skipped ${doc.file}: not found`);
      continue;
    }
    const body = render(fs.readFileSync(source, "utf8"));
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="${pathToFileURL(FINAL).href}/">
      <title>${doc.file.replace(".md", "").replace(/_/g, " ")}</title><style>${CSS}</style></head>
      <body>${body}<script src="${MERMAID}"></script></body></html>`;
    const htmlFile = path.join(FINAL, `.${doc.prefix}.html`);
    fs.writeFileSync(htmlFile, html);
    await page.goto(pathToFileURL(htmlFile).href, { waitUntil: "load" });

    const diagrams = await page.locator("pre.mermaid").count();
    if (diagrams > 0) {
      await page.waitForFunction(() => typeof window.mermaid !== "undefined", null, { timeout: 30_000 });
      const errors = await page.evaluate(async () => {
        window.mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "strict", flowchart: { htmlLabels: false } });
        const failed = [];
        const nodes = [...document.querySelectorAll("pre.mermaid")];
        for (const [index, node] of nodes.entries()) {
          try {
            await window.mermaid.run({ nodes: [node] });
          } catch (error) {
            failed.push(`diagram ${index + 1}: ${String(error).slice(0, 160)}`);
          }
        }
        return failed;
      });
      if (errors.length) console.log(`${doc.file}: ${errors.length} diagram(s) failed\n  ${errors.join("\n  ")}`);
      const svgs = await page.$$eval("pre.mermaid svg", (nodes) => nodes.map((node) => node.outerHTML));
      svgs.forEach((svg, index) => {
        const name = `${doc.prefix}-${String(index + 1).padStart(2, "0")}.svg`;
        fs.writeFileSync(path.join(DIAGRAMS, name), svg.startsWith("<svg") ? svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"') : svg);
      });
      console.log(`${doc.file}: ${svgs.length} of ${diagrams} diagrams rendered`);
    }

    const missing = await page.$$eval("img", (images) => images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src")));
    if (missing.length) console.log(`${doc.file}: ${missing.length} image(s) did not load\n  ${missing.join("\n  ")}`);

    const pdf = path.join(FINAL, doc.file.replace(".md", ".pdf"));
    await page.pdf({
      path: pdf,
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate: `<div style="font-size:8px;width:100%;text-align:center;color:#6b7772;">Tradelink · ${doc.file.replace(".md", "").replace(/_/g, " ")} · page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
    });
    fs.rmSync(htmlFile);
    console.log(`Wrote ${path.relative(ROOT, pdf)}`);
  }
  await browser.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
