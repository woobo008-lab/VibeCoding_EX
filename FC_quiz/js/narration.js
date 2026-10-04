window.FCNarration = (() => {
  class Narration {
    constructor(toggleButton, label) {
      this.toggleButton = toggleButton;
      this.label = label;
      this.enabled = true;
      this.synthesis = window.speechSynthesis;
      this.isSupported =
        Boolean(this.synthesis) && typeof window.SpeechSynthesisUtterance === "function";
      this.koreanVoice = null;
      this.voiceListLoaded = false;

      this.toggleButton.addEventListener("click", () => this.toggle());

      if (!this.isSupported) {
        this.enabled = false;
        this.toggleButton.disabled = true;
        this.toggleButton.setAttribute(
          "aria-label",
          "이 브라우저는 안내 음성을 지원하지 않습니다.",
        );
        this.toggleButton.setAttribute("aria-pressed", "false");
        this.label.textContent = "음성 미지원";
        return;
      }

      this.refreshVoice();
      this.synthesis.onvoiceschanged = () => this.refreshVoice();
    }

    refreshVoice() {
      const voices = this.synthesis.getVoices();
      this.voiceListLoaded = true;
      this.koreanVoice =
        voices.find((voice) => voice.lang.toLowerCase().startsWith("ko")) ?? null;
    }

    toggle() {
      if (!this.isSupported) return;

      this.enabled = !this.enabled;
      if (!this.enabled) this.synthesis.cancel();
      this.updateToggle();

      if (this.enabled) {
        this.speak("안내 음성을 켰습니다.");
      }
    }

    start() {
      this.speak(
        "AI 용어 플래시카드 학습을 시작합니다. 카드에 표시된 용어를 읽고 뜻을 생각해 보세요. 카드를 누르면 뜻과 설명을 들을 수 있습니다. 암기함을 누르면 목록에서 제거되고, 다시 볼래요를 누르면 카드 덱 뒤로 이동합니다.",
      );
    }

    newDeck(count) {
      this.speak(`위키백과에서 새 플래시카드 ${count}장을 가져왔습니다. 학습을 시작합니다.`);
    }

    flip(card, isFlipped) {
      if (!card) return;
      this.speak(
        isFlipped
          ? `${card.term}. ${card.answer}. 설명. ${card.explanation}`
          : `${card.term}. 용어를 보고 뜻을 생각한 다음 카드를 눌러 답을 확인하세요.`,
      );
    }

    review(card, moved, remaining) {
      const message = moved
        ? `${card.term} 카드를 덱의 맨 뒤로 보냈습니다. 남은 카드는 ${remaining}장입니다.`
        : `${card.term}. 다시 볼 카드가 한 장 남아 있어 순서를 유지합니다.`;
      this.speak(message);
    }

    memorized(card, remaining, memorized, isComplete) {
      const message = isComplete
        ? `모든 카드를 암기했습니다. 총 ${memorized}장입니다. 새로운 카드로 학습하려면 위키백과에서 새 카드 10장 만들기를 누르세요.`
        : `${card.term} 카드를 암기 목록에서 제거했습니다. 남은 카드 ${remaining}장, 암기 완료 ${memorized}장입니다.`;
      this.speak(message);
    }

    updateToggle() {
      this.toggleButton.setAttribute("aria-pressed", String(this.enabled));
      this.toggleButton.setAttribute(
        "aria-label",
        this.enabled ? "안내 음성 끄기" : "안내 음성 켜기",
      );
      this.label.textContent = this.enabled ? "안내 음성 켜짐" : "안내 음성 꺼짐";
    }

    speak(text) {
      if (!this.enabled || !this.isSupported) return;

      this.synthesis.cancel();
      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.lang = "ko-KR";
      utterance.rate = 2;
      utterance.pitch = 1;

      if (!this.voiceListLoaded) this.refreshVoice();
      if (this.koreanVoice) utterance.voice = this.koreanVoice;

      utterance.onerror = (event) => {
        if (event.error === "canceled" || event.error === "interrupted") return;
        this.enabled = false;
        this.updateToggle();
        this.label.textContent = "음성 재생 오류";
        this.toggleButton.setAttribute(
          "aria-label",
          "안내 음성 재생에 실패했습니다. 다시 켜서 시도하세요.",
        );
        console.error("안내 음성을 재생할 수 없습니다.", event.error);
      };

      this.synthesis.speak(utterance);
    }
  }

  return { Narration };
})();
