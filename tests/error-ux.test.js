import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { userErrorMessage } from '../src/app/error-message.js';

test('user error messages hide technical codes and raw backend details', () => {
  assert.equal(userErrorMessage(new Error('Failed to fetch'), 'fallback'), 'Không thể kết nối máy chủ. Kiểm tra mạng rồi thử lại.');
  assert.equal(userErrorMessage(new Error('new row violates row-level security policy'), 'fallback'), 'Bạn không có quyền thực hiện thao tác này.');
  assert.equal(userErrorMessage(Object.assign(new Error('HTTP 500 internal db error'), { code: 'HTTP_500' }), 'Không lưu được.'), 'Không lưu được.');
});

test('user-facing controllers do not render Trace ids or raw error.message', () => {
  const files = [
    'src/app/main.js',
    'src/features/album/album-controller.js',
    'src/features/timeline/timeline-controller.js',
    'src/features/checklists/checklist-controller.js'
  ];
  const source = files.map(file => fs.readFileSync(file, 'utf8')).join('\n');
  assert.doesNotMatch(source, /textContent\s*=\s*`[^`]*Trace \$\{/);
  assert.doesNotMatch(source, /toast\s*\(\s*`[^`]*\$\{error\.message\}/);
  assert.doesNotMatch(source, /appShell\.auth\s*\(\s*`[^`]*\$\{error\.message\}/);
});
