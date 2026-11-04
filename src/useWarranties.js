import {useEffect,useRef,useState} from 'react';
import {supabase} from './supabase.js';
import {createWarrantyData} from './warranty-data.js';
const service=createWarrantyData(supabase);
export {service as warrantyData};
export default function useWarranties(userId,scope){
 const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const version=useRef(0);
 async function reload(){
  const request=++version.current;
  if(!scope.current())return;
  setLoading(true);setError('');
  try{const data=await service.list(userId);if(scope.current()&&request===version.current)setRows(data);}
  catch(e){if(scope.current()&&request===version.current)setError('Could not load warranties. Please retry.');}
  finally{if(scope.current()&&request===version.current)setLoading(false);}
 }
 useEffect(()=>{reload();return()=>{version.current++;};},[userId,scope]);
 return {rows,loading,error,reload};
}
