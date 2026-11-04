import React,{useEffect,useRef,useState} from 'react';
import WarrantyInformation,{WarrantyFields,followPurchaseDate} from './WarrantyForm.jsx';
import {filterWarranties,warrantyDraft,warrantyPayload,warrantyStatus} from './warranties.js';
import {today} from './transactions.js';
import {warrantyData} from './useWarranties.js';
import Icon from './Icon.jsx';

const statuses=['All','Active','Expiring soon','Expired'];
const receiptLabel=r=>`${r.merchant||'Receipt'} · ${r.receipt_date||'Date not recorded'}`;

export default function Warranties({store,receipts,userId,scope,openReceipt,receiptSelection,setReceiptSelection,onBusyChange}){
 const [search,setSearch]=useState(''),[filter,setFilter]=useState('All'),[day,setDay]=useState(today);
 const [editor,setEditor]=useState(null),[drafts,setDrafts]=useState([]),[enabled,setEnabled]=useState(true),[receiptId,setReceiptId]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failure,setFailure]=useState(false);
 const lock=useRef(false),editorTitle=useRef(null);
 useEffect(()=>{const refresh=()=>setDay(today());const timer=setInterval(refresh,30000);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};},[]);
 useEffect(()=>{if(editor)editorTitle.current?.focus();},[editor]);
 function start(row=null){if(lock.current)return;setMessage('');setFailure(false);setReceiptId(row?.receipt_id||receiptSelection||receipts[0]?.id||'');setEnabled(true);setEditor(row||{});setDrafts(row?[{...row,startEdited:true,manualExpiration:Boolean(row.expiration_date_override)}]:[warrantyDraft()]);}
 const receipt=receipts.find(r=>r.id===receiptId);
 async function save(e){
  e.preventDefault();if(lock.current)return;
  const values=editor.id?drafts:drafts.map(d=>followPurchaseDate(d,receipt?.receipt_date));
  try{if(!enabled)throw new Error('Enable Has warranty to save, or cancel.');values.forEach(d=>warrantyPayload(d,receiptId));}catch(error){setFailure(true);setMessage(error.message);return;}
  lock.current=true;setBusy(true);onBusyChange(true);setMessage('');
  try{
   scope.assert();
   if(editor.id)await warrantyData.edit(userId,editor.id,values[0],receiptId);else await warrantyData.add(userId,values,receiptId);
   if(!scope.current())return;
   setEditor(null);setFailure(false);setMessage(editor.id?'Warranty updated.':'Warranty information saved.');await store.reload();
  }catch(error){if(scope.current()){setFailure(true);setMessage('Could not save warranty information. Your entries are still here; check your connection and try again.');}}
  finally{lock.current=false;if(scope.current()){setBusy(false);onBusyChange(false);}}
 }
 async function remove(row){
  if(lock.current||!window.confirm(`Delete the warranty for “${row.product_name}”? Its receipt and transaction will remain.`))return;
  lock.current=true;setBusy(true);onBusyChange(true);
  try{scope.assert();await warrantyData.remove(userId,row.id);if(!scope.current())return;setFailure(false);setMessage('Warranty deleted. Receipt and transaction kept.');await store.reload();}
  catch(error){if(scope.current()){setFailure(true);setMessage('Could not delete the warranty. Please retry.');}}
  finally{lock.current=false;if(scope.current()){setBusy(false);onBusyChange(false);}}
 }
 const eligible=store.rows.filter(w=>receipts.some(r=>r.id===w.receipt_id));
 const counts=Object.fromEntries(statuses.map(s=>[s,s==='All'?eligible.length:eligible.filter(w=>warrantyStatus(w.expiration_date,day).status===s).length]));
 const visible=filterWarranties(eligible,receipts,{search,status:filter,receiptId:receiptSelection,today:day});
 return <div className="warranties-page">
  <section className="warranty-intro panel"><div><span className="eyebrow">A LITTLE PEACE OF MIND</span><h2>Keep track of what’s covered.</h2><p className="muted">Products, protection, and the receipt you’ll need. All in one place.</p></div><button className="primary" disabled={busy||!receipts.length||store.loading||Boolean(store.error)} onClick={()=>start()}>+ Add warranty</button></section>
  <div className="warranty-summary" aria-label="Warranty summary">{statuses.slice(1).map((s,i)=><button type="button" key={s} className={'warranty-stat warranty-stat-'+i} aria-pressed={filter===s} onClick={()=>setFilter(s)}><span>{s}</span><strong>{store.loading||store.error?'—':counts[s]}</strong><small>{['More than 30 days left','Through the next 30 days','Coverage has ended'][i]}</small></button>)}</div>
  {message&&<p className={'notice '+(failure?'warranty-error':'')} role={failure?'alert':'status'}>{message}</p>}
  {editor&&<section className="panel warranty-editor"><div className="panelhead"><h2 ref={editorTitle} tabIndex={-1}>{editor.id?'Edit warranty':'Add warranty'}</h2><button type="button" disabled={busy} onClick={()=>setEditor(null)}>Cancel</button></div>
   <form className="entry" onSubmit={save}><fieldset className="formfields" disabled={busy}>
    <label>Linked receipt<select required value={receiptId} onChange={e=>setReceiptId(e.target.value)}><option value="">Select a receipt</option>{receipts.map(r=><option key={r.id} value={r.id}>{receiptLabel(r)}</option>)}</select></label>
    {editor.id?<section className="warranty-information"><h3>Warranty Information</h3><label className="warranty-check"><input type="checkbox" checked disabled/>Has warranty</label><p className="muted">Use Delete warranty in the product list to remove this record.</p><WarrantyFields value={drafts[0]} onChange={value=>setDrafts([value])}/></section>:<WarrantyInformation enabled={enabled} setEnabled={setEnabled} drafts={drafts} setDrafts={setDrafts} purchaseDate={receipt?.receipt_date||''} busy={busy}/>}
    <button className="primary" type="submit">{busy?'Saving…':editor.id?'Save warranty changes':'Save warranties'}</button>
   </fieldset></form>
  </section>}
  <section className="panel warranty-library" aria-busy={store.loading}>
   <div className="panelhead"><h2>Your warranties</h2><button disabled={busy||store.loading} onClick={store.reload}>Refresh</button></div>
   <div className="filters"><label>Search products or receipts<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Product, brand, or merchant"/></label><label>Linked receipt filter<select value={receiptSelection} onChange={e=>setReceiptSelection(e.target.value)}><option value="">All receipts</option>{receipts.map(r=><option key={r.id} value={r.id}>{receiptLabel(r)}</option>)}</select></label></div>
   <div className="warranty-filters" role="group" aria-label="Warranty status filter">{statuses.map(s=><button key={s} aria-pressed={filter===s} onClick={()=>setFilter(s)}>{s} <span>{store.loading||store.error?'—':counts[s]}</span></button>)}</div>
   {store.loading?<p role="status" className="empty">Loading your warranties…</p>:store.error?<div className="empty" role="alert"><p>{store.error}</p><button onClick={store.reload}>Retry warranties</button></div>:!visible.length?<div className="empty warranty-empty"><Icon name="Warranties"/><h3>{eligible.length?'No matching warranties':'Your coverage starts here'}</h3><p>{eligible.length?'Try another search or filter.':receipts.length?'Add warranty details to a private receipt to keep track of its coverage.':'Upload a receipt first, then add warranty details for its products.'}</p>{eligible.length>0&&<button onClick={()=>{setSearch('');setFilter('All');setReceiptSelection('');}}>Clear filters</button>}</div>:<div className="warranty-list">{visible.map(w=>{
    const r=receipts.find(r=>r.id===w.receipt_id),{days,status}=warrantyStatus(w.expiration_date,day);
    return <article className="warranty-card" key={w.id}><div className="warranty-card-head"><span className="warranty-shield"><Icon name="Warranties"/></span><div><h3>{w.product_name}</h3><p className="muted">{w.brand_model||'Product warranty'}</p></div><span className={'warranty-badge status-'+status.toLowerCase().replaceAll(' ','-')}>{status}</span></div>
     <dl className="warranty-dates"><div><dt>Purchased</dt><dd>{r?.receipt_date||'Not recorded'}</dd></div><div><dt>Coverage starts</dt><dd>{w.warranty_start_date}</dd></div><div><dt>Expires{w.expiration_date_override?' · exact date':''}</dt><dd>{w.expiration_date}</dd></div></dl>
     <p className="warranty-remaining">{days<0?`Expired ${Math.abs(days)} ${Math.abs(days)===1?'day':'days'} ago`:days===0?'Expires today':`${days} ${days===1?'day':'days'} remaining`}</p>
     {w.notes&&<p className="warranty-notes">{w.notes}</p>}
     <div className="warranty-card-actions"><button disabled={busy} onClick={()=>openReceipt(r)} aria-label={'View receipt for '+w.product_name}>View receipt <span className="sr-only">for {w.product_name}</span></button><button disabled={busy} onClick={()=>start(w)} aria-label={'Edit warranty for '+w.product_name}>Edit</button><button className="delete" disabled={busy} onClick={()=>remove(w)} aria-label={'Delete warranty for '+w.product_name}>Delete warranty</button></div><small className="muted warranty-receipt-label">{r?.merchant||'Linked private receipt'}</small>
    </article>;
   })}</div>}
  </section>
 </div>;
}
