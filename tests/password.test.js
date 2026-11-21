import test from 'node:test';
import assert from 'node:assert/strict';
import {PASSWORD_MIN_LENGTH,passwordRules,passwordProblems,assertSignUpPassword,passwordRequirementText} from '../src/password.js';

// Synthetic strings only; none are real credentials.
test('policy mirrors Supabase dashboard: 10 chars, lowercase, uppercase, digit',()=>{
 assert.equal(PASSWORD_MIN_LENGTH,10);
 assert.deepEqual(passwordRules.map(r=>r.id),['length','lower','upper','digit']);
 assert.match(passwordRequirementText,/10 characters/);
});
test('valid passwords pass, including exactly 10 characters and symbols',()=>{
 for(const value of ['Abcdefgh12','Synthetic7Value','A1b2C3d4E5','Plum#Iris2026!'])assert.deepEqual(passwordProblems(value),[],value);
 assert.doesNotThrow(()=>assertSignUpPassword('Abcdefgh12'));
});
test('each missing rule is reported on its own',()=>{
 assert.deepEqual(passwordProblems('Abcdefg12'),['At least 10 characters']);
 assert.deepEqual(passwordProblems('ABCDEFGH12'),['One lowercase letter (a–z)']);
 assert.deepEqual(passwordProblems('abcdefgh12'),['One uppercase letter (A–Z)']);
 assert.deepEqual(passwordProblems('Abcdefghij'),['One number (0–9)']);
});
test('empty, missing and whitespace-only input fail every applicable rule without throwing',()=>{
 assert.equal(passwordProblems('').length,4);
 assert.equal(passwordProblems(undefined).length,4);
 assert.equal(passwordProblems(' '.repeat(12)).length,3);
});
test('non-ASCII letters do not satisfy the ASCII class rules Supabase checks',()=>{
 assert.deepEqual(passwordProblems('ÄÖÜäöü1234'),['One lowercase letter (a–z)','One uppercase letter (A–Z)']);
});
test('sign-up assertion message lists problems and never echoes the password',()=>{
 const value='short1';
 assert.throws(()=>assertSignUpPassword(value),error=>/password needs:/i.test(error.message)&&error.message.includes('at least 10 characters')&&!error.message.includes(value));
});
