// Isolated PostgreSQL validation; never connects to Supabase or reads .env files.
// Install the pinned test-only engine outside application dependencies:
// npm.cmd install --prefix .ui-verification/warranty-db --save-exact @electric-sql/pglite@0.5.15
import {readFile, readdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {PGlite} from '../.ui-verification/warranty-db/node_modules/@electric-sql/pglite/dist/index.js';

const proposal=await readFile(new URL('../docs/warranty-tracker-proposal.md',import.meta.url),'utf8');
const reviewedSQL=proposal.match(/```sql\r?\n([\s\S]*?)```/)[1].trim();
let sql=reviewedSQL;
try {
 const files=(await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(x=>x.endsWith('_add_warranty_tracker.sql'));
 if(files.length){assert.equal(files.length,1);sql=(await readFile(new URL('../supabase/migrations/'+files[0],import.meta.url),'utf8')).trim();assert.equal(sql.replaceAll('\r\n','\n'),reviewedSQL.replaceAll('\r\n','\n'),'Migration must match approved SQL');}
}catch(error){if(error.code!=='ENOENT')throw error;}

const db=new PGlite();
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002';
const ra='20000000-0000-4000-8000-000000000001',rb='20000000-0000-4000-8000-000000000002';
let checks=0;
async function check(name,run){await run();checks++;console.log('PASS '+name);}
const rows=async(query,params=[]) => (await db.query(query,params)).rows;
const insert=(receipt=ra,owner=a)=>db.query(`insert into public.warranties
 (user_id,receipt_id,product_name,warranty_start_date,warranty_duration,warranty_duration_unit)
 values ($1,$2,'Synthetic product','2024-01-31',1,'months') returning *`,[owner,receipt]);
try {
 await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as
 $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema public,auth to anon,authenticated;
 create table public.transactions(id uuid primary key,user_id uuid references auth.users(id));
 create table public.receipts(id uuid primary key,user_id uuid not null references auth.users(id),transaction_id uuid references public.transactions(id));
 alter table public.receipts enable row level security;
 create policy receipt_owner on public.receipts for all to authenticated
 using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
 grant select,insert,update,delete on public.receipts to authenticated;
 -- Simulate broad Supabase defaults: the migration must remove these client grants.
 alter default privileges in schema public grant all on tables to anon,authenticated;
 alter default privileges in schema public grant execute on functions to anon,authenticated;
 insert into auth.users values ('${a}'),('${b}');
 insert into public.transactions values ('30000000-0000-4000-8000-000000000001','${a}');
 insert into public.receipts values ('${ra}','${a}','30000000-0000-4000-8000-000000000001'),('${rb}','${b}',null);
 `);
 await check('approved migration executes on isolated PostgreSQL',()=>db.exec(sql));
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
 let first;
 await check('own receipt insert, generated leap-month expiry and timestamp trigger',async()=>{
  first=(await insert()).rows[0];
  assert.equal((await rows('select expiration_date::text as value from warranties where id=$1',[first.id]))[0].value,'2024-02-29');
  assert.ok(first.created_at);assert.ok(first.updated_at);
 });
 await check('several products can share a receipt',async()=>{await insert();assert.equal((await rows('select count(*)::int as count from warranties'))[0].count,2);});
 await check('another user receipt and forged owner rejected',async()=>{
  await assert.rejects(insert(rb),/row-level security/);
  await assert.rejects(insert(ra,b),/row-level security/);
 });
 await check('cross-user reads, edits and deletes denied',async()=>{
  await db.exec(`select set_config('request.jwt.claim.sub','${b}',false);`);
  assert.equal((await rows('select * from warranties')).length,0);
  assert.equal((await db.query("update warranties set product_name='Forbidden' where id=$1 returning id",[first.id])).rows.length,0);
  assert.equal((await db.query('delete from warranties where id=$1 returning id',[first.id])).rows.length,0);
  await db.exec(`select set_config('request.jwt.claim.sub','${a}',false);`);
 });
 await check('receipt relinking and owner reassignment blocked',async()=>{
  await assert.rejects(db.query('update warranties set receipt_id=$1 where id=$2',[rb,first.id]),/row-level security/);
  await assert.rejects(db.query('update warranties set user_id=$1 where id=$2',[b,first.id]),/permission denied/);
 });
 await check('generated expiry, ID, timestamps and TRUNCATE protected',async()=>{
  for(const field of ['expiration_date','id','created_at','updated_at'])await assert.rejects(db.query(`update warranties set ${field}=${field} where id=$1`,[first.id]),/permission denied|generated|only be updated to DEFAULT/);
  await assert.rejects(db.exec('truncate warranties'),/permission denied/);
  await assert.rejects(db.exec('select public.finflow_warranty_timestamps()'),/permission denied/);
 });
 await check('override applies; clearing restores automatic date; edits preserve created_at',async()=>{
  await db.query("update warranties set product_name='Edited',expiration_date_override='2025-03-01' where id=$1",[first.id]);
  assert.equal((await rows('select expiration_date::text as value from warranties where id=$1',[first.id]))[0].value,'2025-03-01');
  const edited=(await rows('update warranties set expiration_date_override=null where id=$1 returning *',[first.id]))[0];
  assert.equal(new Date(edited.created_at).valueOf(),new Date(first.created_at).valueOf());
  assert.equal((await rows('select expiration_date::text as value from warranties where id=$1',[first.id]))[0].value,'2024-02-29');
 });
 await check('invalid terms, expiry and blank product rejected',async()=>{
  for(const assignment of ["warranty_duration=0","warranty_duration_unit='days'","product_name=' '","expiration_date_override='2020-01-01'"])
   await assert.rejects(db.query('update warranties set '+assignment+' where id=$1',[first.id]),/check constraint/);
 });
 await check('warranty deletion preserves receipt and transaction',async()=>{
  await db.query('delete from warranties where id=$1',[first.id]);
  assert.equal((await rows('select * from receipts where id=$1',[ra])).length,1);
  await db.exec('reset role');
  assert.equal((await rows('select * from transactions')).length,1);
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${a}',false);`);
 });
 await check('receipt deletion cascades remaining warranties only',async()=>{
  await insert();
  assert.equal((await rows('select count(*)::int as count from warranties'))[0].count,2);
  await db.query('delete from receipts where id=$1',[ra]);
  assert.equal((await rows('select * from warranties')).length,0);
  await db.exec('reset role');
  assert.equal((await rows('select * from transactions')).length,1);
  assert.equal((await rows('select * from receipts')).length,1);
 });
 await check('anonymous CRUD denied',async()=>{
  await db.exec("set role anon; select set_config('request.jwt.claim.sub','',false);");
  for(const query of ['select * from warranties',"insert into warranties(product_name) values ('Forbidden')","update warranties set product_name='Forbidden'",'delete from warranties'])await assert.rejects(db.exec(query),/permission denied/);
 });
 console.log(`${checks} database checks passed. Synthetic isolated fixtures only.`);
}finally{await db.close();}
