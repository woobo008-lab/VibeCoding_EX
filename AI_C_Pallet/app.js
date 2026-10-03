const form = document.querySelector("#palette-form");
const input = document.querySelector("#theme-input");
const swatches = document.querySelector("#swatches");
const themeLabel = document.querySelector("#theme-label");
const shuffleButton = document.querySelector("#shuffle-button");
const generateButton = form.querySelector('button[type="submit"]');
const status = document.querySelector("#status");
let currentTheme = "";
let audioContext;
let requestInProgress = false;

function renderPalette(theme, colors) {
  const fragment = document.createDocumentFragment();

  colors.forEach((color) => {
    const card = document.createElement("div");
    card.className = "swatch";
    card.style.backgroundColor = color;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `${color.toUpperCase()} 색상 코드 복사`);

    const label = document.createElement("span");
    label.className = "swatch-label";
    label.textContent = color.toUpperCase();

    const feedback = document.createElement("span");
    feedback.className = "copy-feedback";
    feedback.setAttribute("aria-live", "polite");

    card.append(label, feedback);
    card.addEventListener("click", () => copyColor(card, color));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        copyColor(card, color);
      }
    });
    fragment.append(card);
  });

  swatches.replaceChildren(fragment);
  themeLabel.textContent = theme;
}

async function copyColor(card, color) {
  try {
    await navigator.clipboard.writeText(color.toUpperCase());
    playCopySound();
    clearTimeout(card.copyFeedbackTimeout);
    card.querySelector(".copy-feedback").textContent = "복사됨!";
    card.classList.add("is-copied");
    card.copyFeedbackTimeout = setTimeout(() => {
      card.classList.remove("is-copied");
      card.querySelector(".copy-feedback").textContent = "";
    }, 1_200);
    status.dataset.error = "false";
    status.textContent = "";
  } catch {
    status.dataset.error = "true";
    status.textContent = "클립보드에 복사하지 못했습니다. 브라우저의 클립보드 권한을 확인해 주세요.";
  }
}

function playCopySound() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    console.warn("이 브라우저는 복사 효과음을 지원하지 않습니다.");
    return;
  }

  try {
    audioContext ??= new AudioContextClass();
    if (audioContext.state === "suspended") {
      audioContext.resume().catch((error) => {
        console.warn("복사 효과음을 재생하지 못했습니다.", error);
      });
    }

    const startTime = audioContext.currentTime;
    [880, 1174].forEach((frequency, index) => {
      const start = startTime + index * 0.055;
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, start);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.035, start + 0.015);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + 0.2);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.21);
    });
  } catch (error) {
    console.warn("복사 효과음을 재생하지 못했습니다.", error);
  }
}

async function requestPalette(theme, variation = false) {
  if (requestInProgress) return;
  requestInProgress = true;
  generateButton.disabled = true;
  shuffleButton.disabled = true;
  status.dataset.error = "false";
  status.textContent = variation
    ? "새로운 색상 조합을 만들고 있어요..."
    : "테마를 AI에 보내 팔레트를 만들고 있어요...";

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 35_000);

  try {
    const response = await fetch("/api/palette", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, variation }),
      signal: controller.signal
    });
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        `서버가 읽을 수 없는 응답을 반환했습니다 (HTTP ${response.status}). 서버 상태를 확인한 뒤 다시 시도해 주세요.`
      );
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      throw new Error("서버 응답 형식이 올바르지 않습니다. 잠시 후 다시 시도해 주세요.");
    }
    if (!response.ok) {
      throw new Error(
        typeof result.error === "string"
          ? result.error
          : `팔레트 API 요청이 실패했습니다 (HTTP ${response.status}). 잠시 후 다시 시도해 주세요.`
      );
    }
    if (
      !Array.isArray(result.colors) ||
      result.colors.length !== 5 ||
      result.colors.some((color) => typeof color !== "string" || !/^#[\da-fA-F]{6}$/.test(color))
    ) {
      throw new Error("팔레트 응답 형식이 올바르지 않습니다. 다시 생성해 주세요.");
    }

    currentTheme = theme;
    renderPalette(theme, result.colors);
    status.textContent = "";
  } catch (error) {
    status.dataset.error = "true";
    if (controller.signal.aborted) {
      status.textContent = "요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.";
    } else if (error instanceof TypeError) {
      status.textContent = "서버에 연결하지 못했습니다. 서버가 실행 중인지와 네트워크 연결을 확인해 주세요.";
    } else {
      status.textContent = error instanceof Error
        ? error.message
        : "팔레트 요청 중 알 수 없는 오류가 발생했습니다. 다시 시도해 주세요.";
    }
  } finally {
    clearTimeout(timeoutId);
    requestInProgress = false;
    generateButton.disabled = false;
    shuffleButton.disabled = !currentTheme;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const theme = input.value.trim();
  if (!theme) {
    input.focus();
    return;
  }

  await requestPalette(theme);
});

shuffleButton.addEventListener("click", async () => {
  if (!currentTheme) return;
  await requestPalette(currentTheme, true);
});
