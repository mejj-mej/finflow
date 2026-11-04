export const expenseCategories = ['Groceries','Food & Dining','Transportation','Shopping','Bills & Utilities','Rent & Housing','Health','Entertainment','Education','Subscriptions','Personal Care','Other'];
export const incomeCategories = ['Salary','Freelance','Business Income','Allowance','Commission','Interest','Gifts','Other Income'];
export const today = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export const blank = () => ({date:today(),merchant:'',amount:'',category:'Other',type:'Expense',note:'',payment:''});
export function cents(value) {
 const s=String(value);
 if(!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error('Enter a positive PHP amount with at most two decimal places.');
 const [whole,fraction='']=s.split('.'); const result=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(result)||result<=0||result>999999999999) throw new Error('Amount must be between PHP 0.01 and PHP 9,999,999,999.99.');
 return result;
}
export function payload(form,{legacyCategory}={}) {
 cents(form.amount);
 if(!form.merchant.trim()) throw new Error('Enter a description or source.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(form.date)||!Number.isFinite(Date.parse(form.date))||new Date(form.date).toISOString().slice(0,10)!==form.date) throw new Error('Enter a valid transaction date.');
 const kind=form.type.toLowerCase(); if(!['income','expense'].includes(kind)) throw new Error('Choose income or expense.');
 // Preserve legacy categories when editing; new entries use the type-specific list.
 if(!(kind==='income'?incomeCategories:expenseCategories).includes(form.category)&&form.category!==legacyCategory) throw new Error('Choose a category for this transaction type.');
 return {transaction_date:form.date,description:form.merchant.trim(),merchant:form.merchant.trim(),amount:(cents(form.amount)/100).toFixed(2),kind,category:form.category,notes:form.note.trim()||null,payment_method:form.payment.trim()||null};
}
export function filterTransactions(items,{month,type='All',search='',category='All'}) {
 return items.filter(x=>x.transaction_date?.startsWith(month)&&(type==='All'||x.kind===type)&&(category==='All'||x.category===category)&&`${x.description||''} ${x.merchant||''}`.toLowerCase().includes(search.trim().toLowerCase()));
}
export function summarize(items) {
 const total=kind=>items.filter(x=>x.kind===kind).reduce((s,x)=>s+cents(x.amount),0);
 const income=total('income'),expense=total('expense');
 const groups=new Map(); items.filter(x=>x.kind==='expense').forEach(x=>groups.set(x.category,(groups.get(x.category)||0)+cents(x.amount)));
 return {income:income/100,expense:expense/100,totals:[...groups].map(([name,total])=>({name,total:total/100})).sort((a,b)=>b.total-a.total)};
}
export function suggestExpenseCategory(value){
 const text=value.toLowerCase();
 if(/grocery|supermarket|puregold|savemore|milk|bread|egg/.test(text))return 'Groceries';
 if(/coffee|cafe|jollibee|mcdonald|restaurant|food|burger/.test(text))return 'Food & Dining';
 if(/grab|fuel|gas|petron|shell|bus|transport/.test(text))return 'Transportation';
 if(/electric|water|internet|globe|pldt|bill/.test(text))return 'Bills & Utilities';
 if(/pharmacy|mercury|hospital|clinic/.test(text))return 'Health';
 if(/shopee|lazada|mall|store/.test(text))return 'Shopping';
 return 'Other';
}
