// Developer-only Node utility; never import into application routes or frontend bundles.
import {webcrypto} from 'node:crypto';
import {iraqiPhone} from '../src/yar/accounts/phone.js';
const SUPPORT_PHONE='+9647831400500';
async function credential(password){
 if(typeof password!=='string'||password.length<10||!/[A-Za-z]/.test(password)||!/[0-9]/.test(password))throw new Error('Each password needs 10+ characters with a letter and number.');
 const salt=webcrypto.getRandomValues(new Uint8Array(16));
 const key=await webcrypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const hash=await webcrypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:210000,hash:'SHA-256'},key,256);
 return {salt:Buffer.from(salt).toString('base64'),hash:Buffer.from(hash).toString('base64')};
}
export async function provisionInitialAccounts(input,existing=null){
 const definitions=[{role:'admin',name:input.adminName,phone:input.adminPhone,password:input.adminPassword,id:input.adminId},{role:'booking_employee',name:input.employeeName,phone:input.employeePhone,password:input.employeePassword,id:input.employeeId}];
 const phones=definitions.map(d=>iraqiPhone(d.phone));
 if(phones[0]===phones[1])throw new Error('The two mobile numbers must be unique.');
 if(!input.allowSupportPhone&&phones.includes(SUPPORT_PHONE))throw new Error('The public support number requires explicit owner authorization for account use.');
 if(definitions.some(d=>typeof d.name!=='string'||d.name.trim().length<2))throw new Error('Both full names are required.');
 if(existing&&(!Array.isArray(existing.users)||!Array.isArray(existing.requests)||!Array.isArray(existing.notifications)||!Array.isArray(existing.audit)))throw new Error('Invalid existing account repository.');
 const data=existing?structuredClone(existing):{version:2,users:[],requests:[],notifications:[],audit:[],throttle:{}};
 const targets=definitions.map((d,i)=>{
  const byId=d.id?data.users.find(u=>u.id===d.id):null;
  if(d.id&&!byId)throw new Error('Historical account ID not found; do not invent a replacement ID.');
  const matches=data.users.filter(u=>{try{return iraqiPhone(u.phoneE164||u.phone)===phones[i];}catch{return false;}});
  if(matches.length>1||(byId&&matches.some(u=>u.id!==byId.id)))throw new Error('Existing phone conflict requires administrator review.');
  const old=byId||matches[0];
  if(old&&old.role!==d.role)throw new Error('Existing role differs; review it inside Staff & Permissions.');
  if(old&&!input.confirmExistingUpdate)throw new Error('Updating existing credentials requires explicit confirmation.');
  return old;
 });
 const targetIds=targets.filter(Boolean).map(u=>u.id);
 if(targetIds.length!==new Set(targetIds).size)throw new Error('Both accounts must have different IDs.');
 // Extra users must be retained, not removed just to force an exact two-account count.
 if(data.users.some(u=>!targetIds.includes(u.id)))throw new Error('Repository contains other accounts; preserve them and review inside the dashboard instead of replacing the repository.');
 const stamp=new Date().toISOString();
 const users=[];
 for(let i=0;i<definitions.length;i++){
  const d=definitions[i],old=targets[i];
  users.push({...old,id:old?.id||webcrypto.randomUUID(),name:d.name.trim(),phoneE164:phones[i],phone:phones[i],role:d.role,status:'active',phoneReviewRequired:false,email:old?.email||'',mustChangePassword:true,sessionVersion:(old?.sessionVersion||0)+(old?1:0),createdAt:old?.createdAt||stamp,createdBy:old?.createdBy||'Private owner provisioning',credential:await credential(d.password)});
 }
 data.users=users;
 if(existing)for(const u of users)data.audit.push({id:webcrypto.randomUUID(),actorId:null,action:'account.private_provisioned',userId:u.id,at:stamp});
 return data;
}
export function installationScript(data){
 const expected=JSON.stringify(data);
 return `// PRIVATE: contains password verification material. Do not publish, email or commit.\n(()=>{const key='YAR_ADMIN_ACCOUNTS_V2';const incoming=${expected};const raw=localStorage.getItem(key);if(raw){const existing=JSON.parse(raw);if(JSON.stringify(existing)===JSON.stringify(incoming)){console.info('Accounts already installed.');return;}throw new Error('An account repository already exists. Export it for private review; never overwrite it.');}localStorage.setItem(key,JSON.stringify(incoming));console.info('Two accounts installed in this browser only. Sign in with your privately configured phone numbers; change each initial password.');})();\n`;
}