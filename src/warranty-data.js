import {warrantyPayload} from './warranties.js';
// Client injection keeps tests isolated from credentials and the live database.
export function createWarrantyData(client){
 const service={
  async list(userId){
   const rows=[];
   for(let offset=0;;offset+=500){
    const {data,error}=await client.from('warranties').select('*').eq('user_id',userId).order('id').range(offset,offset+499);
    if(error)throw error;rows.push(...data);if(data.length<500)return rows;
   }
  },
  async add(userId,drafts,receiptId){
   if(!drafts.length)throw new Error('Add at least one product.');
   const values=drafts.map(d=>({...warrantyPayload(d,receiptId),user_id:userId}));
   const {data,error}=await client.from('warranties').insert(values).select();
   if(error)throw error;return data;
  },
  async edit(userId,id,draft,receiptId){
   const {data,error}=await client.from('warranties').update(warrantyPayload(draft,receiptId)).eq('user_id',userId).eq('id',id).select().single();
   if(error)throw error;return data;
  },
  async remove(userId,id){
   const {error}=await client.from('warranties').delete().eq('user_id',userId).eq('id',id).select('id').single();
   if(error)throw error;
  },
  async count(userId,receiptId){
   const {count,error}=await client.from('warranties').select('id',{count:'exact',head:true}).eq('user_id',userId).eq('receipt_id',receiptId);
   if(error)throw error;if(!Number.isSafeInteger(count)||count<0)throw new Error('Could not verify linked warranties.');return count;
  },
  async attach(userId,drafts,receiptId,assertCurrent=()=>{}){
   assertCurrent();
   if(!drafts.length)throw new Error('Add at least one product.');
   // Upload receipts are new. Read back a prior attempt before retrying so a
   // lost response cannot create duplicate warranties for that new receipt.
   const {data,error}=await client.from('warranties').select('*').eq('user_id',userId).eq('receipt_id',receiptId);
   if(error)throw error;
   assertCurrent();
   if(data.length){
    const fields=Object.keys(warrantyPayload(drafts[0],receiptId));
    const signature=row=>JSON.stringify(fields.map(key=>row[key]??null));
    const expected=drafts.map(d=>signature(warrantyPayload(d,receiptId))).sort();
    const actual=data.map(signature).sort();
    if(JSON.stringify(expected)===JSON.stringify(actual))return data;
    throw new Error('This receipt already has warranty information. Manage it from Warranties.');
   }
   return service.add(userId,drafts,receiptId);
  }
 };
 return service;
}
