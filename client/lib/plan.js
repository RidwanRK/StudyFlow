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
