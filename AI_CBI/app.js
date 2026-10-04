const STORAGE_KEY = "ai-cbi-conversations";
const WELCOME_MESSAGE = "안녕하세요! 궁금한 점이나 필요한 일을 편하게 말씀해 주세요.";
const DEMO_REPLY =
  "메시지를 확인했어요. 현재는 화면 동작을 보여주는 데모라 실제 AI 응답은 연결되어 있지 않습니다.";
const STREAM_RENDER_INTERVAL_MS = 150;
const STREAM_SAVE_INTERVAL_MS = 500;

const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const conversation = document.querySelector("#conversation");
const sendButton = form.querySelector(".send-button");
const voiceButton = document.querySelector("#voice-input");
const voiceStatus = document.querySelector("#voice-status");
const voiceLocalSetupButton = document.querySelector("#voice-local-setup");
const originNotice = document.querySelector("#origin-notice");
const newChatButton = document.querySelector("#new-chat");
const suggestions = document.querySelectorAll(".suggestion");
const historyList = document.querySelector("#history-list");
const historyEmpty = document.querySelector("#history-empty");
const historyCount = document.querySelector("#history-count");
const saveStatus = document.querySelector("#save-status");
const storageError = document.querySelector("#storage-error");

let chats = [];
let activeChatId = null;
let persistenceEnabled = true;
const pendingReplies = new Map();
const SpeechRecognition =
  window.SpeechRecognition ?? window.webkitSpeechRecognition;
let recognition;
let isListening = false;
let voiceBaseText = "";
let voiceErrorOccurred = false;
let acceptVoiceResults = true;
let suppressVoiceEndStatus = false;
let localRecognitionEnabled = false;

originNotice.hidden = window.location.protocol !== "file:";

function setVoiceStatus(message, isError = false) {
  voiceStatus.textContent = message;
  voiceStatus.hidden = !message;
  voiceStatus.classList.toggle("voice-status-error", isError);
}

async function explainNetworkError() {
  if (localRecognitionEnabled) {
    setVoiceStatus(
      "기기 내 음성 인식에도 연결할 수 없습니다. 마이크 권한과 브라우저 설정을 확인한 뒤 다시 시도해 주세요.",
      true,
    );
    return;
  }

  if (
    !("processLocally" in SpeechRecognition.prototype) ||
    typeof SpeechRecognition.available !== "function" ||
    typeof SpeechRecognition.install !== "function"
  ) {
    setVoiceStatus(
      "브라우저의 음성 인식 서비스에 연결하지 못했습니다. 인터넷 연결을 확인하고 최신 Chrome 또는 Edge에서 다시 시도해 주세요.",
      true,
    );
    return;
  }

  try {
    const availability = await SpeechRecognition.available({
      langs: ["ko-KR"],
      processLocally: true,
    });

    if (availability === "available") {
      recognition.processLocally = true;
      localRecognitionEnabled = true;
      setVoiceStatus(
        "브라우저 음성 서비스에 연결할 수 없어 기기 내 인식으로 전환했습니다. 마이크 버튼을 눌러 다시 시도하세요.",
        true,
      );
      return;
    }

    if (availability === "downloadable") {
      voiceLocalSetupButton.hidden = false;
      setVoiceStatus(
        "브라우저 음성 서비스에 연결하지 못했습니다. 한국어 음성 모델을 이 기기에 준비해 오프라인 인식을 사용할 수 있습니다.",
        true,
      );
      return;
    }

    if (availability === "downloading") {
      setVoiceStatus(
        "한국어 음성 모델을 다운로드 중입니다. 완료되면 다시 시도해 주세요.",
        true,
      );
      return;
    }
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류입니다.";
    setVoiceStatus(`기기 내 음성 인식 상태를 확인하지 못했습니다. (${detail})`, true);
    return;
  }

  setVoiceStatus(
    "브라우저의 음성 인식 서비스에 연결하지 못했고, 이 브라우저에서는 기기 내 한국어 인식을 사용할 수 없습니다. 인터넷 연결과 마이크 권한을 확인한 뒤 다시 시도해 주세요.",
    true,
  );
}

