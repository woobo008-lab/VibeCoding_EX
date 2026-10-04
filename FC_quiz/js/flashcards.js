window.FCFlashcards = (() => {
const flashcards = [
  {
    term: "인공지능 (AI)",
    answer: "컴퓨터가 사람의 지능이 필요한 일을 수행하도록 만드는 기술",
    explanation:
      "학습, 추론, 문제 해결, 언어 이해처럼 사람의 지적 능력이 필요했던 작업을 컴퓨터가 하도록 만들어요.",
  },
  {
    term: "머신러닝",
    answer: "데이터에서 패턴을 학습해 예측이나 판단을 하는 방법",
    explanation:
      "모든 규칙을 사람이 일일이 작성하는 대신, 예시 데이터를 통해 모델이 규칙과 패턴을 찾아요.",
  },
  {
    term: "딥러닝",
    answer: "여러 층의 인공 신경망으로 데이터의 복잡한 특징을 학습하는 방법",
    explanation:
      "머신러닝의 한 분야로, 이미지 인식과 음성 처리, 자연어 처리 등에서 널리 활용돼요.",
  },
  {
    term: "생성형 AI",
    answer: "학습한 패턴을 바탕으로 새로운 콘텐츠를 만들어 내는 AI",
    explanation:
      "글, 이미지, 음악, 음성, 영상, 코드처럼 새로운 결과물을 생성할 수 있어요.",
  },
  {
    term: "대규모 언어 모델 (LLM)",
    answer: "많은 텍스트를 학습해 사람의 언어를 처리하는 대형 AI 모델",
    explanation:
      "문맥을 바탕으로 질문에 답하거나 글을 요약하고 새로운 문장을 만들 수 있어요.",
  },
  {
    term: "프롬프트",
    answer: "AI에게 원하는 작업을 설명하는 입력이나 지시",
    explanation:
      "목표, 맥락, 조건, 원하는 출력 형식을 구체적으로 적으면 더 유용한 답을 얻는 데 도움이 돼요.",
  },
  {
    term: "토큰",
    answer: "언어 모델이 텍스트를 처리할 때 사용하는 작은 단위",
    explanation:
      "토큰 하나는 단어 전체일 수도 있고 단어의 일부나 문장 부호일 수도 있어요.",
  },
  {
    term: "환각 (할루시네이션)",
    answer: "AI가 사실이 아닌 내용을 그럴듯하게 생성하는 현상",
    explanation:
      "AI의 답변은 자신감 있어 보여도 틀릴 수 있으므로 중요한 정보는 신뢰할 수 있는 자료로 확인해야 해요.",
  },
  {
    term: "검색 증강 생성 (RAG)",
    answer: "관련 자료를 검색해 참고한 뒤 답변을 생성하는 방법",
    explanation:
      "언어 모델이 답변을 만들기 전에 외부 문서나 최신 정보를 찾아 활용하도록 해요.",
  },
  {
    term: "추론 (Inference)",
    answer: "학습된 AI 모델이 새로운 입력을 받아 결과를 내는 과정",
    explanation:
      "학습이 끝난 모델에 질문이나 데이터를 넣고 예측, 분류, 답변 같은 결과를 얻는 단계예요.",
  },
];

class FlashcardSession {
  constructor(cards) {
    this.allCards = cards;
    this.reset();
  }

  get currentCard() {
    return this.cards[0] ?? null;
  }

  get totalCount() {
    return this.allCards.length;
  }

  get memorizedCount() {
    return this.totalCount - this.cards.length;
  }

  reset() {
    this.cards = [...this.allCards];
  }

  replaceCards(cards) {
    this.allCards = cards.map((card) => ({ ...card }));
    this.reset();
  }

  reviewCurrent() {
    if (this.cards.length <= 1) return false;
    this.cards.push(this.cards.shift());
    return true;
  }

  memorizeCurrent() {
    if (this.cards.length === 0) return null;
    return this.cards.shift();
  }
}

return { flashcards, FlashcardSession };
})();
