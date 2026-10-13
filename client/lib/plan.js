// Small helpers for reading a plan on the website. (The server does the real arithmetic.)

// Hours still open on a block: partial = hours minus hours studied, untouched = all of it.
export function hoursLeft(block) {
  if (block.status === 'partial') return Math.max(0, block.hours - block.hoursStudied);
  if (block.status === 'untouched') return block.hours;
  return 0;
}

export function unfinishedBlocks(day) {
  return day.blocks.filter((b) => b.status === 'partial' || b.status === 'untouched');
}

// Which blocks a replan proposal moves or adds: a Set of "date|topicId" for each day a topic lands on.
export function movedKeys(proposal) {
  const keys = new Set();
  for (const move of proposal.moves) for (const date of move.to) keys.add(`${date}|${move.topicId}`);
  return keys;
}

// date -> Set of topicIds that a replan just moved onto that day (used to softly highlight them after accepting).
export function highlightFrom(proposal) {
  const map = new Map();
  for (const move of proposal.moves) {
    for (const date of move.to) map.set(date, (map.get(date) ?? new Set()).add(move.topicId));
  }
  return map;
}