function setListeningState(listening) {
  isListening = listening;
  voiceButton.classList.toggle("is-listening", listening);
  voiceButton.setAttribute("aria-pressed", String(listening));
  voiceButton.setAttribute(
    "aria-label",
    listening ? "음성 입력 중지" : "음성 입력 시작",
  );
  voiceButton.title = listening ? "음성 입력 중지" : "음성 입력";
}

function appendVoiceTranscript(finalTranscript, interimTranscript = "") {
  const separator =
    voiceBaseText && !/\s$/.test(voiceBaseText) ? " " : "";
  input.value = `${voiceBaseText}${separator}${finalTranscript}${interimTranscript}`;
  resizeInput();
  input.focus();
}

function startVoiceInput() {
  voiceErrorOccurred = false;
  acceptVoiceResults = true;
  voiceBaseText = input.value.trimEnd();
  setVoiceStatus("음성 인식을 시작합니다.");

  try {
    recognition.start();
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "음성 인식을 시작할 수 없습니다.";
    setVoiceStatus(`음성 입력을 시작하지 못했습니다. ${detail}`, true);
  }
}

if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "ko-KR";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("start", () => {
    voiceErrorOccurred = false;
    suppressVoiceEndStatus = false;
    acceptVoiceResults = true;
    setListeningState(true);
    setVoiceStatus("듣고 있어요. 말씀하신 내용이 입력창에 표시됩니다.");
  });

  recognition.addEventListener("result", (event) => {
    if (!acceptVoiceResults) return;

    let finalTranscript = "";
    let interimTranscript = "";

    for (let index = 0; index < event.results.length; index += 1) {
      const result = event.results[index];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interimTranscript += result[0].transcript;
      }
    }

    appendVoiceTranscript(finalTranscript, interimTranscript);
  });

  recognition.addEventListener("error", (event) => {
    voiceErrorOccurred = true;
    if (event.error === "network") {
      void explainNetworkError();
      return;
    }
    const messages = {
      "not-allowed": "마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해 주세요.",
      "service-not-allowed": "이 브라우저에서 음성 인식 서비스를 사용할 수 없습니다.",
      "no-speech": "음성이 감지되지 않았습니다. 다시 시도해 주세요.",
      "audio-capture": "마이크를 찾을 수 없습니다. 마이크 연결을 확인해 주세요.",
      network: "음성 인식 네트워크 오류가 발생했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
      aborted: "음성 입력이 취소되었습니다.",
    };
    setVoiceStatus(
      messages[event.error] ?? `음성 인식 오류가 발생했습니다: ${event.error}`,
      true,
    );
  });

  recognition.addEventListener("end", () => {
    setListeningState(false);
    acceptVoiceResults = false;
    if (suppressVoiceEndStatus) {
      suppressVoiceEndStatus = false;
    } else if (!voiceErrorOccurred) {
      setVoiceStatus("음성 입력을 마쳤습니다. 내용을 확인한 뒤 전송하세요.");
    }
  });
} else {
  voiceButton.disabled = true;
  voiceButton.title = "이 브라우저는 음성 인식을 지원하지 않습니다.";
  setVoiceStatus(
    "이 브라우저는 Web Speech 음성 인식을 지원하지 않습니다. 최신 Chrome 또는 Edge에서 이용해 주세요.",
    true,
  );
}

voiceLocalSetupButton.addEventListener("click", async () => {
  if (!SpeechRecognition || typeof SpeechRecognition.install !== "function") {
    setVoiceStatus("이 브라우저는 기기 내 음성 모델 설치를 지원하지 않습니다.", true);
    return;
  }

  voiceLocalSetupButton.disabled = true;
  setVoiceStatus("한국어 음성 모델을 준비하고 있습니다. 잠시 기다려 주세요.");

  try {
    const installed = await SpeechRecognition.install({
      langs: ["ko-KR"],
      processLocally: true,
    });
    if (!installed) {
      setVoiceStatus(
        "한국어 음성 모델을 준비하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        true,
      );
      return;
    }

    recognition.processLocally = true;
    localRecognitionEnabled = true;
    voiceLocalSetupButton.hidden = true;
    setVoiceStatus("기기 내 한국어 음성 인식을 준비했습니다. 마이크 버튼을 눌러 사용하세요.");
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류입니다.";
    setVoiceStatus(`한국어 음성 모델을 설치하지 못했습니다. (${detail})`, true);
  } finally {
    voiceLocalSetupButton.disabled = false;
  }
});

