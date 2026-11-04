import React,{useId} from 'react';
import {calculateExpiration,effectiveExpiration,warrantyDraft} from './warranties.js';

export function followPurchaseDate(draft,purchaseDate){return draft.startEdited?draft:{...draft,warranty_start_date:purchaseDate||''};}

export function WarrantyFields({value,onChange}){
 const id=useId();
 const change=(key,next)=>onChange({...value,[key]:next});
 let preview='',computed='',problem='';
 try{computed=calculateExpiration(value.warranty_start_date,value.warranty_duration,value.warranty_duration_unit);preview=effectiveExpiration(value);}catch(e){problem=e.message;}
 const manual=value.manualExpiration??Boolean(value.expiration_date_override);
 return <div className="warranty-fields">
  <label>Product name<input required maxLength={300} value={value.product_name} onChange={e=>change('product_name',e.target.value)} autoComplete="off"/></label>
  <label>Brand / model (optional)<input maxLength={200} value={value.brand_model||''} onChange={e=>change('brand_model',e.target.value)}/></label>
  <div className="two"><label>Warranty duration<input type="number" inputMode="numeric" min="1" max={value.warranty_duration_unit==='years'?100:1200} step="1" required value={value.warranty_duration} onChange={e=>change('warranty_duration',e.target.value)}/></label>
  <label>Duration unit<select value={value.warranty_duration_unit} onChange={e=>change('warranty_duration_unit',e.target.value)}><option value="months">Months</option><option value="years">Years</option></select></label></div>
  <label>Warranty start date<input required type="date" min="0001-01-01" max="9999-12-31" value={value.warranty_start_date} onChange={e=>onChange({...value,warranty_start_date:e.target.value,startEdited:true})}/><span className="muted">Starts on the purchase date unless you change it.</span></label>
  <label className="warranty-check"><input type="checkbox" checked={manual} onChange={e=>onChange({...value,manualExpiration:e.target.checked,expiration_date_override:e.target.checked?(value.expiration_date_override||computed):''})}/>Use an exact expiration date</label>
  {manual&&<label>Exact expiration date<input type="date" required min={value.warranty_start_date||'0001-01-01'} max="9999-12-31" value={value.expiration_date_override||''} onChange={e=>change('expiration_date_override',e.target.value)} aria-describedby={id}/><span className="muted" id={id}>Use the date stated in the official warranty terms.</span></label>}
  <div className="warranty-preview" aria-live="polite"><span>{manual?'Official expiration':'Calculated expiration'}</span><strong>{preview||'Complete the warranty dates'}</strong>{problem&&<small>{problem}</small>}{manual&&computed&&<small>From duration: {computed}</small>}</div>
  <label>Warranty notes (optional)<textarea maxLength={5000} rows={3} value={value.notes||''} onChange={e=>change('notes',e.target.value)}/></label>
 </div>;
}

export default function WarrantyInformation({enabled,setEnabled,drafts,setDrafts,purchaseDate,busy=false}){
 return <section className="warranty-information" aria-label="Warranty Information">
  <h3>Warranty Information</h3><p className="muted">Optional protection for the products on this receipt.</p>
  <label className="warranty-check"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>{setEnabled(e.target.checked);if(e.target.checked&&!drafts.length)setDrafts([warrantyDraft(purchaseDate)]);}}/>Has warranty</label>
  {enabled&&<><div className="warranty-drafts">{drafts.map((draft,index)=><fieldset disabled={busy} className="warranty-product" key={index}><legend>Product {index+1}</legend>
   <WarrantyFields value={followPurchaseDate(draft,purchaseDate)} onChange={next=>setDrafts(old=>old.map((item,i)=>i===index?next:item))}/>
   {drafts.length>1&&<button type="button" className="delete" onClick={()=>setDrafts(old=>old.filter((_,i)=>i!==index))}>Remove product {index+1} draft</button>}
  </fieldset>)}</div><button type="button" disabled={busy} onClick={()=>setDrafts(old=>[...old,warrantyDraft(purchaseDate)])}>+ Add another product</button></>}
 </section>;
}
