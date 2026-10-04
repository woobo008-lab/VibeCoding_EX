window.FCWikipedia = (() => {
  const API_URL = "https://ko.wikipedia.org/w/api.php";
  const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
  const SEARCH_TOPICS = [
    "인공지능",
    "기계 학습",
    "인공 신경망",
    "자연어 처리",
    "컴퓨터 비전",
    "음성 인식",
    "강화 학습",
    "기계 번역",
    "전문가 시스템",
    "생성형 인공지능",
    "대규모 언어 모델",
    "인공지능의 역사",
    "패턴 인식",
    "추천 시스템",
    "챗봇",
    "데이터 마이닝",
    "로봇공학",
    "컴퓨터 바둑",
    "지식 표현",
    "의사결정 트리",
    "서포트 벡터 머신",
    "진화 연산",
    "퍼지 논리",
    "광학 문자 인식",
    "자율 주행",
    "자연어 생성",
    "기계 지능",
    "계산 언어학",
    "지능형 에이전트",
    "자동 추론",
    "전이 학습",
    "생성적 적대 신경망",
    "컴퓨터 과학",
  ];

  function normalizeTitle(title) {
    return title
      .normalize("NFKC")
      .toLocaleLowerCase("ko-KR")
      .replace(/\([^)]*\)/g, "")
      .replace(/\s+/g, "")
      .replace(/[()[\]{}·_-]/g, "");
  }

  function shuffle(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  function normalizeExtract(extract) {
    return extract.replace(/\s+/g, " ").trim();
  }

  function firstSentence(extract) {
    const normalized = normalizeExtract(extract);
    const sentenceEnd = normalized.search(/[.!?。](?:\s|$)/u);
    return sentenceEnd === -1
      ? normalized
      : normalized.slice(0, sentenceEnd + 1).trim();
  }

  function shortenDefinition(sentence) {
    if (sentence.length <= 180) return sentence;

    const clauseEnd = Math.max(
      sentence.lastIndexOf(", ", 160),
      sentence.lastIndexOf("，", 160),
      sentence.lastIndexOf("; ", 160),
      sentence.lastIndexOf("；", 160),
    );
    if (clauseEnd >= 60) return `${sentence.slice(0, clauseEnd).trimEnd()}…`;
    return `${sentence.slice(0, 177).trimEnd()}...`;
  }

  function summarize(extract) {
    const sentences = extract
      .replace(/\s+/g, " ")
      .match(/[^.!?。]+[.!?。]?/gu)
      ?.map((sentence) => sentence.trim())
      .filter(Boolean) ?? [];
    let summary = "";

    for (const sentence of sentences) {
      const next = summary ? `${summary} ${sentence}` : sentence;
      if (next.length > 480) {
        if (!summary) return `${sentence.slice(0, 477).trimEnd()}...`;
        break;
      }
      summary = next;
      if (summary.length >= 240) break;
    }

    return summary || extract.trim().slice(0, 477);
  }

  async function getWikidataDescriptions(itemIds, signal) {
    if (itemIds.length === 0) return {};

    const parameters = new URLSearchParams({
      action: "wbgetentities",
      ids: [...new Set(itemIds)].join("|"),
      props: "descriptions",
      languages: "ko",
      format: "json",
      origin: "*",
    });
    const response = await fetch(`${WIKIDATA_API_URL}?${parameters}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`위키데이터 설명 조회에 실패했습니다 (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`위키데이터 조회 오류: ${data.error.info || data.error.code}`);
    }

    return Object.fromEntries(
      Object.entries(data.entities ?? {})
        .map(([itemId, entity]) => [
          itemId,
          entity.descriptions?.ko?.value?.trim() ?? "",
        ])
        .filter(([, description]) => description.length > 0 && description.length <= 180),
    );
  }

  async function searchTopic(topic, signal) {
    const parameters = new URLSearchParams({
      action: "query",
      generator: "search",
      gsrsearch: topic,
      gsrnamespace: "0",
      gsrlimit: "10",
      prop: "extracts|pageprops",
      ppprop: "wikibase_item",
      exintro: "1",
      exsentences: "4",
      format: "json",
      origin: "*",
    });
    parameters.set("explaintext", "1");

    const response = await fetch(`${API_URL}?${parameters}`, {
      signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`위키백과 검색에 실패했습니다 (HTTP ${response.status}).`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`위키백과 검색 오류: ${data.error.info || data.error.code}`);
    }

    const pages = Object.values(data.query?.pages ?? [])
      .filter((page) => {
        const extract = page.extract?.trim() ?? "";
        return (
          page.ns === 0 &&
          !page.missing &&
          extract.length >= 80 &&
          !/동음이의|명확화$/u.test(page.title)
        );
      });
    let descriptions = {};
    try {
      descriptions = await getWikidataDescriptions(
        pages.map((page) => page.pageprops?.wikibase_item).filter(Boolean),
        signal,
      );
    } catch (error) {
      if (signal.aborted) throw error;
      console.warn("위키데이터 설명을 가져오지 못해 위키백과 요약을 사용합니다.", error);
    }

    return pages
      .map((page) => {
        const title = page.title.trim();
        const extract = normalizeExtract(page.extract);
        const sourceUrl = `https://ko.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}`;
        const wikidataDescription = descriptions[page.pageprops?.wikibase_item];
        const conciseDefinition = shortenDefinition(firstSentence(extract));
        return {
          term: title,
          answer: wikidataDescription || conciseDefinition,
          explanation: summarize(extract),
          sourceTitle: title,
          sourceUrl,
        };
      })
      .filter((card) => card.answer.length >= 5);
  }

  async function generateFlashcards(previousCards) {
    const excluded = new Set(previousCards.map((card) => normalizeTitle(card.term)));
    const topics = shuffle(SEARCH_TOPICS);
    const selected = new Map();
    const failures = [];

    for (let offset = 0; offset < topics.length && selected.size < 10; offset += 4) {
      const batch = topics.slice(offset, offset + 4);
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);

      try {
        const results = await Promise.allSettled(
          batch.map((topic) => searchTopic(topic, controller.signal)),
        );

        for (const result of results) {
          if (result.status === "rejected") {
            failures.push(result.reason);
            continue;
          }

          for (const card of shuffle(result.value)) {
            const key = normalizeTitle(card.term);
            if (excluded.has(key) || selected.has(key)) continue;
            selected.set(key, card);
            if (selected.size === 10) break;
          }
          if (selected.size === 10) break;
        }

        if (selected.size === 0 && results.every((result) => result.status === "rejected")) {
          throw new Error(
            "위키백과에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
            { cause: failures[0] },
          );
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    if (selected.size < 10) {
      if (failures.length > 0 && selected.size === 0) {
        throw new Error(
          "위키백과에 연결할 수 없습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.",
        );
      }
      throw new Error(
        `새로운 카드를 10장 찾지 못했습니다 (${selected.size}/10). 다시 시도해 주세요.`,
      );
    }

    return shuffle([...selected.values()]);
  }

  return { generateFlashcards };
})();
