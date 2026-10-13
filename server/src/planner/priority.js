const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 };

// Earlier exams first, then harder topics, then name. Returns the topics with a `priorityRank` (1 = most important).
// The same ranking decides which topics are the "important parts" when time is short.
export function rankTopics(topics) {
  const sorted = [...topics].sort(
    (a, b) =>
      a.examDate.localeCompare(b.examDate) ||
      DIFFICULTY_WEIGHT[b.difficulty] - DIFFICULTY_WEIGHT[a.difficulty] ||
      a.name.localeCompare(b.name),
  );
  return sorted.map((topic, i) => ({ ...topic, priorityRank: i + 1 }));
}
