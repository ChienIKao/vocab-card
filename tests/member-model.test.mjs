import test from 'node:test';
import assert from 'node:assert/strict';
import { memberRows, filterMembers } from '../member-model.mjs';

test('pending requests, enabled members and disabled members stay distinct', () => {
  const rows = memberRows([
    { uid: 'pending', email: 'new@example.com' },
    { uid: 'disabled', email: 'paused@example.com' }
  ], [{ uid: 'owner', enabled: true }, { uid: 'disabled', enabled: false }], 'owner');
  assert.equal(rows.find(row => row.uid === 'pending').status, 'pending');
  assert.equal(rows.find(row => row.uid === 'disabled').status, 'disabled');
  assert.equal(rows.find(row => row.uid === 'owner').self, true);
  assert.equal(rows.find(row => row.uid === 'owner').status, 'active');
});

test('membership state comes from the membership document, not the request profile', () => {
  assert.equal(memberRows([{ uid: 'a', enabled: true }], [], 'owner')[0].status, 'pending');
  const rows = memberRows([{ uid: 'a', enabled: true, email: 'new@example.com' }], [{ uid: 'a', enabled: false }], 'owner');
  assert.equal(rows[0].status, 'disabled');
});

test('search respects the selected status and matches names or email without case sensitivity', () => {
  const rows = memberRows([{ uid: 'a', displayName: '小安', email: 'Family@example.com' }, { uid: 'b', email: 'other@example.com' }], [{ uid: 'a', enabled: true }], 'owner');
  assert.deepEqual(filterMembers(rows, 'active', ' FAMILY ').map(row => row.uid), ['a']);
  assert.deepEqual(filterMembers(rows, 'pending', 'family'), []);
  assert.deepEqual(filterMembers(rows, 'active', '小安').map(row => row.uid), ['a']);
});
