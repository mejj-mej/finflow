// Calendar-only warranty rules. UTC is used only to count whole calendar days.
const leap = year => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
const monthDays = (year,month) => [31,leap(year)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
export function dateParts(value) {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw new Error('Enter a valid calendar date.');
 const [year,month,day]=value.split('-').map(Number);
 if(year<1||year>9999||month<1||month>12||day<1||day>monthDays(year,month))throw new Error('Enter a valid calendar date.');
 return {year,month,day};
}
export function calculateExpiration(start,duration,unit) {
 const {year,month,day}=dateParts(start);
 if(!['months','years'].includes(unit)||!/^\d+$/.test(String(duration)))throw new Error('Enter a whole number of months or years.');
 const count=Number(duration),max=unit==='years'?100:1200;
 if(count<1||count>max)throw new Error(`Duration must be between 1 and ${max} ${unit}.`);
 const target=year*12+month-1+count*(unit==='years'?12:1);
 const y=Math.floor(target/12),m=target%12+1;
 if(y>9999)throw new Error('Expiration must be within year 9999.');
 return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(Math.min(day,monthDays(y,m))).padStart(2,'0')}`;
}
export function effectiveExpiration(form) {
 const computed=calculateExpiration(form.warranty_start_date,form.warranty_duration,form.warranty_duration_unit);
 if(form.manualExpiration&&!form.expiration_date_override)throw new Error('Enter the exact expiration date.');
 if(!form.expiration_date_override)return computed;
 dateParts(form.expiration_date_override);
 if(form.expiration_date_override<form.warranty_start_date)throw new Error('Expiration cannot be before the warranty start date.');
 return form.expiration_date_override;
}
function dayNumber(value){const {year,month,day}=dateParts(value);const d=new Date(0);d.setUTCFullYear(year,month-1,day);d.setUTCHours(0,0,0,0);return d.valueOf()/86400000;}
export function warrantyStatus(expiration,today) {
 const days=dayNumber(expiration)-dayNumber(today);
 return {days,status:days<0?'Expired':days<=30?'Expiring soon':'Active'};
}
export const warrantyDraft = (start='') => ({product_name:'',brand_model:'',warranty_start_date:start,warranty_duration:'12',warranty_duration_unit:'months',expiration_date_override:'',notes:'',startEdited:false});
export function warrantyPayload(form,receiptId) {
 if(!receiptId)throw new Error('Select a receipt for this warranty.');
 const name=String(form.product_name||'').trim(),brand=String(form.brand_model||'').trim(),notes=String(form.notes||'').trim();
 if(!name||name.length>300)throw new Error('Product name must contain 1–300 characters.');
 if(brand.length>200)throw new Error('Brand/model must be 200 characters or fewer.');
 if(notes.length>5000)throw new Error('Notes must be 5,000 characters or fewer.');
 effectiveExpiration(form);
 return {receipt_id:receiptId,product_name:name,brand_model:brand||null,warranty_start_date:form.warranty_start_date,warranty_duration:Number(form.warranty_duration),warranty_duration_unit:form.warranty_duration_unit,expiration_date_override:form.expiration_date_override||null,notes:notes||null};
}
export function receiptDeleteWarning(count){return count
 ? `Delete this receipt image and its record? Its ${count} linked ${count===1?'warranty will':'warranties will'} also be permanently deleted. The transaction will remain.`
 : 'Delete this receipt image and its record? Any linked warranties will also be permanently deleted. The transaction will remain.';}
export function filterWarranties(rows,receipts,{search='',status='All',receiptId='',today}) {
 const lookup=new Map(receipts.map(r=>[r.id,r]));const term=search.trim().toLowerCase();
 return rows.filter(w=>lookup.has(w.receipt_id)&&(!receiptId||w.receipt_id===receiptId)&&(status==='All'||warrantyStatus(w.expiration_date,today).status===status)&&`${w.product_name} ${w.brand_model||''} ${lookup.get(w.receipt_id)?.merchant||''}`.toLowerCase().includes(term)).sort((a,b)=>a.expiration_date.localeCompare(b.expiration_date)||a.product_name.localeCompare(b.product_name));
}
