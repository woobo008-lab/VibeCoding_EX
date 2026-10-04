const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?",
};
const AMBIGUOUS = /[lI1O0]/g;

const passwordOutput = document.querySelector("#password");
const lengthInput = document.querySelector("#length");
const lengthValue = document.querySelector("#length-value");
const ambiguousInput = document.querySelector("#ambiguous");
const statusText = document.querySelector("#status");
const strengthFill = document.querySelector("#strength-fill");
const strengthText = document.querySelector("#strength-text");
const toggleButton = document.querySelector("#toggle-button");
const eyeOpen = document.querySelector("#eye-open");
const eyeClosed = document.querySelector("#eye-closed");

let currentPassword = "";
let passwordVisible = true;

function renderPassword() {
  passwordOutput.textContent = passwordVisible
    ? currentPassword
    : "•".repeat(currentPassword.length);
  const label = passwordVisible ? "비밀번호 숨기기" : "비밀번호 보기";
  toggleButton.setAttribute("aria-pressed", String(passwordVisible));
  toggleButton.setAttribute("aria-label", label);
  toggleButton.title = label;
  eyeOpen.hidden = !passwordVisible;
  eyeClosed.hidden = passwordVisible;
}
const checkboxes = Object.keys(SETS).map((key) => document.querySelector(`#${key}`));

// 나머지 연산 편향을 피하기 위해 범위를 벗어난 값은 버립니다.
function randomInt(max) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buffer = new Uint32Array(1);
  do {
    crypto.getRandomValues(buffer);
  } while (buffer[0] >= limit);
  return buffer[0] % max;
}

function shuffle(items) {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function activeSets() {
  return Object.keys(SETS)
    .filter((key) => document.querySelector(`#${key}`).checked)
    .map((key) => (ambiguousInput.checked ? SETS[key].replace(AMBIGUOUS, "") : SETS[key]));
}

function generatePassword(length, sets) {
  const all = sets.join("");
  const chars = sets.map((set) => set[randomInt(set.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  return shuffle(chars).join("");
}

function setStatus(message, isError = false) {
  statusText.textContent = message;
  statusText.classList.toggle("error", isError);
}

// 무작위 생성이므로 길이 × log2(전체 문자 수)로 엔트로피를 계산합니다.
function renderStrength(length, sets) {
  const poolSize = new Set(sets.join("")).size;
  const bits = poolSize > 0 ? Math.round(length * Math.log2(poolSize)) : 0;
  const levels = [
    { min: 0, label: "매우 약함", color: "#dc2626", width: 15 },
    { min: 40, label: "약함", color: "#ea580c", width: 35 },
    { min: 60, label: "보통", color: "#ca8a04", width: 55 },
    { min: 80, label: "강함", color: "#16a34a", width: 80 },
    { min: 100, label: "매우 강함", color: "#047857", width: 100 },
  ];
  const level = poolSize === 0 ? null : levels.filter((item) => bits >= item.min).pop();
  strengthFill.style.width = level ? `${level.width}%` : "0";
  strengthFill.style.background = level?.color ?? "transparent";
  strengthText.textContent = level ? `보안 강도: ${level.label} (${bits}비트)` : "";
}

function render() {
  const sets = activeSets();
  if (sets.length === 0) {
    currentPassword = "";
    renderPassword();
    renderStrength(0, sets);
    setStatus("문자 종류를 하나 이상 선택해 주세요.", true);
    return;
  }
  const length = Number(lengthInput.value);
  currentPassword = generatePassword(length, sets);
  renderPassword();
  renderStrength(length, sets);
  setStatus("");
}

lengthInput.addEventListener("input", () => {
  lengthValue.textContent = lengthInput.value;
  render();
});
[...checkboxes, ambiguousInput].forEach((input) => input.addEventListener("change", render));
document.querySelector("#generate-button").addEventListener("click", render);

toggleButton.addEventListener("click", () => {
  passwordVisible = !passwordVisible;
  renderPassword();
});

document.querySelector("#copy-button").addEventListener("click", async () => {
  const password = currentPassword;
  if (!password) return;
  try {
    await navigator.clipboard.writeText(password);
    setStatus("복사했습니다.");
  } catch {
    setStatus("복사하지 못했습니다. 직접 선택해서 복사해 주세요.", true);
  }
});

render();
