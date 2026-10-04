(() => {
const { flashcards, FlashcardSession } = window.FCFlashcards;
const { FlashcardUI } = window.FCUI;
const { Narration } = window.FCNarration;

const study = new FlashcardSession(flashcards);
const ui = new FlashcardUI();
const narration = new Narration(
  document.querySelector("#narration-toggle"),
  document.querySelector("#narration-label"),
);
const startButton = document.querySelector("#start-button");
const flashcardToggle = document.querySelector("#flashcard-toggle");
const reviewButton = document.querySelector("#review-button");
const knownButton = document.querySelector("#known-button");
const restartButton = document.querySelector("#restart-study-button");
const driveConnectButton = document.querySelector("#drive-connect-button");
const driveSaveButton = document.querySelector("#drive-save-button");
const driveLoadButton = document.querySelector("#drive-load-button");

function renderDriveConnection() {
  const isConnected = window.FCGoogleDrive.connected;
  driveConnectButton.textContent = isConnected ? "Drive 연결 해제" : "Drive 연결";
  driveConnectButton.setAttribute(
    "aria-label",
    isConnected ? "Google Drive 연결 해제" : "Google Drive 연결",
  );
  driveSaveButton.hidden = !isConnected;
  driveLoadButton.hidden = !isConnected;
  driveSaveButton.disabled = !isConnected;
  driveLoadButton.disabled = !isConnected;
}

async function connectDrive() {
  try {
    if (window.FCGoogleDrive.connected) {
      window.FCGoogleDrive.disconnect();
      ui.setStatus("Google Drive 연결을 해제했습니다.");
    } else {
      const connected = await window.FCGoogleDrive.connect();
      if (!connected) {
        ui.setStatus("Google Drive 연결을 취소했습니다.");
        return;
      }
      ui.setStatus("Google Drive에 연결했습니다. FC_quiz 폴더에 저장하거나 불러올 수 있습니다.");
    }
  } catch (error) {
    ui.setStatus(error.message, true);
    console.error("Google Drive 연결에 실패했습니다.", error);
  } finally {
    renderDriveConnection();
  }
}

async function saveDeckToDrive() {
  driveSaveButton.disabled = true;
  try {
    await window.FCGoogleDrive.save(study.allCards);
    ui.setStatus(`카드 ${study.totalCount}장을 Google Drive의 FC_quiz 폴더에 저장했습니다.`);
  } catch (error) {
    ui.setStatus(error.message, true);
    console.error("Google Drive 카드 저장에 실패했습니다.", error);
  } finally {
    renderDriveConnection();
  }
}

async function loadDeckFromDrive() {
  driveLoadButton.disabled = true;
  try {
    const cards = await window.FCGoogleDrive.load();
    if (!window.confirm("Google Drive의 카드 10장으로 현재 덱을 교체할까요?")) return;
    study.replaceCards(cards);
    ui.showStudy();
    ui.renderFlashcard(study);
    ui.setStatus(`Google Drive에서 카드 ${cards.length}장을 불러왔습니다.`);
  } catch (error) {
    ui.setStatus(error.message, true);
    console.error("Google Drive 카드 불러오기에 실패했습니다.", error);
  } finally {
    renderDriveConnection();
  }
}

async function generateNewDeck() {
  ui.setGenerating(true);
  ui.setStatus("위키백과에서 중복되지 않는 새 카드 10장을 찾고 있습니다.");

  try {
    const cards = await window.FCWikipedia.generateFlashcards(study.allCards);
    study.replaceCards(cards);
    ui.showStudy();
    ui.renderFlashcard(study);
    ui.setStatus("위키백과에서 새 카드 10장을 만들었습니다.");
    narration.newDeck(cards.length);
  } catch (error) {
    ui.showStudy();
    ui.renderFlashcard(study);
    ui.setStatus(error.message, true);
    console.error("새 플래시카드를 만들지 못했습니다.", error);
  } finally {
    ui.setGenerating(false);
  }
}

function startStudy() {
  study.reset();
  ui.showStudy();
  ui.renderFlashcard(study);
  narration.start();
}

function reviewFlashcard() {
  const card = study.currentCard;
  const moved = study.reviewCurrent();
  ui.renderFlashcard(study);
  narration.review(card, moved, study.cards.length);
}

function memorizeFlashcard() {
  const card = study.memorizeCurrent();
  ui.renderFlashcard(study);
  narration.memorized(
    card,
    study.cards.length,
    study.memorizedCount,
    study.cards.length === 0,
  );
}

startButton.addEventListener("click", startStudy);
flashcardToggle.addEventListener("click", () => {
  const card = study.currentCard;
  ui.toggleFlashcard(study);
  narration.flip(card, flashcardToggle.getAttribute("aria-pressed") === "true");
});
reviewButton.addEventListener("click", reviewFlashcard);
knownButton.addEventListener("click", memorizeFlashcard);
restartButton.addEventListener("click", generateNewDeck);
driveConnectButton.addEventListener("click", connectDrive);
driveSaveButton.addEventListener("click", saveDeckToDrive);
driveLoadButton.addEventListener("click", loadDeckFromDrive);
})();
