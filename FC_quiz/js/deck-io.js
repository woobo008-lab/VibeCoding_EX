window.FCDeckIO = (() => {
  const FORMAT = "fc-quiz-flashcards";
  const VERSION = 1;
  const CARD_COUNT = 10;

  function validateDeck(data) {
    if (!data || data.format !== FORMAT || data.version !== VERSION) {
      throw new Error("지원하지 않는 카드 덱입니다.");
    }
    if (!Array.isArray(data.cards) || data.cards.length !== CARD_COUNT) {
      throw new Error(`카드 파일에는 정확히 ${CARD_COUNT}장이 있어야 합니다.`);
    }

    const seenTerms = new Set();
    return data.cards.map((card, index) => {
      if (!card || typeof card !== "object" || Array.isArray(card)) {
        throw new Error(`${index + 1}번째 카드 형식이 올바르지 않습니다.`);
      }

      const term = typeof card.term === "string" ? card.term.trim() : "";
      const answer = typeof card.answer === "string" ? card.answer.trim() : "";
      const explanation =
        typeof card.explanation === "string" ? card.explanation.trim() : "";

      if (!term || term.length > 300 || !answer || answer.length > 2000) {
        throw new Error(`${index + 1}번째 카드의 용어나 답이 없거나 너무 깁니다.`);
      }
      if (explanation.length > 2000) {
        throw new Error(`${index + 1}번째 카드의 설명이 너무 깁니다.`);
      }

      const normalizedTerm = term.normalize("NFKC").toLocaleLowerCase("ko-KR");
      if (seenTerms.has(normalizedTerm)) {
        throw new Error(`중복된 카드 용어가 있습니다: ${term}`);
      }
      seenTerms.add(normalizedTerm);

      const normalizedCard = { term, answer, explanation };
      if (card.sourceTitle !== undefined) {
        if (typeof card.sourceTitle !== "string" || card.sourceTitle.length > 300) {
          throw new Error(`${index + 1}번째 카드의 출처 이름이 올바르지 않습니다.`);
        }
        normalizedCard.sourceTitle = card.sourceTitle;
      }
      if (card.sourceUrl !== undefined) {
        let sourceUrl;
        try {
          sourceUrl = new URL(card.sourceUrl);
        } catch {
          throw new Error(`${index + 1}번째 카드의 출처 주소가 올바르지 않습니다.`);
        }
        if (
          sourceUrl.protocol !== "https:" ||
          (sourceUrl.hostname !== "wikipedia.org" &&
            !sourceUrl.hostname.endsWith(".wikipedia.org"))
        ) {
          throw new Error(`${index + 1}번째 카드의 출처는 위키백과 HTTPS 주소여야 합니다.`);
        }
        normalizedCard.sourceUrl = sourceUrl.href;
      }
      return normalizedCard;
    });
  }

  return { validateDeck };
})();
