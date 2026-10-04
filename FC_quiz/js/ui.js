window.FCUI = (() => {
class FlashcardUI {
  constructor() {
    this.introScreen = document.querySelector("#intro-screen");
    this.studyScreen = document.querySelector("#study-screen");
    this.remainingCount = document.querySelector("#remaining-count");
    this.memorizedCount = document.querySelector("#memorized-count");
    this.flashcardProgress = document.querySelector("#flashcard-progress");
    this.flashcardProgressFill = document.querySelector("#flashcard-progress-fill");
    this.flashcardTerm = document.querySelector("#flashcard-term");
    this.flashcardAnswer = document.querySelector("#flashcard-answer");
    this.flashcardExplanation = document.querySelector("#flashcard-explanation");
    this.flashcardSource = document.querySelector("#flashcard-source");
    this.flashcardToggle = document.querySelector("#flashcard-toggle");
    this.flashcardBack = document.querySelector(".flashcard-back");
    this.confidenceActions = document.querySelector("#confidence-actions");
    this.flashcardEmpty = document.querySelector("#flashcard-empty");
    this.reviewButton = document.querySelector("#review-button");
    this.knownButton = document.querySelector("#known-button");
    this.restartButton = document.querySelector("#restart-study-button");
    this.appStatus = document.querySelector("#app-status");
    this.generateButton = this.restartButton;
  }

  showStudy() {
    this.introScreen.hidden = true;
    this.studyScreen.hidden = false;
  }

  renderFlashcard(study) {
    const card = study.currentCard;
    const isComplete = card === null;

    this.remainingCount.textContent = `${study.cards.length} / ${study.totalCount}`;
    this.memorizedCount.textContent = `${study.memorizedCount} / ${study.totalCount}`;
    this.flashcardProgress.setAttribute("aria-valuemax", study.totalCount);
    this.flashcardProgress.setAttribute("aria-valuenow", study.memorizedCount);
    this.flashcardProgress.setAttribute(
      "aria-valuetext",
      `${study.memorizedCount}장 암기, ${study.cards.length}장 남음`,
    );
    this.flashcardProgressFill.style.width =
      `${(study.memorizedCount / study.totalCount) * 100}%`;
    this.flashcardToggle.hidden = isComplete;
    this.flashcardEmpty.hidden = !isComplete;
    this.confidenceActions.hidden = true;
    this.flashcardToggle.classList.remove("is-flipped");
    this.flashcardToggle.setAttribute("aria-pressed", "false");
    this.flashcardBack.setAttribute("aria-hidden", "true");

    if (isComplete) {
      this.restartButton.focus();
      return;
    }

    this.flashcardTerm.textContent = card.term;
    this.flashcardAnswer.textContent = card.answer;
    this.flashcardExplanation.textContent = card.explanation;
    this.flashcardSource.hidden = !card.sourceUrl;
    if (card.sourceUrl) {
      this.flashcardSource.href = card.sourceUrl;
      this.flashcardSource.textContent = `출처: 위키백과 「${card.sourceTitle || card.term}」 문서 (CC BY-SA 4.0)`;
    }
    this.flashcardToggle.setAttribute(
      "aria-label",
      `${card.term}. 눌러서 뜻을 확인하세요.`,
    );
    this.flashcardToggle.focus();
  }

  toggleFlashcard(study) {
    if (!study.currentCard) return;
    const isFlipped = this.flashcardToggle.classList.toggle("is-flipped");

    this.flashcardToggle.setAttribute("aria-pressed", String(isFlipped));
    this.flashcardToggle.setAttribute(
      "aria-label",
      isFlipped
        ? `${study.currentCard.term}의 뜻. 눌러서 용어로 돌아가세요.`
        : `${study.currentCard.term}. 눌러서 뜻을 확인하세요.`,
    );
    this.flashcardBack.setAttribute("aria-hidden", String(!isFlipped));
    this.confidenceActions.hidden = !isFlipped;
    if (isFlipped) this.knownButton.focus();
  }

  setStatus(message, isError = false) {
    this.appStatus.textContent = message;
    this.appStatus.classList.toggle("is-error", isError);
    this.appStatus.hidden = !message;
  }

  setGenerating(isGenerating) {
    this.generateButton.disabled = isGenerating;
    this.generateButton.textContent = isGenerating
      ? "새 카드 만드는 중..."
      : "위키백과에서 새 카드 10장 만들기 ↻";
    this.generateButton.setAttribute(
      "aria-label",
      isGenerating
        ? "위키백과에서 새 플래시카드를 가져오는 중"
        : "위키백과에서 새로운 플래시카드 10장 만들기",
    );
  }
}

return { FlashcardUI };
})();
