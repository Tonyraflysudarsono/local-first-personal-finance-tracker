import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, request as createProxyRequest } from "node:http";
import { extname, resolve, sep } from "node:path";
import { startProdServer } from "vinext/server/prod-server";

const root = process.cwd();
const clientRoot = resolve(root, "dist", "client");
const host = process.env.HOST || "localhost";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function resolveClientFile(url = "/") {
  let pathname;
  try {
    pathname = decodeURIComponent(url.split("?")[0]);
  } catch {
    return null;
  }
  if (pathname === "/.vite" || pathname.startsWith("/.vite/")) return null;
  const candidate = resolve(clientRoot, pathname.replace(/^\/+/, ""));
  const normalizedRoot = `${clientRoot.toLowerCase()}${sep}`;
  if (!candidate.toLowerCase().startsWith(normalizedRoot)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

const internal = await startProdServer({ port: 0, host: "127.0.0.1", outDir: resolve(root, "dist") });

const server = createServer((incoming, outgoing) => {
  const clientFile = resolveClientFile(incoming.url);
  if (clientFile) {
    const extension = extname(clientFile).toLowerCase();
    const hashedAsset = incoming.url?.startsWith("/assets/");
    outgoing.writeHead(200, {
      "content-type": contentTypes[extension] || "application/octet-stream",
      "content-length": statSync(clientFile).size,
      "cache-control": hashedAsset ? "public, max-age=31536000, immutable" : "no-cache",
    });
    createReadStream(clientFile).pipe(outgoing);
    return;
  }

  const proxy = createProxyRequest({
    hostname: "127.0.0.1",
    port: internal.port,
    path: incoming.url,
    method: incoming.method,
    headers: { ...incoming.headers, host: `127.0.0.1:${internal.port}` },
  }, (response) => {
    outgoing.writeHead(response.statusCode || 500, response.headers);
    response.pipe(outgoing);
  });

  proxy.on("error", (error) => {
    outgoing.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    outgoing.end(`Server lokal gagal merespons: ${error.message}`);
  });
  incoming.pipe(proxy);
});

server.listen(port, host, () => {
  console.log(`Neraca berjalan di http://${host}:${port}`);
});

function shutdown() {
  server.close(() => internal.server.close(() => process.exit(0)));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