function isValidStore(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === 1 &&
    Array.isArray(value.chats) &&
    value.chats.every(
      (chat) =>
        chat !== null &&
        typeof chat === "object" &&
        typeof chat.id === "string" &&
        typeof chat.title === "string" &&
        typeof chat.updatedAt === "string" &&
        Array.isArray(chat.messages) &&
        chat.messages.every(
          (message) =>
            message !== null &&
            typeof message === "object" &&
            (message.role === "user" || message.role === "assistant") &&
            typeof message.text === "string",
        ),
    ) &&
    (value.activeChatId === null ||
      (typeof value.activeChatId === "string" &&
        value.chats.some((chat) => chat.id === value.activeChatId)))
  );
}

function showStorageError(message) {
  storageError.textContent = message;
  storageError.hidden = false;
  saveStatus.textContent = "저장 문제";
}

function loadChats() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === null) return;

    const store = JSON.parse(saved);
    if (!isValidStore(store)) {
      throw new Error("저장된 대화 데이터의 형식이 올바르지 않습니다.");
    }

    chats = store.chats;
    activeChatId = store.activeChatId;
  } catch (error) {
    persistenceEnabled = false;
    const detail =
      error instanceof Error ? error.message : "알 수 없는 저장 오류입니다.";
    showStorageError(
      `저장된 대화를 불러오지 못했습니다. 기존 데이터를 덮어쓰지 않도록 저장을 중단했습니다. (${detail})`,
    );
  }
}

function saveChats() {
  if (!persistenceEnabled) return false;

  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, chats, activeChatId }),
    );
    storageError.hidden = true;
    saveStatus.textContent = "대화가 자동 저장됩니다";
    return true;
  } catch (error) {
    persistenceEnabled = false;
    const detail =
      error instanceof Error ? error.message : "알 수 없는 저장 오류입니다.";
    showStorageError(
      `대화를 브라우저에 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요. (${detail})`,
    );
    return false;
  }
}

function getActiveChat() {
  return chats.find((chat) => chat.id === activeChatId) ?? null;
}

function createChat() {
  const chat = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "새 대화",
    updatedAt: new Date().toISOString(),
    messages: [],
  };
  chats.unshift(chat);
  activeChatId = chat.id;
  return chat;
}

function markChatUpdated(chat) {
  chat.updatedAt = new Date().toISOString();
  chats = [chat, ...chats.filter((savedChat) => savedChat.id !== chat.id)];
}

function appendInlineMarkdown(parent, text) {
  const pattern =
    /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|\*[^*\n]+\*|_[^_\n]+_|\[[^\]\n]+\]\([^) \n]+\))/g;
  let lastIndex = 0;

  for (const match of text.matchAll(pattern)) {
    const token = match[0];
    const index = match.index;
    parent.append(document.createTextNode(text.slice(lastIndex, index)));

    if (token.startsWith("`")) {
      const code = document.createElement("code");
      code.textContent = token.slice(1, -1);
      parent.append(code);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      const strong = document.createElement("strong");
      strong.textContent = token.slice(2, -2);
      parent.append(strong);
    } else if (token.startsWith("~~")) {
      const deletion = document.createElement("del");
      deletion.textContent = token.slice(2, -2);
      parent.append(deletion);
    } else if (token.startsWith("*") || token.startsWith("_")) {
      const emphasis = document.createElement("em");
      emphasis.textContent = token.slice(1, -1);
      parent.append(emphasis);
    } else {
      const linkParts = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!linkParts) {
        parent.append(document.createTextNode(token));
      } else {
        let safeUrl;
        try {
          const parsedUrl = new URL(linkParts[2], window.location.href);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            safeUrl = parsedUrl.href;
          }
        } catch {
          safeUrl = undefined;
        }

        if (safeUrl) {
          const link = document.createElement("a");
          link.href = safeUrl;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = linkParts[1];
          parent.append(link);
        } else {
          parent.append(document.createTextNode(token));
        }
      }
    }

    lastIndex = index + token.length;
  }

  parent.append(document.createTextNode(text.slice(lastIndex)));
}

