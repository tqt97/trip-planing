import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateItems } from '../src/core.js';

test('expense and album default pagination contract is 8 items', () => {
  const items = Array.from({ length: 19 }, (_, i) => ({ id: i + 1 }));
  const first = paginateItems(items, 1, 8);
  const third = paginateItems(items, 3, 8);
  assert.equal(first.items.length, 8);
  assert.equal(first.totalPages, 3);
  assert.equal(third.items.length, 3);
  assert.equal(third.currentPage, 3);
});
