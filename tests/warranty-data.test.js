import test from 'node:test';
import assert from 'node:assert/strict';
import {createWarrantyData} from '../src/warranty-data.js';
import {calculateExpiration,warrantyDraft} from '../src/warranties.js';
import {createAccountScope} from '../src/account-scope.js';
function fixture(){
 const state={rows:[],calls:[],countError:false,failAfterInsert:false};
 const client={from(table){assert.equal(table,'warranties');let operation='read',value,filters=[],options={};
  const q={select(_columns,opts={}){options=opts;return q;},eq(key,val){filters.push([key,val]);return q;},order(){return q;},range(){return q;},insert(v){operation='insert';value=v;return q;},update(v){operation='update';value=v;return q;},delete(){operation='delete';return q;},single(){return run(true);},then(resolve,reject){return run(false).then(resolve,reject);}};
  async function run(single){
   state.calls.push({operation,filters,value});let selected=state.rows.filter(r=>filters.every(([k,v])=>r[k]===v));
   if(operation==='insert'){selected=value.map(v=>({...v,id:crypto.randomUUID(),expiration_date:calculateExpiration(v.warranty_start_date,v.warranty_duration,v.warranty_duration_unit)}));state.rows.push(...selected);if(state.failAfterInsert){state.failAfterInsert=false;return {data:null,error:new Error('Response lost')};}}
   if(operation==='update')selected.forEach(r=>Object.assign(r,value));
   if(operation==='delete')state.rows=state.rows.filter(r=>!selected.includes(r));
   if(options.head)return {data:null,count:state.countError?null:selected.length,error:state.countError?new Error('Network failed'):null};
   return {data:single?selected[0]:selected,error:single&&!selected.length?new Error('No matching record'):null};
  }return q;
 }};return {state,service:createWarrantyData(client)};
}
const draft=name=>({...warrantyDraft('2024-01-31'),product_name:name});
test('new batch preserves independent products on one receipt; edit/delete use owner and ID',async()=>{
 const {state,service}=fixture();const records=await service.add('a',[draft('Keyboard'),draft('Mouse')],'receipt-a');
 assert.equal(records.length,2);assert.ok(records.every(r=>r.receipt_id==='receipt-a'&&r.user_id==='a'));
 await service.edit('a',records[0].id,{...draft('Edited'),warranty_duration:'2'},'receipt-a');
 assert.equal(state.rows[0].product_name,'Edited');
 await assert.rejects(service.remove('b',records[0].id));
 await service.remove('a',records[0].id);assert.equal(state.rows.length,1);
 assert.ok(state.calls.filter(c=>['update','delete'].includes(c.operation)).every(c=>c.filters.some(([key])=>key==='user_id')&&c.filters.some(([key])=>key==='id')));
});
test('private receipt association and generated expiry never leak into client write fields',async()=>{
 const {state,service}=fixture();await service.add('a',[{...draft('Product'),expiration_date:'2099-01-01',storage_path:'private',created_at:'fake'}],'receipt-a');
 const value=state.calls.find(c=>c.operation==='insert').value[0];
 assert.equal(value.receipt_id,'receipt-a');for(const key of ['expiration_date','created_at','storage_path'])assert.ok(!(key in value));
});
test('failed attachment response can be retried without duplicate products or financial writes',async()=>{
 const {state,service}=fixture();state.failAfterInsert=true;
 await assert.rejects(service.attach('a',[draft('Keyboard'),draft('Mouse')],'new-receipt'));
 const recovered=await service.attach('a',[draft('Keyboard'),draft('Mouse')],'new-receipt');
 assert.equal(recovered.length,2);assert.equal(state.rows.length,2);
 assert.equal(state.calls.filter(c=>c.operation==='insert').length,1);
 await assert.rejects(service.attach('a',[draft('Different')],'new-receipt'),/already has warranty/);
});
test('count is user- and receipt-scoped and fails closed',async()=>{
 const {state,service}=fixture();await service.add('a',[draft('Product')],'receipt-a');
 assert.equal(await service.count('a','receipt-a'),1);assert.equal(await service.count('b','receipt-a'),0);
 state.countError=true;await assert.rejects(service.count('a','receipt-a'));
 await assert.rejects(service.add('a',[],'receipt-a'));
 await assert.rejects(service.attach('a',[],'receipt-a'));
});
test('account switch during attachment read prevents follow-up insertion',async()=>{
 const scope=createAccountScope('a');let requests=0;
 const client={from(){requests++;const q={select(){return q;},eq(){return q;},then(resolve){scope.invalidate();return Promise.resolve({data:[],error:null}).then(resolve);}};return q;}};
 await assert.rejects(createWarrantyData(client).attach('a',[draft('Product')],'receipt-a',()=>scope.assert()),/Account changed/);
 assert.equal(requests,1);
});
