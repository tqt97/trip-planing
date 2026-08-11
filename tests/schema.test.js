import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const rules=fs.readFileSync('firebase/firestore.rules','utf8');
test('Firestore rules require auth and role-based writes',()=>{assert.match(rules,/request\.auth != null/);assert.match(rules,/function canEdit\(tripId\)/);assert.match(rules,/match \/places\/\{placeId\}/);assert.match(rules,/match \/expenses\/\{expenseId\}/);assert.match(rules,/match \/votes\/\{voteId\}/)});
test('Firestore rules protect first owner and vote identity',()=>{assert.match(rules,/ownerUid == request\.auth\.uid/);assert.match(rules,/getAfter\(tripPath\(tripId\)\)\.data\.ownerUid/);assert.match(rules,/request\.resource\.data\.userId == request\.auth\.uid/);assert.match(rules,/voteId == request\.resource\.data\.placeId \+ '_' \+ request\.auth\.uid/)});
test('owner cannot self-demote in rules',()=>{assert.match(rules,/uid != request\.auth\.uid/);assert.match(rules,/affectedKeys\(\)\.hasOnly\(\['role','updatedAt'\]\)/)});
