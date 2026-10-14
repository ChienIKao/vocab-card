import test from 'node:test';
import assert from 'node:assert/strict';
import { deckChanges, mergeDeck, normalizeDeck } from '../sync-model.mjs';

const card = (id, word = id) => ({ id, word, category: '測試', meaning: '意思', sentenceEn: 'A sentence.' });

test('editing one card preserves a concurrent update to another card', () => {
  const before = [card('a'), card('b')];
  const changes = deckChanges(before, [card('a', 'local edit'), card('b')]);
  assert.equal(changes.changes.size, 1);
  assert.equal(changes.order, null);
  const pending = new Map([...changes.changes].map(([id, value]) => [id, { card: value }]));
  const merged = mergeDeck([card('a'), card('b', 'remote edit'), card('c')], ['a', 'b'], pending);
  assert.deepEqual(merged.map(item => item.word), ['local edit', 'remote edit', 'c']);
});

test('a pending deletion stays deleted when a stale remote snapshot arrives', () => {
  const changes = deckChanges([card('a'), card('b')], [card('b')]);
  const pending = new Map([...changes.changes].map(([id, value]) => [id, { card: value }]));
  assert.deepEqual(mergeDeck([card('a'), card('b')], ['a', 'b'], pending).map(item => item.id), ['b']);
});

test('a restored deck removes prior cards and retains concurrently added cards', () => {
  const changes = deckChanges([card('a')], [card('c')]);
  const pending = new Map([...changes.changes].map(([id, value]) => [id, { card: value }]));
  assert.deepEqual(mergeDeck([card('a'), card('b')], changes.order, pending).map(item => item.id), ['c', 'b']);
});

test('an empty cloud deck remains empty', () => {
  assert.deepEqual(mergeDeck([], []), []);
  assert.deepEqual(normalizeDeck([]), []);
});

test('malformed backups and duplicate IDs are rejected before syncing', () => {
  assert.throws(() => normalizeDeck([card('a'), card('a')]), /重複/);
  assert.throws(() => normalizeDeck([card('path/invalid')]), /ID/);
  assert.throws(() => normalizeDeck([{ ...card('a'), sentenceEn: null }]), /例句/);
  assert.throws(() => normalizeDeck([{ ...card('a'), note: {} }]), /格式/);
});
