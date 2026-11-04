// Browser-only fixture, injected by verify-ui.mjs. Never imported by the application.
const date = new Date().toISOString().slice(0, 10);
const month = date.slice(0, 7);
const user = {id:'ui-test-user',email:'visual-test@example.test'};
const tables = {
 transactions: [
  {id:'1',user_id:user.id,transaction_date:month+'-01',description:'Monthly salary',merchant:'Employer',kind:'income',category:'Salary',amount:'42000.00',notes:null,payment_method:'Bank',source:'manual',created_at:date},
  {id:'2',user_id:user.id,transaction_date:month+'-02',description:'Weekly groceries',merchant:'Neighborhood market',kind:'expense',category:'Groceries',amount:'1842.75',notes:null,payment_method:'Cash',source:'manual',created_at:date},
  {id:'3',user_id:user.id,transaction_date:month+'-03',description:'Coffee and lunch',merchant:'Cafe',kind:'expense',category:'Food & Dining',amount:'385.50',notes:null,payment_method:'Cash',source:'manual',created_at:date}
 ], receipts: [], monthly_budgets:sessionStorage.getItem('ui-no-budget')?[]:[{id:'budget',user_id:user.id,month:month+'-01',category:'Groceries',amount:'15000.00'}]
};
export const configured=true;
export const supabase={
 auth:{
  getSession:async()=>({data:{session:sessionStorage.getItem('ui-signed-out')?null:{user}},error:null}),
  onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),
  signInWithPassword:async()=>({data:{session:{user}},error:null}),
  signUp:async()=>({data:{session:null},error:null}),
  signOut:async()=>({error:null})
 },
 from(table){
  let result=[...tables[table]], operation='read',values;
  const query={
   select(){return query},order(){return query},eq(key,value){result=result.filter(x=>x[key]===value);return query},
   range(start,end){result=result.slice(start,end+1);return query},
   insert(value){operation='insert';values=value;return query},update(value){operation='update';values=value;return query},delete(){operation='delete';return query},
   async single(){
    if(operation==='insert'){const row={id:crypto.randomUUID(),created_at:date,...values};tables[table].push(row);return {data:row,error:null}}
    if(operation==='update'){Object.assign(result[0],values);return {data:result[0],error:null}}
    if(operation==='delete'){tables[table]=tables[table].filter(x=>!result.includes(x));return {data:result[0],error:null}}
    return {data:result[0],error:null};
   },
   then(resolve){return Promise.resolve({data:result,error:null}).then(resolve)}
  };return query;
 },
 storage:{from(){return {upload:async()=>({error:null}),remove:async()=>({error:null}),createSignedUrl:async()=>({data:{signedUrl:'about:blank'},error:null})}}}
};
