import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { createServer } from "./server.js";

const servers = new Set();

async function postPalette(options, body) {
  const server = createServer(options);
  servers.add(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return fetch(`http://127.0.0.1:${port}/api/palette`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body)
  });
}

afterEach(async () => {
  await Promise.all([...servers].map((server) => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
  servers.clear();
});

test("serves the page and its extracted CSS and JavaScript", async () => {
  const server = createServer({ apiKey: "" });
  servers.add(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const origin = `http://127.0.0.1:${port}`;

  const [htmlResponse, cssResponse, jsResponse] = await Promise.all([
    fetch(origin),
    fetch(`${origin}/styles.css`),
    fetch(`${origin}/app.js`)
  ]);

  assert.equal(htmlResponse.status, 200);
  const html = await htmlResponse.text();
  assert.match(html, /href="\/styles\.css"/);
  assert.match(html, /maxlength="120"/);
  assert.equal(cssResponse.headers.get("content-type"), "text/css; charset=utf-8");
  const stylesheet = await cssResponse.text();
  assert.match(stylesheet, /\.swatches/);
  assert.equal(jsResponse.headers.get("content-type"), "text/javascript; charset=utf-8");
  const appScript = await jsResponse.text();
  assert.match(appScript, /api\/palette/);
  assert.match(appScript, /navigator\.clipboard\.writeText/);
  assert.match(appScript, /playCopySound\(\);/);
  assert.match(appScript, /createOscillator/);
  assert.match(appScript, /event\.key === "Enter"/);
  assert.match(stylesheet, /aspect-ratio: 1/);
  assert.match(stylesheet, /\.swatches:empty\s*\{\s*min-height: 196px/);
  assert.match(stylesheet, /font-size: clamp\(9px, 1\.6vw, 12px\)/);
  assert.match(stylesheet, /white-space: nowrap/);
  assert.doesNotMatch(stylesheet, /\.swatch:last-child:nth-child\(odd\)/);
  assert.match(stylesheet, /\.swatch\.is-copied \.copy-feedback/);
});

test("passes the theme to Gemini and returns exactly five HEX colors", async () => {
  let requestUrl;
  let requestOptions;
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async (url, options) => {
      requestUrl = url;
      requestOptions = options;
      return Response.json({
        output: [{
          type: "model_output",
          content: [{
            type: "text",
            text: JSON.stringify({ colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"] })
          }]
        }]
      });
    }
  }, { theme: "고요한 숲" });

  const requestBody = JSON.parse(requestOptions.body);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"]
  });
  assert.equal(requestUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
  assert.equal(requestOptions.headers["x-goog-api-key"], "test-key");
  assert.equal(requestBody.model, "gemini-3.1-flash-lite");
  assert.match(requestBody.input, /고요한 숲/);
  assert.equal(requestBody.response_format.mime_type, "application/json");
});

test("reads text output from the Interactions API response format", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({ colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"] })
        }]
      }]
    })
  }, { theme: "노을" });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"]
  });
});

test("reads text from wrapped and plural Interactions API output fields", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      interaction: {
        status: "completed",
        outputs: [{
          type: "text",
          text: JSON.stringify({ colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"] })
        }]
      }
    })
  }, { theme: "노을" });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"]
  });
});

test("reads model output text from completed Interaction steps", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      id: "interaction-id",
      status: "completed",
      usage: {},
      created: "2026-10-03T00:00:00Z",
      updated: "2026-10-03T00:00:01Z",
      service_tier: "standard",
      steps: [{
        type: "model_output",
        content: [{
          type: "text",
          text: JSON.stringify({ colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"] })
        }]
      }],
      object: "interaction",
      model: "gemini-3.1-flash-lite"
    })
  }, { theme: "노을" });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    colors: ["#102030", "#405060", "#708090", "#A0B0C0", "#D0E0F0"]
  });
});

test("reports when an Interaction contains no text output", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      status: "completed",
      output: [{ type: "thought" }]
    })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  const result = await response.json();
  assert.match(result.error, /step\/output 유형: thought/);
  assert.match(result.error, /응답 필드: status, output/);
  assert.match(result.error, /상태: completed/);
});

test("reports Gemini request timeouts distinctly", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new DOMException("request timed out", "TimeoutError");
    }
  }, { theme: "노을" });

  assert.equal(response.status, 504);
  assert.match((await response.json()).error, /시간이 초과/);
});

test("reports network failures while connecting to Gemini", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => {
      throw new TypeError("fetch failed");
    }
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /연결하지 못했습니다/);
});

test("rejects empty themes before calling Gemini", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: () => assert.fail("Gemini should not be called for invalid input")
  }, { theme: "  " });

  assert.equal(response.status, 400);
});

test("rejects non-object and malformed JSON request bodies", async () => {
  const nullBodyResponse = await postPalette({
    apiKey: "test-key",
    fetchImpl: () => assert.fail("Gemini should not be called for invalid JSON body")
  }, "null");
  const malformedResponse = await postPalette({
    apiKey: "test-key",
    fetchImpl: () => assert.fail("Gemini should not be called for malformed JSON")
  }, "{invalid");

  assert.equal(nullBodyResponse.status, 400);
  assert.match((await nullBodyResponse.json()).error, /JSON 객체/);
  assert.equal(malformedResponse.status, 400);
  assert.match((await malformedResponse.json()).error, /올바른 JSON/);
});

test("reports a missing API key instead of returning a fake palette", async () => {
  const response = await postPalette({ apiKey: "" }, { theme: "여름 바다" });

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /GEMINI_API_KEY/);
});

test("surfaces Gemini API errors to help diagnose failed requests", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      error: { message: "Requested model was not found." }
    }, { status: 404 })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  const result = await response.json();
  assert.match(result.error, /Requested model was not found/);
  assert.match(result.error, /모델 이름/);
});

test("provides quota guidance when Gemini rejects a request with HTTP 429", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      error: { message: "Rate limit exceeded." }
    }, { status: 429 })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  const result = await response.json();
  assert.match(result.error, /할당량/);
  assert.match(result.error, /Rate limit exceeded/);
});

test("surfaces non-JSON Gemini errors without exposing the API key", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => new Response("Gateway rejected test-key", { status: 404 })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /Gateway rejected \[redacted\]/);
});

test("rejects malformed Gemini color output", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => Response.json({
      output_text: JSON.stringify({ colors: ["red", "#405060", "#708090", "#A0B0C0", "#D0E0F0"] })
    })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
});

test("reports malformed successful Gemini responses", async () => {
  const response = await postPalette({
    apiKey: "test-key",
    fetchImpl: async () => new Response("not-json", {
      status: 200,
      headers: { "Content-Type": "application/json" }
    })
  }, { theme: "노을" });

  assert.equal(response.status, 502);
  assert.match((await response.json()).error, /JSON으로 읽을 수 없습니다/);
});
