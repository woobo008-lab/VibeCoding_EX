import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const host = "127.0.0.1";
const port = 4173;
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url ?? "/", `http://${host}:${port}`).pathname;
  const file = files.get(pathname);

  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, {
      Allow: "GET, HEAD",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("Method not allowed");
    return;
  }

  try {
    const content = await readFile(new URL(file[0], import.meta.url));
    response.writeHead(200, {
      "Content-Type": file[1],
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch (error) {
    console.error(`Failed to serve ${file[0]}:`, error);
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Unable to load the requested page.");
  }
});

server.on("error", (error) => {
  console.error(`Could not start the AI_CBI server at http://${host}:${port}:`);
  console.error(error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`AI_CBI is available at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop the local server.");
});
