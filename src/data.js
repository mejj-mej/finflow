import {supabase} from './supabase.js';
export async function allRows(table,userId,columns='*') {
 const rows=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await supabase.from(table).select(columns).eq('user_id',userId).order('id').range(offset,offset+499);
  if(error)throw error; rows.push(...data); if(data.length<500)return rows;
 }
}
export async function loadAccount(userId){
 const [items,receipts,budgets]=await Promise.all([allRows('transactions',userId),allRows('receipts',userId),allRows('monthly_budgets',userId)]);
 return {items:items.sort((a,b)=>b.transaction_date.localeCompare(a.transaction_date)||b.created_at.localeCompare(a.created_at)),receipts:receipts.sort((a,b)=>b.created_at.localeCompare(a.created_at)),budgets};
}
export async function saveTransaction(userId,values,id){
 const query=id?supabase.from('transactions').update(values).eq('id',id).eq('user_id',userId):supabase.from('transactions').insert({...values,user_id:userId});
 const {data,error}=await query.select().single(); if(error)throw error; return data;
}
export async function deleteTransaction(userId,id){const {error}=await supabase.from('transactions').delete().eq('user_id',userId).eq('id',id).select('id').single();if(error)throw error;}
export const receiptBucket=()=>supabase.storage.from('finflow-receipts');
export async function saveReceipt(userId,transaction,file,assertCurrent=()=>{}){
 assertCurrent();
 const types={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf'};
 if(!types[file.type]||file.size===0||file.size>10*1024*1024)throw new Error('Choose a JPG, PNG, WEBP or PDF between 1 byte and 10 MB.');
 const path=`${userId}/${crypto.randomUUID()}.${types[file.type]}`;
 const {error:upError}=await receiptBucket().upload(path,file,{contentType:file.type,upsert:false});if(upError)throw upError;
 assertCurrent();
 const {data,error}=await supabase.from('receipts').insert({user_id:userId,transaction_id:transaction.id,storage_path:path,merchant:transaction.merchant,receipt_date:transaction.transaction_date,total:transaction.amount,suggested_category:transaction.category,extraction_status:'verified'}).select().single();
 if(error){const {error:cleanup}=await receiptBucket().remove([path]);throw new Error(cleanup?'Receipt metadata failed and its private file needs cleanup.':'Receipt metadata failed; the uploaded file was removed.');}return data;
}
export async function signedReceiptUrl(path){const {data,error}=await receiptBucket().createSignedUrl(path,60);if(error)throw error;return data.signedUrl;}
export async function removeReceipt(userId,receipt,assertCurrent=()=>{}){
 assertCurrent();
 if(!receipt.storage_path.startsWith(userId+'/'))throw new Error('Receipt does not belong to this account.');
 const {error:storageError}=await receiptBucket().remove([receipt.storage_path]);if(storageError)throw storageError;
 assertCurrent();
 const {error}=await supabase.from('receipts').delete().eq('id',receipt.id).eq('user_id',userId).select('id').single();
 if(error)throw new Error('Image deleted, but metadata cleanup failed: '+error.message);
}
