import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('expense and album pagination return viewport to section start', () => {
  const expense = fs.readFileSync('src/features/expenses/expense-controller.js', 'utf8');
  const album = fs.readFileSync('src/features/album/album-controller.js', 'utf8');
  assert.match(expense, /scrollTarget\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'start'\s*\}\)/);
  assert.match(album, /scrollTarget\?\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'start'\s*\}\)/);
});

test('main wires pager scroll targets to their own sections', () => {
  const main = fs.readFileSync('src/app/main.js', 'utf8');
  assert.match(main, /createExpensePager\([^\n]*scrollTarget: \$\('#expenseSection'\)/);
  assert.match(main, /createAlbumController\([^\n]*scrollTarget: \$\('#albumSection'\)/);
});
