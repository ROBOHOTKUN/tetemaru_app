function openFamilyDB(){return new Promise((resolve,reject)=>{
  const r=indexedDB.open('tetemaru-family-v1',1);
  r.onupgradeneeded=()=>r.result.createObjectStore('family');
  r.onsuccess=()=>{
    const db=r.result;
    db.onclose=()=>{pendingDB=undefined};
    db.onversionchange=()=>{db.close();pendingDB=undefined};
    resolve(db);
  };
  r.onerror=()=>reject(r.error);
})}
let pendingDB;
export const initial=()=>({paired:false,name:'',grade:1,nick:'',pin:'',active:null,history:[]});
export async function family(change){
  pendingDB??=openFamilyDB().catch(error=>{pendingDB=undefined;throw error});
  const db=await pendingDB;
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('family',change?'readwrite':'readonly');
    const store=tx.objectStore('family'), read=store.get('home'); let value;
    read.onsuccess=()=>{
      value=read.result||initial();
      if(change && change(value)!==false)store.put(value,'home');
    };
    tx.oncomplete=()=>resolve(value);
    tx.onerror=()=>reject(tx.error); tx.onabort=()=>reject(tx.error||Error('save'));
  });
}
export function dateAt(d=new Date()){return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
export function newId(){
  if(crypto.randomUUID)return crypto.randomUUID();
  const bytes=crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
}
export async function pinHash(pin,salt){
  if(!crypto.subtle){
    const {derivePin}=await import('./pin-kdf.js');
    const result=await derivePin(pin,salt,120000);
    return Array.from(result,x=>x.toString(16).padStart(2,'0')).join('');
  }
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:120000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits),x=>x.toString(16).padStart(2,'0')).join('');
}
export async function verifyParentPin(code,storedPin){
  const [salt,expected]=(storedPin||'').split('.');
  if(!salt||!expected||!/^\d{4}$/.test(code))return false;
  return await pinHash(code,salt)===expected;
}
