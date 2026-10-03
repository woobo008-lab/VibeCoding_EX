import { readFile } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { pathToFileURL } from "node:url";

const page = await readFile(new URL("./index.html", import.meta.url));
const staticAssets = new Map([
  ["/styles.css", {
    content: await readFile(new URL("./styles.css", import.meta.url)),
    contentType: "text/css; charset=utf-8"
  }],
  ["/app.js", {
    content: await readFile(new URL("./app.js", import.meta.url)),
    contentType: "text/javascript; charset=utf-8"
  }]
]);
const maxBodyBytes = 2_048;

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function getInteractionText(result) {
  if (!result || typeof result !== "object") return "";
  if (typeof result.output_text === "string") return result.output_text;

  const textParts = [];
  const visited = new Set();
  const collectText = (value) => {
    if (Array.isArray(value)) {
      value.forEach(collectText);
      return;
    }
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (typeof value.output_text === "string") {
      textParts.push(value.output_text);
    } else if (
      ["text", "output_text", "model_output"].includes(value.type) &&
      typeof value.text === "string"
    ) {
      textParts.push(value.text);
    }
    for (const key of ["output", "outputs", "steps", "content", "parts", "interaction", "response", "result", "data"]) {
      collectText(value[key]);
    }
  };

  collectText(result);
  return textParts.join("");
}

function providerFailureHint(status) {
  if (status === 401 || status === 403) {
    return "API 키와 프로젝트 권한을 확인해 주세요.";
  }
  if (status === 404) {
    return "모델 이름과 API 지원 여부를 확인해 주세요.";
  }
  if (status === 429) {
    return "요청 한도 또는 사용량 할당량을 확인한 뒤 다시 시도해 주세요.";
  }
  if (status >= 500) {
    return "Gemini 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.";
  }
  return "요청 설정과 Gemini API 오류 내용을 확인해 주세요.";
}

async function readJsonBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > maxBodyBytes) {
      const error = new Error("요청 내용이 너무 큽니다.");
      error.statusCode = 413;
      throw error;
    }
  }

  try {
    return JSON.parse(body);
  } catch {
    const error = new Error("올바른 JSON 요청이 아닙니다.");
    error.statusCode = 400;
    throw error;
  }
}

