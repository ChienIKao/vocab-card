export function normalizeDeck(cards) {
  if (!Array.isArray(cards)) throw new Error('卡片資料必須是陣列');
  const ids = new Set();
  return cards.map(card => {
    if (!card || typeof card.id !== 'string' || !/^[\w-]{1,128}$/.test(card.id) || ids.has(card.id)) {
      throw new Error('卡片 ID 無效或重複');
    }
    ids.add(card.id);
    const result = { id: card.id };
    for (const field of ['category', 'word', 'phonetic', 'meaning', 'sentenceEn', 'sentenceZh', 'note']) {
      if (card[field] != null && typeof card[field] !== 'string') throw new Error('卡片欄位格式錯誤');
      result[field] = card[field] || '';
    }
    result.category ||= '未分類';
    if (!result.word.trim() || !result.meaning.trim() || !result.sentenceEn.trim()) {
      throw new Error('卡片缺少單字、意思或英文例句');
    }
    return result;
  });
}

export function deckChanges(before, after) {
  const previous = new Map(normalizeDeck(before).map(card => [card.id, card]));
  const next = normalizeDeck(after);
  const changes = new Map();
  for (const card of next) {
    if (JSON.stringify(previous.get(card.id)) !== JSON.stringify(card)) changes.set(card.id, card);
    previous.delete(card.id);
  }
  for (const id of previous.keys()) changes.set(id, null);
  const order = next.map(card => card.id);
  return { changes, order: JSON.stringify(before.map(card => card.id)) === JSON.stringify(order) ? null : order };
}

export function mergeDeck(remoteCards, order, pending = new Map()) {
  const cards = new Map(normalizeDeck(remoteCards).map(card => [card.id, card]));
  for (const [id, change] of pending) {
    if (change.card === null) cards.delete(id);
    else cards.set(id, change.card);
  }
  const ids = [...new Set([...order, ...cards.keys()])];
  return ids.filter(id => cards.has(id)).map(id => cards.get(id));
}