function renderMarkdown(container, markdown) {
  container.replaceChildren();
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^\s*```/.test(line)) {
      index += 1;
      const codeLines = [];
      while (index < lines.length && !/^\s*```/.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;

      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.append(code);
      container.append(pre);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const element = document.createElement(`h${heading[1].length}`);
      appendInlineMarkdown(element, heading[2]);
      container.append(element);
      index += 1;
      continue;
    }

    if (/^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(line)) {
      container.append(document.createElement("hr"));
      index += 1;
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quoteLines = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/, ""));
        index += 1;
      }
      const quote = document.createElement("blockquote");
      const paragraph = document.createElement("p");
      appendInlineMarkdown(paragraph, quoteLines.join(" "));
      quote.append(paragraph);
      container.append(quote);
      continue;
    }

    const listMatch = line.match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
    if (listMatch) {
      const isOrdered = listMatch[2] !== undefined;
      const list = document.createElement(isOrdered ? "ol" : "ul");
      while (index < lines.length) {
        const itemMatch = lines[index].match(
          /^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/,
        );
        if (!itemMatch || (itemMatch[2] !== undefined) !== isOrdered) break;
        const item = document.createElement("li");
        appendInlineMarkdown(item, itemMatch[3]);
        list.append(item);
        index += 1;
      }
      container.append(list);
      continue;
    }

    const paragraphLines = [];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*```/.test(lines[index]) &&
      !/^\s{0,3}#{1,6}\s+/.test(lines[index]) &&
      !/^\s*>\s?/.test(lines[index]) &&
      !/^\s*(?:[-+*]|\d+[.)])\s+/.test(lines[index]) &&
      !/^\s*(?:(?:-{3,})|(?:\*{3,})|(?:_{3,}))\s*$/.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }
    const paragraph = document.createElement("p");
    paragraphLines.forEach((paragraphLine, lineIndex) => {
      if (lineIndex > 0) paragraph.append(document.createElement("br"));
      appendInlineMarkdown(paragraph, paragraphLine);
    });
    container.append(paragraph);
  }
}

function createMessageElement({ role, text }) {
  const message = document.createElement("article");
  message.className = `message ${role}-message`;

  const avatar = document.createElement("div");
  avatar.className = `message-avatar ${role}-message-avatar`;
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "assistant" ? "✳" : "나";

  const content = document.createElement("div");
  content.className = "message-content";

  const author = document.createElement("p");
  author.className = "message-author";
  author.textContent = role === "assistant" ? "AI CBI" : "나";

  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (role === "assistant") {
    renderMarkdown(bubble, text);
    bubble.classList.add("markdown-content");
  } else {
    bubble.textContent = text;
  }

  content.append(author, bubble);
  message.append(avatar, content);
  return { element: message, bubble };
}

function addTypingIndicator() {
  const { element, bubble } = createMessageElement({
    role: "assistant",
    text: "",
  });
  bubble.classList.add("typing-bubble");
  bubble.setAttribute("role", "status");
  bubble.setAttribute("aria-label", "AI가 답변을 작성 중입니다.");

  for (let index = 0; index < 3; index += 1) {
    const dot = document.createElement("span");
    dot.className = "typing-dot";
    dot.setAttribute("aria-hidden", "true");
    bubble.append(dot);
  }

  conversation.append(element);
  conversation.scrollTop = conversation.scrollHeight;
  return bubble;
}

function renderConversation() {
  conversation.replaceChildren();
  const chat = getActiveChat();

  if (!chat) {
    const { element } = createMessageElement({
      role: "assistant",
      text: WELCOME_MESSAGE,
    });
    conversation.append(element);
    return;
  }

  chat.messages.forEach((message) => {
    const rendered = createMessageElement(message);
    conversation.append(rendered.element);
    const pending = pendingReplies.get(chat.id);
    if (pending?.message === message) pending.bubble = rendered.bubble;
  });

  const pending = pendingReplies.get(chat.id);
  if (pending && !pending.started) {
    pending.bubble = addTypingIndicator();
  }
  conversation.scrollTop = conversation.scrollHeight;
}

function formatUpdatedAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderHistory() {
  historyList.replaceChildren();
  historyCount.textContent = String(chats.length);
  historyEmpty.hidden = chats.length > 0;

  chats.forEach((chat) => {
    const button = document.createElement("button");
    button.className = "history-item";
    button.type = "button";
    button.setAttribute("aria-current", chat.id === activeChatId ? "true" : "false");

    const title = document.createElement("span");
    title.className = "history-item-title";
    title.textContent = chat.title;

    const date = document.createElement("span");
    date.className = "history-item-date";
    date.textContent = formatUpdatedAt(chat.updatedAt);

    button.append(title, date);
    button.addEventListener("click", () => {
      activeChatId = chat.id;
      saveChats();
      renderHistory();
      renderConversation();
      sendButton.disabled = pendingReplies.has(chat.id);
    });
    historyList.append(button);
  });
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
}

function finishPendingReply(chatId, pending) {
  window.clearInterval(pending.interval);
  pendingReplies.delete(chatId);
  const chat = chats.find((savedChat) => savedChat.id === chatId);
  if (chat) markChatUpdated(chat);
  if (activeChatId === chatId) {
    pending.bubble?.removeAttribute("aria-live");
    sendButton.disabled = false;
    input.focus();
  }
  saveChats();
  renderHistory();
}

function startReply(chat) {
  const pending = pendingReplies.get(chat.id);
  if (!pending) return;

  pending.started = true;
  pending.lastRenderedAt = Date.now();
  pending.lastSavedAt = pending.lastRenderedAt;
  pending.bubble.classList.remove("typing-bubble");
  pending.bubble.removeAttribute("role");
  pending.bubble.removeAttribute("aria-label");
  pending.bubble.setAttribute("aria-live", "polite");

  const tokens = DEMO_REPLY.split(/(\s+)/).filter(Boolean);
  pending.interval = window.setInterval(() => {
    pending.message.text += tokens[pending.tokenIndex];
    pending.tokenIndex += 1;
    const now = Date.now();
    const isComplete = pending.tokenIndex >= tokens.length;

    if (
      isComplete ||
      now - pending.lastRenderedAt >= STREAM_RENDER_INTERVAL_MS
    ) {
      renderMarkdown(pending.bubble, pending.message.text);
      pending.lastRenderedAt = now;

      if (activeChatId === chat.id) {
        conversation.scrollTop = conversation.scrollHeight;
      }
    }

    if (!isComplete && now - pending.lastSavedAt >= STREAM_SAVE_INTERVAL_MS) {
      saveChats();
      pending.lastSavedAt = now;
    }

    if (isComplete) {
      pending.bubble.removeAttribute("aria-live");
      finishPendingReply(chat.id, pending);
    }
  }, 75);
}

function sendMessage(text) {
  const messageText = text.trim();
  if (!messageText || sendButton.disabled) return;

  const chat = getActiveChat() ?? createChat();
  const userMessage = { role: "user", text: messageText };
  chat.messages.push(userMessage);
  if (chat.messages.length === 1) {
    chat.title =
      messageText.length > 36 ? `${messageText.slice(0, 36)}…` : messageText;
  }
  markChatUpdated(chat);
  activeChatId = chat.id;

  input.value = "";
  resizeInput();
  renderConversation();
  renderHistory();
  saveChats();
  sendButton.disabled = true;

  const pending = {
    message: { role: "assistant", text: "" },
    bubble: addTypingIndicator(),
    started: false,
    tokenIndex: 0,
    timeout: undefined,
    interval: undefined,
  };
  chat.messages.push(pending.message);
  pendingReplies.set(chat.id, pending);
  pending.timeout = window.setTimeout(() => startReply(chat), 350);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isListening) {
    suppressVoiceEndStatus = true;
    acceptVoiceResults = false;
    recognition.stop();
    setVoiceStatus("");
  }
  sendMessage(input.value);
});

voiceButton.addEventListener("click", () => {
  if (!recognition) return;
  if (isListening) {
    recognition.stop();
  } else {
    startVoiceInput();
  }
});

input.addEventListener("input", resizeInput);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

suggestions.forEach((suggestion) => {
  suggestion.addEventListener("click", () => {
    sendMessage(suggestion.dataset.prompt ?? "");
  });
});

newChatButton.addEventListener("click", () => {
  if (isListening) {
    suppressVoiceEndStatus = true;
    acceptVoiceResults = false;
    recognition.stop();
    setVoiceStatus("");
  }
  activeChatId = null;
  input.value = "";
  resizeInput();
  renderHistory();
  renderConversation();
  saveChats();
  sendButton.disabled = false;
  input.focus();
});

loadChats();
renderHistory();
renderConversation();
sendButton.disabled = pendingReplies.has(activeChatId);