export function createServer({
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite",
  fetchImpl = fetch
} = {}) {
  return createHttpServer(async (request, response) => {
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(page);
      return;
    }

    if (request.method === "GET" && staticAssets.has(url.pathname)) {
      const asset = staticAssets.get(url.pathname);
      response.writeHead(200, { "Content-Type": asset.contentType });
      response.end(asset.content);
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/api/palette") {
      sendJson(response, 404, { error: "요청한 경로를 찾을 수 없습니다." });
      return;
    }

    try {
      const body = await readJsonBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        sendJson(response, 400, { error: "요청 본문은 JSON 객체여야 합니다." });
        return;
      }
      const theme = typeof body.theme === "string" ? body.theme.trim() : "";
      if (!theme || theme.length > 120) {
        sendJson(response, 400, { error: "테마는 1~120자 사이로 입력해 주세요." });
        return;
      }
      if (typeof body.variation !== "undefined" && typeof body.variation !== "boolean") {
        sendJson(response, 400, { error: "variation 값은 true 또는 false여야 합니다." });
        return;
      }
      if (!apiKey) {
        sendJson(response, 503, { error: "서버에 GEMINI_API_KEY 환경 변수를 설정해 주세요." });
        return;
      }

      const prompt = [
        "You are a professional color designer.",
        `Create exactly five distinct, vivid yet harmonious colors for this theme: "${theme}".`,
        body.variation === true
          ? "Create a noticeably different palette from a typical first choice, while still matching the theme."
          : "Make the palette clearly reflect the meaning, mood, materials, and imagery of the theme.",
        'Return only a JSON object with this shape: {"colors":["#112233","#445566","#778899","#AABBCC","#DDEEFF"]}.',
        "Every color must be a six-digit hex color beginning with #."
      ].join("\n");

      let upstream;
      try {
        upstream = await fetchImpl(
          "https://generativelanguage.googleapis.com/v1beta/interactions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey
            },
            body: JSON.stringify({
              model,
              input: prompt,
              response_format: {
                type: "text",
                mime_type: "application/json",
                schema: {
                  type: "object",
                  properties: {
                    colors: {
                      type: "array",
                      items: { type: "string" }
                    }
                  },
                  required: ["colors"]
                }
              }
            }),
            signal: AbortSignal.timeout(30_000)
          }
        );
      } catch (error) {
        if (error.name === "AbortError" || error.name === "TimeoutError") {
          sendJson(response, 504, { error: "Gemini API 요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요." });
        } else {
          sendJson(response, 502, { error: "Gemini API에 연결하지 못했습니다. 네트워크 연결을 확인한 뒤 다시 시도해 주세요." });
        }
        return;
      }

      if (!upstream.ok) {
        let providerMessage = "";
        try {
          const errorText = await upstream.text();
          let errorBody;
          try {
            errorBody = JSON.parse(errorText);
          } catch {
            providerMessage = errorText.trim().slice(0, 500).replaceAll(apiKey, "[redacted]");
          }
          providerMessage = typeof errorBody?.error?.message === "string"
            ? errorBody.error.message
            : providerMessage;
        } catch (error) {
          if (!(error instanceof TypeError)) throw error;
        }
        providerMessage = providerMessage.replaceAll(apiKey, "[redacted]").slice(0, 500);
        const detail = providerMessage ? ` Gemini 응답: ${providerMessage}` : "";
        sendJson(response, 502, {
          error: `Gemini API 요청 실패 (모델 ${model}, HTTP ${upstream.status}). ${providerFailureHint(upstream.status)}${detail}`
        });
        return;
      }

      let result;
      try {
        result = await upstream.json();
      } catch {
        sendJson(response, 502, { error: "Gemini 응답을 JSON으로 읽을 수 없습니다." });
        return;
      }

      const text = getInteractionText(result);
      if (!text) {
        const outputs = result.steps || result.output || result.outputs ||
          result.interaction?.steps || result.interaction?.output || result.interaction?.outputs;
        const outputTypes = Array.isArray(outputs)
          ? outputs.map((item) => item?.type || "unknown").join(", ")
          : "없음";
        const responseFields = Object.keys(result).join(", ") || "없음";
        const interactionStatus = typeof result.status === "string"
          ? `, 상태: ${result.status}`
          : "";
        sendJson(response, 502, {
          error: `Gemini 응답에서 팔레트 텍스트를 찾지 못했습니다 (step/output 유형: ${outputTypes}, 응답 필드: ${responseFields}${interactionStatus}).`
        });
        return;
      }

      let generated;
      try {
        generated = JSON.parse(text);
      } catch {
        sendJson(response, 502, { error: "Gemini 팔레트 응답이 JSON 형식이 아닙니다." });
        return;
      }

      const colors = generated?.colors;
      if (
        !Array.isArray(colors) ||
        colors.length !== 5 ||
        colors.some((color) => typeof color !== "string" || !/^#[\da-fA-F]{6}$/.test(color))
      ) {
        sendJson(response, 502, { error: "Gemini 응답에 올바른 HEX 색상 5개가 포함되지 않았습니다." });
        return;
      }

      sendJson(response, 200, { colors: colors.map((color) => color.toUpperCase()) });
    } catch (error) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode
          ? error.message
          : "서버에서 팔레트 요청을 처리하지 못했습니다. 서버 로그를 확인한 뒤 다시 시도해 주세요."
      });
    }
  });
}

const entryPoint = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (entryPoint) {
  const port = Number(process.env.PORT || 3000);
  createServer().listen(port, "127.0.0.1", () => {
    console.log(`AI 컬러 팔레트 서버 실행 중: http://localhost:${port}`);
  });
}
