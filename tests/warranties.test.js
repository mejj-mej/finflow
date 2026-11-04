import test from 'node:test';
import assert from 'node:assert/strict';
import {dateParts,calculateExpiration,effectiveExpiration,warrantyStatus,warrantyDraft,warrantyPayload,filterWarranties,receiptDeleteWarning} from '../src/warranties.js';
import {createAccountScope} from '../src/account-scope.js';

test('calendar months clamp once, including leap years and year rollover',()=>{
 for(const [start,count,unit,expected] of [
  ['2024-01-31',1,'months','2024-02-29'],['2023-01-31',1,'months','2023-02-28'],
  ['2024-01-31',2,'months','2024-03-31'],['2024-08-31',1,'months','2024-09-30'],
  ['2024-12-31',2,'months','2025-02-28'],['2024-02-29',1,'years','2025-02-28'],
  ['2024-02-29',4,'years','2028-02-29'],['2000-02-29',100,'years','2100-02-28'],
  ['0001-01-31',1,'months','0001-02-28']
 ])assert.equal(calculateExpiration(start,count,unit),expected);
});
test('date validation rejects normalized impossible days, infinity and invalid terms',()=>{
 for(const date of ['2023-02-29','2100-02-29','2024-04-31','2024-13-01','0000-01-01','2024-1-01','infinity',''])assert.throws(()=>dateParts(date));
 for(const duration of ['0','-1','1.5','1e2','NaN','',1201])assert.throws(()=>calculateExpiration('2024-01-01',duration,'months'));
 assert.throws(()=>calculateExpiration('2024-01-01',101,'years'));
 assert.throws(()=>calculateExpiration('2024-01-01',1,'days'));
 assert.throws(()=>calculateExpiration('9999-12-31',1,'months'));
});
test('manual expiration overrides and resets without losing entered duration',()=>{
 const draft={...warrantyDraft('2024-01-31'),warranty_duration:1,expiration_date_override:'2024-03-15'};
 assert.equal(effectiveExpiration(draft),'2024-03-15');
 assert.equal(effectiveExpiration({...draft,expiration_date_override:''}),'2024-02-29');
 assert.throws(()=>effectiveExpiration({...draft,expiration_date_override:'2024-01-30'}));
 assert.throws(()=>effectiveExpiration({...draft,manualExpiration:true,expiration_date_override:''}));
});
test('status boundaries are inclusive of today and day 30 across DST and leap days',()=>{
 for(const [expiry,today,days,status] of [
  ['2026-11-05','2026-11-05',0,'Expiring soon'],['2026-11-04','2026-11-05',-1,'Expired'],
  ['2026-12-05','2026-11-05',30,'Expiring soon'],['2026-12-06','2026-11-05',31,'Active'],
  ['2024-03-11','2024-03-09',2,'Expiring soon'],['2024-03-01','2024-02-28',2,'Expiring soon'],
  ['0001-01-02','0001-01-01',1,'Expiring soon']
 ])assert.deepEqual(warrantyStatus(expiry,today),{days,status});
});
test('payload trims text, requires receipt and product, and excludes protected fields',()=>{
 const draft={...warrantyDraft('2024-01-01'),product_name:' Keyboard ',user_id:'spoof',id:'spoof',expiration_date:'2099-01-01'};
 assert.deepEqual(warrantyPayload(draft,'receipt-a'),{receipt_id:'receipt-a',product_name:'Keyboard',brand_model:null,warranty_start_date:'2024-01-01',warranty_duration:12,warranty_duration_unit:'months',expiration_date_override:null,notes:null});
 for(const value of [{product_name:''},{product_name:'a'.repeat(301)},{brand_model:'a'.repeat(201)},{notes:'a'.repeat(5001)}])assert.throws(()=>warrantyPayload({...draft,...value},'receipt-a'));
 assert.throws(()=>warrantyPayload(draft,''));
});
test('multiple products, search, status and receipt filters combine; missing receipts are hidden',()=>{
 const rows=[{id:'1',receipt_id:'a',product_name:'Keyboard',brand_model:'Iris',expiration_date:'2026-12-06'},{id:'2',receipt_id:'a',product_name:'Mouse',expiration_date:'2026-11-05'},{id:'3',receipt_id:'b',product_name:'Screen',expiration_date:'2026-11-04'},{id:'4',receipt_id:'missing',product_name:'Hidden',expiration_date:'2026-11-04'}];
 const receipts=[{id:'a',merchant:'Electronics'},{id:'b',merchant:'Outlet'}],base={today:'2026-11-05'};
 assert.equal(filterWarranties(rows,receipts,base).length,3);
 assert.equal(filterWarranties(rows,receipts,{...base,receiptId:'a'}).length,2);
 assert.deepEqual(filterWarranties(rows,receipts,{...base,search:'electronics',status:'Active'}).map(r=>r.id),['1']);
 assert.deepEqual(filterWarranties(rows,receipts,{...base,search:'iris'}).map(r=>r.id),['1']);
});
test('receipt deletion warning always discloses warranty cascade and retained transaction',()=>{
 for(const count of [0,1,2]){const warning=receiptDeleteWarning(count);assert.match(warning,/warrant/);assert.match(warning,/transaction will remain/);}
 assert.match(receiptDeleteWarning(2),/2 linked warranties/);
});
test('account generation invalidates delayed responses even after same-user re-login',async()=>{
 const old=createAccountScope('a');let finish;
 const delayed=new Promise(resolve=>{finish=resolve;}).then(()=>old.current()?'STALE DATA':null);
 old.invalidate();const other=createAccountScope('b');other.invalidate();const fresh=createAccountScope('a');finish();
 assert.equal(await delayed,null);assert.throws(()=>old.assert());assert.ok(fresh.current());assert.notEqual(fresh.id,old.id);
});
