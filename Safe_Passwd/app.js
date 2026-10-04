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

function render() {
  const sets = activeSets();
  if (sets.length === 0) {
    passwordOutput.textContent = "";
    setStatus("문자 종류를 하나 이상 선택해 주세요.", true);
    return;
  }
  passwordOutput.textContent = generatePassword(Number(lengthInput.value), sets);
  setStatus("");
}

lengthInput.addEventListener("input", () => {
  lengthValue.textContent = lengthInput.value;
  render();
});
[...checkboxes, ambiguousInput].forEach((input) => input.addEventListener("change", render));
document.querySelector("#generate-button").addEventListener("click", render);

document.querySelector("#copy-button").addEventListener("click", async () => {
  const password = passwordOutput.textContent;
  if (!password) return;
  try {
    await navigator.clipboard.writeText(password);
    setStatus("복사했습니다.");
  } catch {
    setStatus("복사하지 못했습니다. 직접 선택해서 복사해 주세요.", true);
  }
});

render();
