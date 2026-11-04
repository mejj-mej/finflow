let sequence=0;
// Invalidated synchronously in the auth callback, before React renders a new account.
export function createAccountScope(userId){
 let valid=true;
 return {id:++sequence,userId,current:()=>valid,invalidate(){valid=false;},assert(){if(!valid)throw new Error('Account changed. Reopen this action in the current account.');}};
}
