import test from 'node:test';
import assert from 'node:assert/strict';
import {blank,cents,payload,filterTransactions,summarize,expenseCategories,incomeCategories} from '../src/transactions.js';
test('PHP precision rejects fractions of cent, exponent, negative, nonfinite and unsafe values',()=>{
 assert.equal(cents('0.01'),1);assert.equal(cents('1200.10'),120010);
 for(const value of ['0','-1','1.001','1e3','NaN','Infinity','1,200','9999999999999999',''])assert.throws(()=>cents(value));
});
test('manual expense preserves payment method and notes',()=>{
 const result=payload({...blank(),merchant:'Groceries',amount:'320.25',category:'Groceries',payment:'Cash',note:'Weekly shop'});
 assert.equal(result.kind,'expense');assert.equal(result.amount,'320.25');assert.equal(result.payment_method,'Cash');assert.equal(result.notes,'Weekly shop');
});
test('manual income uses the selected income category',()=>{
 const result=payload({...blank(),type:'Income',merchant:'Employer',amount:'25000.50',category:'Salary'});
 assert.equal(result.kind,'income');assert.equal(result.category,'Salary');assert.equal(result.amount,'25000.50');
});
test('all requested categories are available and separate',()=>{
 assert.equal(expenseCategories.length,12);assert.equal(incomeCategories.length,8);
 assert.ok(expenseCategories.includes('Rent & Housing'));assert.ok(expenseCategories.includes('Food & Dining'));assert.ok(incomeCategories.includes('Business Income'));
 assert.ok(!incomeCategories.some(x=>expenseCategories.includes(x)));assert.ok(!incomeCategories.includes('Transfer'));
});
test('invalid description and calendar dates are rejected',()=>{
 const base={...blank(),merchant:'Store',amount:'1'};
 for(const patch of [{merchant:' '},{date:'2026-02-30'},{date:''},{type:'Transfer'}])assert.throws(()=>payload({...base,...patch}));
});
const items=[
 {transaction_date:'2026-10-01',kind:'income',amount:'1000.10',category:'Salary',description:'Employer'},
 {transaction_date:'2026-10-02',kind:'expense',amount:'0.10',category:'Groceries',description:'Weekly',merchant:'Market'},
 {transaction_date:'2026-10-03',kind:'expense',amount:'0.20',category:'Food & Drinks',description:'Lunch'},
 {transaction_date:'2026-09-03',kind:'expense',amount:'500',category:'Shopping',description:'Shoes'}
];
test('selected month totals use integer cents and include legacy categories',()=>{
 const result=summarize(filterTransactions(items,{month:'2026-10'}));
 assert.equal(result.income,1000.1);assert.equal(result.expense,0.3);assert.equal(result.totals.length,2);assert.equal(result.totals[0].name,'Food & Drinks');
});
test('search, category, month and type filters combine',()=>{
 assert.equal(filterTransactions(items,{month:'2026-10',type:'expense',category:'Groceries',search:' MARKET '}).length,1);
 assert.equal(filterTransactions(items,{month:'2026-10',type:'income',search:'market'}).length,0);
 assert.equal(filterTransactions(items,{month:'2026-09'}).length,1);
});
test('empty account and unmatched month have zero totals',()=>{
 assert.deepEqual(summarize([]),{income:0,expense:0,totals:[]});assert.equal(filterTransactions(items,{month:'2025-01'}).length,0);
});
test('new records reject categories belonging to the other type; edits retain legacy categories',()=>{
 assert.throws(()=>payload({...blank(),type:'Income',merchant:'Employer',amount:'10',category:'Groceries'}));
 const legacy={...blank(),merchant:'Cafe',amount:'10',category:'Food & Drinks'};
 assert.throws(()=>payload(legacy));assert.equal(payload(legacy,{legacyCategory:'Food & Drinks'}).category,'Food & Drinks');
});
