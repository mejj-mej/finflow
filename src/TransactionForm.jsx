import React from 'react';
import { expenseCategories,incomeCategories,suggestExpenseCategory } from './transactions.js';
export default function TransactionForm({form,setForm,onSubmit,busy,receipt=false,editing=false,onCancel}) {
 const income=form.type==='Income'; const categories=income?incomeCategories:expenseCategories;
 const change=(key,value)=>setForm(f=>({...f,[key]:value}));
 return <form className="entry" onSubmit={onSubmit}>
 {!receipt&&<div className="segmented" data-selected={form.type} role="group" aria-label="Transaction type">{['Expense','Income'].map(type=><button type="button" key={type} aria-pressed={form.type===type} disabled={busy} onClick={()=>setForm(f=>({...f,type,category:type==='Income'?'Salary':'Other'}))}>{type}</button>)}</div>}
 <fieldset disabled={busy} className="formfields">
 <label>{income?'Income source / description':'Merchant / description'}<input required maxLength={300} value={form.merchant} onChange={e=>change('merchant',e.target.value)}/></label>
 <div className="two"><label>{income?'Amount received (PHP)':'Amount (PHP)'}<input required inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" title="Positive amount, at most two decimal places" value={form.amount} onChange={e=>change('amount',e.target.value)}/></label><label>{income?'Date received':'Transaction date'}<input required type="date" value={form.date} onChange={e=>change('date',e.target.value)}/></label></div>
 <label>{income?'Income category':'Expense category'}<select value={form.category} onChange={e=>change('category',e.target.value)}>{!categories.includes(form.category)&&<option>{form.category}</option>}{categories.map(c=><option key={c}>{c}</option>)}</select></label>
 {!income&&<button type="button" onClick={()=>change('category',suggestExpenseCategory(form.merchant))}>Suggest expense category (keyword rules, not AI)</button>}
 <label>Payment method (optional)<input maxLength={100} placeholder="Cash, bank transfer, e-wallet…" value={form.payment} onChange={e=>change('payment',e.target.value)}/></label>
 <label>Notes (optional)<textarea maxLength={5000} rows="3" value={form.note} onChange={e=>change('note',e.target.value)}/></label>
 {income&&<p className="muted">Record money actually received. Transfers between your own accounts are not income. For salary, enter net pay received. Income document processing is not available; unpaid invoices are not received income.</p>}
 {receipt&&<label className="verification"><input required type="checkbox"/> I reviewed the merchant, date, category and total against this receipt.</label>}
 <button className="primary" type="submit">{busy?'Saving…':editing?'Save changes':receipt?'Confirm & save expense':`Save ${income?'Income':'Expense'}`}</button>
 </fieldset><button type="button" onClick={onCancel} disabled={busy}>Cancel</button></form>;
}
