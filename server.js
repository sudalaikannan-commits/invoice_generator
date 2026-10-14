const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DEFAULT_PORT = 5173;
const HOST = "127.0.0.1";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function sniffImageMime(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  return null;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

function getInitialPort() {
  const env = process.env.PORT;
  if (env && /^\d+$/.test(env)) {
    const p = parseInt(env, 10);
    if (p >= 1 && p <= 65535) return p;
  }
  return DEFAULT_PORT;
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const filePath = path.join(ROOT, path.normalize(urlPath).replace(/^([/\\])+/, ""));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found: " + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    let contentType = MIME[ext] || "application/octet-stream";
    if (IMAGE_EXTS.has(ext)) {
      const sniffed = sniffImageMime(data);
      if (sniffed) contentType = sniffed;
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });
    res.end(data);
  });
});

let currentPort = getInitialPort();
let isListening = false;
let listenAttempts = 0;
const MAX_ATTEMPTS = 10;

function startListening(port) {
  listenAttempts++;
  server.once("error", (err) => {
    if (err && err.code === "EADDRINUSE" && listenAttempts < MAX_ATTEMPTS) {
      currentPort = port + 1;
      // Try next port
      setImmediate(() => startListening(currentPort));
      return;
    }
    console.error("Server startup error:", err);
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    isListening = true;
    console.log("Ationic Invoice Generator running at http://localhost:" + port);
    console.log("Press Ctrl+C to stop.");
  });
}

startListening(currentPort);
