// Serves dist/ for the tests, like a static host: folders map to index.html
// and unknown paths get 404.html with a 404 status.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".webp": "image/webp", ".png": "image/png", ".xml": "application/xml", ".txt": "text/plain" };
const port = Number(process.env.PORT || 4400);
createServer(async (req, res) => {
  let path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let file = resolve(root, "." + path);
  try { if ((await stat(file)).isDirectory()) file = resolve(file, "index.html"); } catch {}
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[extname(file)] || "application/octet-stream" }).end(body);
  } catch {
    res.writeHead(404, { "content-type": types[".html"] }).end(await readFile(resolve(root, "404.html")));
  }
}).listen(port, () => console.log(`Serving dist on http://localhost:${port}`));
