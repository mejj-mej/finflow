// Mirrors the Supabase Auth password policy configured in the dashboard (2026-11-21):
// minimum 10 characters; lowercase, uppercase and digits required.
// Supabase enforces this server-side; this copy only gives users clear feedback first.
// If the dashboard policy changes, update this file and tests/password.test.js together.
export const PASSWORD_MIN_LENGTH = 10;
export const passwordRules = [
 {id:'length', label:`At least ${PASSWORD_MIN_LENGTH} characters`, test:p=>p.length>=PASSWORD_MIN_LENGTH},
 {id:'lower', label:'One lowercase letter (a–z)', test:p=>/[a-z]/.test(p)},
 {id:'upper', label:'One uppercase letter (A–Z)', test:p=>/[A-Z]/.test(p)},
 {id:'digit', label:'One number (0–9)', test:p=>/[0-9]/.test(p)}
];
export const passwordRequirementText = `Use at least ${PASSWORD_MIN_LENGTH} characters, including a lowercase letter, an uppercase letter and a number.`;
export function passwordProblems(password){const value=String(password??'');return passwordRules.filter(rule=>!rule.test(value)).map(rule=>rule.label);}
export function assertSignUpPassword(password){const problems=passwordProblems(password);if(problems.length)throw new Error('Password needs: '+problems.join(', ').toLowerCase()+'.');}
