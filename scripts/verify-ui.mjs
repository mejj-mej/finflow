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
 const reports=[];
 const contrast=[];
 async function checkContrast(selector,backdrop){
  const pair=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing contrast sample');return {text:getComputedStyle(e).color,background:getComputedStyle(e).backgroundImage,selector:${JSON.stringify(selector)}}})()`);
  // Conservative near-white canvas sample; includes a darker end of the ambient palette.
  const rgb=pair.text.match(/[\d.]+/g).slice(0,3).map(Number);
  const luminance=values=>values.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
  const bg=backdrop||(selector==='.primary'?pair.background.match(/rgba?\(([^)]+)/)[1].split(',').slice(0,3).map(Number):[236,233,245]);
  const a=luminance(rgb),b=luminance(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  assert.ok(ratio>=4.5,selector+' text contrast '+ratio.toFixed(2));contrast.push({...pair,ratio:Number(ratio.toFixed(2))});
 }

 await send('Page.navigate',{url:'http://127.0.0.1:5178/'});await until(`document.querySelector('.metrics') && !document.querySelector('.pagecontent').hidden`);
 for(const width of [320,375,430,768,1024,1440]){
  await viewport(width);await nav('Dashboard');await noOverflow('Dashboard',width);
  if(width===1440||width===375)await screenshot('dashboard-'+width);
  await nav('Transactions');await noOverflow('Transactions',width);
  await click('Add transaction');await until(`document.querySelector('.segmented')`);await noOverflow('Expense form',width);
  await click('Income');assert.equal(await evaluate(`document.querySelector('.segmented').dataset.selected`),'Income');assert.equal(await evaluate(`document.querySelector('button[type=submit]').textContent.trim()`),'Save Income');await noOverflow('Income form',width);
  if(width===375||width===1440)await screenshot('income-'+width);
  await nav('Scan Receipt');await noOverflow('Receipt workflow',width);assert.equal(await evaluate(`!!document.querySelector('.verification input[required]')`),true);assert.equal(await evaluate(`document.querySelectorAll('.segmented').length`),0);
  if(width===1440)await screenshot('receipt-'+width);
  await nav('Receipts');await noOverflow('Receipts',width);
  await nav('Settings');await noOverflow('Settings',width);
  reports.push({width,pages:['Dashboard','Transactions','Expense form','Income form','Scan Receipt','Receipts','Settings'],overflow:'none'});
 }
 await nav('Dashboard');for(const selector of ['.muted','.metric span','.metric small','.activity small','.eyebrow','.primary'])await checkContrast(selector);
  const canvas=await evaluate(`({texture:getComputedStyle(document.body,'::after').backgroundImage,mask:getComputedStyle(document.body,'::after').maskImage,animation:getComputedStyle(document.body,'::after').animationName,metric:getComputedStyle(document.querySelector('.metric')).backgroundColor})`);assert.ok(canvas.texture.includes('radial-gradient'));assert.equal(canvas.animation,'none');
 await checkContrast('.sidebar nav button:not(.active)',[48,45,66]);
 await checkContrast('.sidebar nav button.active',[225,221,255]);
 const palette=await evaluate(`Object.fromEntries(['plum','pearl','periwinkle','orchid','coral','violet'].map(name=>[name,getComputedStyle(document.documentElement).getPropertyValue('--color-'+name).trim()]))`);
 assert.deepEqual(palette,{plum:'#302D42',pearl:'#FAF9FC',periwinkle:'#E1DDFF',orchid:'#C7A6EC',coral:'#FFB9B0',violet:'#7859BE'});
 const cards=await evaluate(`[...document.querySelectorAll('.metric')].map(e=>({class:e.className,amount:getComputedStyle(e.querySelector('strong')).color,accent:getComputedStyle(e.querySelector('span'),'::before').backgroundColor,height:e.getBoundingClientRect().height}))`);
 assert.equal(await evaluate(`getComputedStyle(document.querySelector('h1')).color`),'rgb(48, 45, 66)');assert.equal(cards.length,4);assert.ok(cards.every(c=>c.amount==='rgb(48, 45, 66)'));assert.equal(new Set(cards.map(c=>c.accent)).size,4);assert.ok(Math.max(...cards.map(c=>c.height))-Math.min(...cards.map(c=>c.height))<1);
 // Drive real pointer states without submitting or changing a transaction.
 const box=await evaluate(`(()=>{const r=document.querySelector('.headeractions .primary').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await pause(270);
 const hover=await evaluate(`getComputedStyle(document.querySelector('.headeractions .primary')).transform`);assert.ok(hover.endsWith(', -2)'),hover);
 await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...box});await pause(270);
 const pressed=await evaluate(`getComputedStyle(document.querySelector('.headeractions .primary')).transform`);assert.ok(pressed.startsWith('matrix(0.98'),pressed);
 await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:box.x,y:box.y+90});
 await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:box.x,y:box.y+90});
 await evaluate(`document.querySelector('.headeractions .primary').disabled=true`);await send('Input.dispatchMouseEvent',{type:'mouseMoved',...box});await pause(270);
 const disabled=await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('.headeractions .primary'));return {opacity:s.opacity,cursor:s.cursor,transform:s.transform}})()`);assert.equal(disabled.opacity,'0.55');assert.equal(disabled.cursor,'not-allowed');assert.equal(disabled.transform,'none');
 await evaluate(`document.querySelector('.headeractions .primary').disabled=false`);
 const buttonStates={hover,pressed,disabled};
 // Check native keyboard focus, segmented animation, reduced motion and opaque input surfaces.
 await nav('Transactions');await click('Add transaction');
 await evaluate(`document.querySelector('.segmented button').focus()`);
 await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
 const focus=await evaluate(`({outline:getComputedStyle(document.activeElement).outlineStyle,width:getComputedStyle(document.activeElement).outlineWidth})`);assert.equal(focus.outline,'solid');assert.equal(focus.width,'3px');
 await evaluate(`document.activeElement.blur()`);
 const normal=await evaluate(`getComputedStyle(document.querySelector('.segmented'),'::before').transitionDuration`);assert.equal(normal,'0.24s');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 const reduced=await evaluate(`({transition:getComputedStyle(document.querySelector('.segmented'),'::before').transitionDuration,animation:getComputedStyle(document.querySelector('.pagecontent')).animationName})`);assert.equal(reduced.transition,'0s');assert.equal(reduced.animation,'none');

 const opacity=await evaluate(`getComputedStyle(document.querySelector('.entry input')).backgroundColor`);assert.equal(opacity,'rgb(255, 255, 255)');
 // Exercise the existing form through the UI to an isolated in-memory data response.
 async function field(label,value){await evaluate(`(()=>{const e=[...document.querySelectorAll('.entry label')].find(x=>x.textContent.startsWith(${JSON.stringify(label)}))?.querySelector('input');if(!e)throw Error('Missing field');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}))})()`)}
 await click('Income');await field('Income source','UI income check');await field('Amount received','120.25');await click('Save Income');await until(`document.querySelector('table')?.textContent.includes('UI income check')`);
 await click('Add transaction');await field('Merchant','UI expense check');await field('Amount (PHP)','35.50');await click('Save Expense');await until(`document.querySelector('table')?.textContent.includes('UI expense check')`);
 await evaluate(`sessionStorage.setItem('ui-no-budget','true')`);await send('Page.reload');await until(`document.querySelector('.metric-budget strong')?.textContent==='Not set'`);
 // Sign-in surface visual checks use the same isolated client fixture.
 await evaluate(`sessionStorage.setItem('ui-signed-out','true')`);await send('Page.reload');await until(`document.querySelector('.authbox input[type=email]')`);
 for(const width of [320,375,430,768,1024,1440]){await viewport(width);await noOverflow('Sign-in',width)}
 await screenshot('sign-in-1440');await click('Need an account? Sign up');assert.equal(await evaluate(`document.querySelector('h1').textContent`),'Create your account');
 assert.deepEqual(errors,[]);
 const report={browser:'Microsoft Edge headless',data:'In-memory browser fixture; no Supabase requests or writes',reports,keyboardFocus:focus,reducedMotion:reduced,inputBackground:opacity,formSubmission:'income and expense rendered in history using isolated fixture',authSurface:'sign-in/sign-up toggle and six viewport widths',foundationPalette:palette,summaryCards:cards,buttonStates,budgetEmptyState: 'Not set',canvasTexture:canvas,sampledTextContrast:contrast,runtimeErrors:errors};
 await writeFile(output+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(resultsOnly?{viewports:reports.length,pagesPerViewport:reports[0].pages.length,overflow:'none',keyboardFocus:focus,reducedMotion:reduced,forms:report.formSubmission,buttonStates,budgetEmptyState:report.budgetEmptyState,contrastSamples:contrast,runtimeErrors:errors}:report,null,2));
 closing=true;await send('Browser.close').catch(()=>{});
} finally {closing=true;if(ws?.readyState===1)ws.send(JSON.stringify({id:999999,method:'Browser.close'}));await pause(100);ws?.close();proc.kill();}
