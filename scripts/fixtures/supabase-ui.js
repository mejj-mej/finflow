import {calculateExpiration} from './warranties.js';
// Served only by the isolated browser verifier in place of src/supabase.js.
const now=new Date(),date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,month=date.slice(0,7);
const offset=n=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const user={id:'ui-test-user',email:'visual-test@example.test'};
let currentUser=sessionStorage.getItem('ui-signed-out')?null:user;
const listeners=new Set();
const tables={
 transactions:[
  {id:'1',user_id:user.id,transaction_date:month+'-01',description:'Monthly salary',merchant:'Employer',kind:'income',category:'Salary',amount:'42000.00',notes:null,payment_method:'Bank',source:'manual',created_at:date},
  {id:'2',user_id:user.id,transaction_date:month+'-02',description:'Weekly groceries',merchant:'Neighborhood market',kind:'expense',category:'Groceries',amount:'1842.75',notes:null,payment_method:'Cash',source:'manual',created_at:date},
  {id:'3',user_id:user.id,transaction_date:month+'-03',description:'Coffee and lunch',merchant:'Cafe',kind:'expense',category:'Food & Dining',amount:'385.50',notes:null,payment_method:'Cash',source:'manual',created_at:date}
 ],
 receipts:[
  {id:'receipt-1',user_id:user.id,transaction_id:'2',storage_path:user.id+'/synthetic-1.pdf',merchant:'Electronics shop',receipt_date:date,created_at:date,extraction_status:'verified'},
  {id:'receipt-2',user_id:user.id,transaction_id:null,storage_path:user.id+'/synthetic-2.pdf',merchant:'Home store',receipt_date:null,created_at:date,extraction_status:'verified'}
 ],
 warranties:[
  {id:'warranty-1',user_id:user.id,receipt_id:'receipt-1',product_name:'Wireless keyboard',brand_model:'Iris K2',warranty_start_date:date,warranty_duration:12,warranty_duration_unit:'months',expiration_date:offset(365),expiration_date_override:null,notes:'Keep the original packaging.',created_at:date,updated_at:date},
  {id:'warranty-2',user_id:user.id,receipt_id:'receipt-1',product_name:'Travel mouse',brand_model:'',warranty_start_date:offset(-350),warranty_duration:12,warranty_duration_unit:'months',expiration_date:offset(15),expiration_date_override:null,notes:'',created_at:date,updated_at:date},
  {id:'warranty-3',user_id:user.id,receipt_id:'receipt-2',product_name:'Desk lamp',brand_model:'',warranty_start_date:offset(-375),warranty_duration:12,warranty_duration_unit:'months',expiration_date:offset(-10),expiration_date_override:null,notes:'',created_at:date,updated_at:date}
 ],
 monthly_budgets:sessionStorage.getItem('ui-no-budget')?[]:[{id:'budget',user_id:user.id,month:month+'-01',category:'Groceries',amount:'15000.00'}]
};
const control={tables,calls:[],failure:null,hold:null,release:null,
 switchUser(id){currentUser=id?{id,email:id+'@example.test'}:null;listeners.forEach(fn=>fn(id?'SIGNED_IN':'SIGNED_OUT',currentUser?{user:currentUser}:null));},
 failNext(table,operation,after=false){control.failure={table,operation,after};},
 holdNext(table,operation){control.hold={table,operation};}
};
globalThis.__finflowTest=control;
export const configured=true;
export const supabase={
 auth:{
  getSession:async()=>({data:{session:currentUser?{user:currentUser}:null},error:null}),
  onAuthStateChange(fn){listeners.add(fn);return {data:{subscription:{unsubscribe(){listeners.delete(fn)}}}};},
  signInWithPassword:async()=>{control.switchUser(user.id);return {data:{session:{user}},error:null};},
  signUp:async()=>({data:{session:null},error:null}),
  signOut:async()=>{control.switchUser(null);return {error:null};}
 },
 from(table){
  let operation='read',values,filters=[],start=0,end=Infinity,options={};
  const query={
   select(_columns,opts={}){options=opts;return query;},order(){return query;},eq(key,value){filters.push([key,value]);return query;},range(a,b){start=a;end=b;return query;},
   insert(value){operation='insert';values=Array.isArray(value)?value:[value];return query;},update(value){operation='update';values=value;return query;},delete(){operation='delete';return query;},
   single(){return run(true);},then(resolve,reject){return run(false).then(resolve,reject);}
  };
  async function run(single){
   const owner=currentUser?.id;control.calls.push({table,operation,owner,values,filters});
   const failure=control.failure?.table===table&&control.failure.operation===operation?control.failure:null;if(failure)control.failure=null;
   if(failure&&!failure.after)return {data:null,count:null,error:new Error('Synthetic network failure')};
   let result=(tables[table]||[]).filter(x=>x.user_id===owner&&filters.every(([key,value])=>x[key]===value));
   if(operation==='insert'){
    if(values.some(v=>v.user_id!==owner||(table==='warranties'&&!tables.receipts.some(r=>r.id===v.receipt_id&&r.user_id===owner))))return {data:null,error:new Error('Ownership denied')};
    result=values.map(v=>({id:crypto.randomUUID(),created_at:date,updated_at:date,...v,...(table==='warranties'?{expiration_date:v.expiration_date_override||calculateExpiration(v.warranty_start_date,v.warranty_duration,v.warranty_duration_unit)}:{})}));tables[table].push(...result);
   }
   if(operation==='update')result.forEach(r=>{Object.assign(r,values);if(table==='warranties')r.expiration_date=r.expiration_date_override||calculateExpiration(r.warranty_start_date,r.warranty_duration,r.warranty_duration_unit);});
   if(operation==='delete'){
    tables[table]=tables[table].filter(x=>!result.includes(x));
    if(table==='receipts')tables.warranties=tables.warranties.filter(w=>!result.some(r=>r.id===w.receipt_id));
   }
   let response=options.head?{data:null,count:result.length,error:null}:{data:single?result[0]:result.slice(start,end+1),error:single&&!result.length?new Error('No row'):null};
   if(failure?.after)response={data:null,error:new Error('Synthetic lost response')};
   if(control.hold?.table===table&&control.hold.operation===operation){control.hold=null;await new Promise(resolve=>{control.release=()=>{control.release=null;resolve()};});}
   return response;
  }
  return query;
 },
 storage:{from(){return {
  upload:async()=>{control.calls.push({table:'storage',operation:'upload'});return {error:null};},
  remove:async()=>{control.calls.push({table:'storage',operation:'delete'});return {error:null};},
  createSignedUrl:async(path,expiresIn)=>{control.calls.push({table:'storage',operation:'sign',path,expiresIn});return {data:{signedUrl:'about:blank'},error:null};}
 };}}
};
