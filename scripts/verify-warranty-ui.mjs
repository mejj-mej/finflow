import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

// Zero dependencies. Edge/Chromium's DevTools protocol drives an isolated profile.
const output=resolve('../.ui-verification');
const profile=output+'/edge-profile-'+Date.now();
await mkdir(output,{recursive:true});
const resultsOnly=process.argv.includes('--brief');
const browserPath=process.env.FINFLOW_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const proc=spawn(browserPath,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
proc.on('error',e=>{console.error(e.message);process.exitCode=1});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let ws,closing=false;
try {
 let port;
 for(let i=0;i<60;i++){try{port=Number((await readFile(profile+'/DevToolsActivePort','utf8')).split('\n')[0]);if(port)break}catch{}await pause(100)}
 if(!port)throw new Error('Headless browser did not provide a DevTools port.');
 const targets=await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 ws=new WebSocket(targets.find(x=>x.type==='page').webSocketDebuggerUrl);
 await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),events=new Map(),errors=[];
 function send(method,params={}){return new Promise((resolve,reject)=>{const request=++id;const timeout=setTimeout(()=>{pending.delete(request);reject(new Error('Timed out: '+method))},15000);pending.set(request,{resolve,reject,timeout});ws.send(JSON.stringify({id:request,method,params}))})}
 ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timeout);pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result)}}else{for(const fn of events.get(m.method)||[])fn(m.params)}};
 function on(name,fn){events.set(name,[...(events.get(name)||[]),fn])}
 await send('Runtime.enable');await send('Page.enable');
 on('Runtime.exceptionThrown',p=>errors.push(p.exceptionDetails.exception?.description||p.exceptionDetails.text));
 const fixture=await readFile(new URL('./fixtures/supabase-ui.js',import.meta.url),'utf8');
 await send('Fetch.enable',{patterns:[{urlPattern:'*src/supabase.js*'},{urlPattern:'https://*'}]});
 on('Fetch.requestPaused',async p=>{
  try{if(p.request.url.includes('/src/supabase.js'))await send('Fetch.fulfillRequest',{requestId:p.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'application/javascript'}],body:Buffer.from(fixture).toString('base64')});else{errors.push('Unexpected external request: '+new URL(p.request.url).hostname);await send('Fetch.failRequest',{requestId:p.requestId,errorReason:'BlockedByClient'})}}catch(e){if(!closing)errors.push(e.message)}
 });
 async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value}
 async function until(expression){for(let i=0;i<80;i++){if(await evaluate(`!!(${expression})`))return;await pause(75)}throw new Error('UI wait failed: '+expression)}
 async function click(text,selector='button'){await evaluate(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(selector)})].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw Error('Control not found: '+${JSON.stringify(text)});b.click()})()`);await pause(100)}
 async function nav(name){await evaluate(`document.querySelector('nav button[aria-label="${name}"]').click()`);await pause(150)}
 async function screenshot(name){const {data}=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(output+'/'+name+'.png',Buffer.from(data,'base64'))}
 async function viewport(width){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false})}
 async function noOverflow(name,width){const result=await evaluate(`({scroll:document.documentElement.scrollWidth,width:innerWidth,overflow:[...document.querySelectorAll('main *, .sidebar *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(e=>e.tagName+'.'+e.className)})`);assert.ok(result.scroll<=width+1,`${name}@${width}: ${JSON.stringify(result)}`)}
 const checks=[];
 async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
 async function field(label,value,index=0){await evaluate(`(()=>{const e=[...document.querySelectorAll('.entry label')].filter(x=>x.textContent.startsWith(${JSON.stringify(label)}))[${index}]?.querySelector('input,select,textarea');if(!e)throw Error('Missing field: '+${JSON.stringify(label)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await pause(70);}
 async function checkbox(label){await evaluate(`(()=>{const e=[...document.querySelectorAll('.entry label')].find(x=>x.textContent.includes(${JSON.stringify(label)}))?.querySelector('input[type=checkbox]');if(!e)throw Error('Missing checkbox');e.click();})()`);await pause(70);}
 async function action(label){await evaluate(`document.querySelector('button[aria-label="${label}"]').click()`);await pause(100);}
 await send('Page.navigate',{url:'http://127.0.0.1:5178/'});await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);
 await check('responsive list, receipt library and multi-product editor at six widths',async()=>{
  for(const width of [320,375,430,768,1024,1440]){
   await viewport(width);await nav('Warranties');await until(`document.querySelectorAll('.warranty-card').length===3`);await noOverflow('Warranties',width);
   const targets=await evaluate(`[...document.querySelectorAll('nav button')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}))`);assert.ok(targets.every(t=>t.width>=44&&t.height>=44));
   if(width===375||width===1440)await screenshot('warranties-'+width);
   await click('+ Add warranty');await until(`document.querySelector('.warranty-editor')`);await click('+ Add another product');await noOverflow('Two-product editor',width);
   await click('Cancel');await nav('Receipts');await noOverflow('Receipt management',width);
   await nav('Scan Receipt');await checkbox('Has warranty');await noOverflow('Upload warranty form',width);
  }
 });
 await viewport(1440);await nav('Warranties');
 await check('search and dynamic status filters',async()=>{
  await evaluate(`(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'keyboard');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await until(`document.querySelectorAll('.warranty-card').length===1`);
  await evaluate(`(()=>{const e=document.querySelector('input[type=search]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'');e.dispatchEvent(new Event('input',{bubbles:true}));document.querySelectorAll('.warranty-filters button')[2].click();})()`);await until(`document.querySelectorAll('.warranty-card').length===1 && document.querySelector('.warranty-card').textContent.includes('Travel mouse')`);
  await evaluate(`document.querySelector('.warranty-filters button').click()`);await until(`document.querySelectorAll('.warranty-card').length===3`);
 });
 let created;
 await check('missing purchase date and invalid form require explicit user input',async()=>{
  await click('+ Add warranty');await field('Linked receipt','receipt-2');
  assert.equal(await evaluate(`[...document.querySelectorAll('.entry label')].find(x=>x.textContent.startsWith('Warranty start date')).querySelector('input').value`),'');
  const count=await evaluate(`__finflowTest.tables.warranties.length`);await click('Save warranties');assert.equal(await evaluate(`__finflowTest.tables.warranties.length`),count);
  await field('Product name','Validation product');await field('Warranty start date','2024-01-31');await field('Warranty duration','0');assert.equal(await evaluate(`document.querySelector('.warranty-editor form').checkValidity()`),false);
  await click('Cancel');
 });
 await check('create two products with independent terms and official expiry preview',async()=>{
  await click('+ Add warranty');await field('Product name','Browser keyboard');await field('Warranty start date','2024-01-31');await field('Warranty duration','1');
  assert.ok(await evaluate(`document.querySelector('.warranty-preview').textContent.includes('2024-02-29')`));
  await checkbox('Use an exact expiration date');await field('Exact expiration date','2024-03-15');
  assert.ok(await evaluate(`document.querySelector('.warranty-preview').textContent.includes('2024-03-15')`));
  await click('+ Add another product');await field('Product name','Browser mouse',1);await field('Warranty start date','2024-02-29',1);await field('Duration unit','years',1);await field('Warranty duration','1',1);
  await click('Save warranties');await until(`!document.querySelector('.warranty-editor') && document.querySelectorAll('.warranty-card').length===5`);
  const rows=await evaluate(`__finflowTest.tables.warranties.filter(x=>x.product_name.startsWith('Browser '))`);assert.equal(rows.length,2);assert.equal(rows[0].receipt_id,rows[1].receipt_id);assert.equal(rows[0].expiration_date,'2024-03-15');assert.equal(rows[1].expiration_date,'2025-02-28');created=rows[0];
 });
 await check('edit warranty and clear manual override',async()=>{
  await action('Edit warranty for Browser keyboard');await field('Product name','Edited keyboard');await checkbox('Use an exact expiration date');await click('Save warranty changes');await until(`!document.querySelector('.warranty-editor')`);
  const row=await evaluate(`__finflowTest.tables.warranties.find(x=>x.id===${JSON.stringify(created.id)})`);assert.equal(row.product_name,'Edited keyboard');assert.equal(row.expiration_date,'2024-02-29');assert.equal(row.expiration_date_override,null);
 });
 await check('warranty deletion is explicit and preserves receipt/transactions',async()=>{
  await evaluate(`globalThis.__confirmations=[];window.confirm=text=>{__confirmations.push(text);return false;}`);
  await action('Delete warranty for Edited keyboard');assert.ok(await evaluate(`__finflowTest.tables.warranties.some(x=>x.id===${JSON.stringify(created.id)})`));
  const before=await evaluate(`({receipts:__finflowTest.tables.receipts.length,transactions:__finflowTest.tables.transactions.length})`);
  await evaluate(`window.confirm=text=>{__confirmations.push(text);return true;}`);await action('Delete warranty for Edited keyboard');await until(`!__finflowTest.tables.warranties.some(x=>x.id===${JSON.stringify(created.id)})`);
  assert.deepEqual(await evaluate(`({receipts:__finflowTest.tables.receipts.length,transactions:__finflowTest.tables.transactions.length})`),before);
  assert.ok(await evaluate(`__confirmations.every(t=>t.includes('receipt and transaction will remain'))`));
 });
 await check('receipt access reuses a 60-second signed URL',async()=>{
  await evaluate(`window.open=(...args)=>{globalThis.__opened=args;};`);await action('View receipt for Wireless keyboard');await until(`globalThis.__opened`);
  const sign=await evaluate(`__finflowTest.calls.filter(c=>c.operation==='sign').at(-1)`);assert.equal(sign.expiresIn,60);assert.ok(sign.path.startsWith('ui-test-user/'));
 });
 await check('upload failure recovers warranties without duplicate expense, file or products',async()=>{
  await nav('Scan Receipt');await field('Merchant','Synthetic receipt purchase');await field('Amount (PHP)','123.45');
  await evaluate(`(()=>{const input=document.querySelector('.dropzone input'),dt=new DataTransfer();dt.items.add(new File(['synthetic document'],'test.pdf',{type:'application/pdf'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await checkbox('Has warranty');await field('Product name','Upload product');await checkbox('I reviewed');
  const before=await evaluate(`({transactions:__finflowTest.tables.transactions.length,uploads:__finflowTest.calls.filter(c=>c.table==='storage'&&c.operation==='upload').length})`);
  await evaluate(`__finflowTest.failNext('warranties','insert',true)`);await click('Confirm & save expense');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Retry warranty saving')`);
  await click('Retry warranty saving');await until(`document.querySelector('.warranties-page')`);
  const after=await evaluate(`({transactions:__finflowTest.tables.transactions.length,uploads:__finflowTest.calls.filter(c=>c.table==='storage'&&c.operation==='upload').length,products:__finflowTest.tables.warranties.filter(w=>w.product_name==='Upload product').length})`);assert.equal(after.transactions,before.transactions+1);assert.equal(after.uploads,before.uploads+1);assert.equal(after.products,1);
 });
 await check('receipt count failures stop deletion; confirmation names cascade; cancelling preserves records',async()=>{
  await nav('Receipts');await evaluate(`__finflowTest.failNext('warranties','read');globalThis.__confirmations=[];window.confirm=t=>{__confirmations.push(t);return false;};`);
  const before=await evaluate(`__finflowTest.tables.receipts.length`);await click('Delete receipt');await until(`document.querySelector('.notice')?.textContent.includes('Receipt deletion failed')`);assert.equal(await evaluate(`__confirmations.length`),0);
  await click('Delete receipt');assert.equal(await evaluate(`__finflowTest.tables.receipts.length`),before);assert.ok(await evaluate(`__confirmations.at(-1).includes('linked')&&__confirmations.at(-1).includes('permanently deleted')`));
  await evaluate(`window.confirm=t=>{__confirmations.push(t);return true;};globalThis.__deletedReceipt=__finflowTest.tables.receipts.find(r=>r.merchant===document.querySelector('.receipt-row b').textContent).id;globalThis.__transactionCount=__finflowTest.tables.transactions.length;`);await click('Delete receipt');await until(`!__finflowTest.tables.receipts.some(r=>r.id===__deletedReceipt)`);
  assert.equal(await evaluate(`__finflowTest.tables.warranties.filter(w=>w.receipt_id===__deletedReceipt).length`),0);assert.equal(await evaluate(`__finflowTest.tables.transactions.length===__transactionCount`),true);
 });
 await check('warranty load error leaves finance usable and supports retry',async()=>{
  await nav('Warranties');await evaluate(`__finflowTest.failNext('warranties','read')`);await click('Refresh');await until(`[...document.querySelectorAll('button')].some(b=>b.textContent==='Retry warranties')`);
  await nav('Dashboard');assert.ok(await evaluate(`!!document.querySelector('.metrics')`));await nav('Warranties');await click('Retry warranties');await until(`!document.querySelector('.warranty-library [role=alert]')`);
 });
 await check('account switch discards delayed loads, including returning to the same user',async()=>{
  await nav('Warranties');await evaluate(`__finflowTest.holdNext('warranties','read')`);await click('Refresh');await until(`!!__finflowTest.release`);
  await evaluate(`__finflowTest.switchUser('second-user')`);await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);await nav('Warranties');assert.equal(await evaluate(`document.querySelectorAll('.warranty-card').length`),0);
  await evaluate(`__finflowTest.switchUser(null);__finflowTest.switchUser('ui-test-user')`);await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);await evaluate(`__finflowTest.release()`);await nav('Warranties');await until(`document.querySelectorAll('.warranty-card').length>0`);
  assert.equal(await evaluate(`document.querySelector('.notice')?.textContent||''`),'');
 });
 await check('account switch discards delayed old-account mutation response, including returning to same user',async()=>{
  await action('Edit warranty for Wireless keyboard');await field('Product name','Old account delayed product');await evaluate(`__finflowTest.holdNext('warranties','update')`);await click('Save warranty changes');await until(`!!__finflowTest.release`);
  assert.ok(await evaluate(`[...document.querySelectorAll('nav button')].every(b=>b.disabled)`));
  await evaluate(`__finflowTest.switchUser('second-user')`);await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);await nav('Warranties');assert.equal(await evaluate(`document.querySelectorAll('.warranty-card').length`),0);
  await evaluate(`__finflowTest.switchUser(null);__finflowTest.switchUser('ui-test-user')`);await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);await evaluate(`__finflowTest.release()`);await pause(200);
  assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Overview');assert.equal(await evaluate(`document.querySelector('.notice')?.textContent||''`),'');
 });
 await check('reduced motion, keyboard focus and empty account state',async()=>{
  await nav('Warranties');await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await evaluate(`getComputedStyle(document.querySelector('.pagecontent')).animationName`),'none');
  await evaluate(`document.querySelector('.warranty-intro button').focus()`);await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});assert.equal(await evaluate(`getComputedStyle(document.activeElement).outlineWidth`),'3px');
  await evaluate(`__finflowTest.switchUser('second-user')`);await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);await nav('Warranties');assert.ok(await evaluate(`document.querySelector('.warranty-empty').textContent.includes('Upload a receipt first')`));
 });
 assert.deepEqual(errors,[]);await writeFile(output+'/warranty-report.json',JSON.stringify({checks,runtimeErrors:errors,data:'Synthetic in-memory browser fixture; external requests blocked'},null,2));
 console.log(`${checks.length} warranty browser scenarios passed; no external data writes.`);
 closing=true;await send('Browser.close').catch(()=>{});
}finally{closing=true;if(ws?.readyState===1)ws.send(JSON.stringify({id:999999,method:'Browser.close'}));await pause(100);ws?.close();proc.kill();}
