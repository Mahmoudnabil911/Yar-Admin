// Browser-local adapter only. Replace with authenticated server enforcement before production.
import { iraqiPhone, reviewPhones } from './phone';
import {PREVIEW_ACCOUNTS,PREVIEW_CREDENTIAL} from './previewAccounts';
export const ACCOUNT_KEY = 'YAR_ADMIN_ACCOUNTS_V2';
const SESSION_KEY = 'YAR_ADMIN_SESSION_V1';
const listeners = new Set();
const blank = () => ({ version: 2, users: [], requests: [], notifications: [], audit: [], throttle: {} });
const read = () => { const raw = localStorage.getItem(ACCOUNT_KEY); const d=raw ? JSON.parse(raw) : blank(); return {...d,users:reviewPhones(d.users)}; };
export function assignmentUsers() { return read().users.map(u => ({ id:u.id,name:u.name,role:u.role==='booking_employee'?'bookings':u.role,status:u.status,permissions:u.role==='admin'?['bookings','staff']:['bookings'] })); }
export function legacyUsers() { try { const raw=localStorage.getItem('YAR_ADMIN_STAFF_V1'); const rows=raw?JSON.parse(raw).staff:[];return rows.filter(u=>!read().users.some(a=>a.id===u.id)).map(u=>({...u,status:'inactive',role:['owner','admin'].includes(u.role)?'admin':['bookings','booking_employee'].includes(u.role)?'booking_employee':u.role,username:'',email:'',mustChangePassword:true,sessionVersion:0})); } catch { return []; } }

const emit = () => listeners.forEach(f => f());
export const subscribeAccounts = f => { listeners.add(f); return () => listeners.delete(f); };
if (typeof window !== 'undefined') window.addEventListener('storage', e => { if ([ACCOUNT_KEY, SESSION_KEY].includes(e.key)) emit(); });
function save(data) { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(data)); emit(); }
const id = () => crypto.randomUUID();
const norm = s => String(s || '').trim().toLowerCase();
const now = () => new Date().toISOString();
export function passwordPolicy(password) { if (password.length < 10 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) throw new Error('Use at least 10 characters, including a letter and a number.'); }
export async function hashPassword(password, salt = crypto.getRandomValues(new Uint8Array(16))) {
 const bytes = typeof salt === 'string' ? Uint8Array.from(atob(salt), c => c.charCodeAt(0)) : salt;
 const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
 const hash = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: bytes, iterations: 210000, hash: 'SHA-256' }, key, 256);
 return { salt: btoa(String.fromCharCode(...bytes)), hash: btoa(String.fromCharCode(...new Uint8Array(hash))) };
}
async function verify(user, password) { return Boolean(user?.credential && (await hashPassword(password, user.credential.salt)).hash === user.credential.hash); }
const safe = u => { const { credential, ...rest } = u; return rest; };
export function currentAccount() {
 const raw = localStorage.getItem(SESSION_KEY); if (!raw) return null;
 try { const s = JSON.parse(raw), u = read().users.find(u => u.id === s.staffId); if (!u || u.status !== 'active' || !['admin','booking_employee'].includes(u.role) || u.sessionVersion !== s.version || Date.now() > s.expiresAt) return null; return { ...safe(u), staffId: u.id }; } catch { return null; }
}
function requireUser(admin = false) { const u = currentAccount(); if (!u || u.mustChangePassword || (admin && u.role !== 'admin')) throw new Error('Access denied.'); return u; }
function audit(d, actor, action, userId) { d.audit.push({ id: id(), actorId: actor?.id, action, userId, at: now() }); }
function notify(d, recipients, type, title, message, target) { const stamp = now(); for (const u of recipients) d.notifications.push({ id: id(), recipientId: u.id, type, title, message, target, createdAt: stamp, readAt: null }); }
const admins = d => d.users.filter(u => u.status === 'active' && u.role === 'admin');
export function listUsers() { requireUser(true); return read().users.map(safe).concat(legacyUsers()); }
export function listRequests() { requireUser(true); return read().requests; }
export function listAudit(userId) { const u = requireUser(); if (u.role !== 'admin' && u.id !== userId) throw new Error('Access denied.'); return read().audit.filter(a => !userId || a.userId === userId); }
export async function login(identifier, password) {
 const alias=norm(identifier);const d=read();let u;
 const preview=PREVIEW_ACCOUNTS.find(a=>a.username===alias);
 if(preview){
  u=d.users.find(a=>a.username===alias);
  if(!u){
   if(!await verify({credential:PREVIEW_CREDENTIAL},password))throw new Error('Incorrect mobile number or password.');
   for(const initial of PREVIEW_ACCOUNTS){if(d.users.some(a=>a.username===initial.username||a.id===initial.id))continue;d.users.push({...initial,localPreview:true,status:'active',mustChangePassword:false,sessionVersion:0,createdAt:now(),credential:{...PREVIEW_CREDENTIAL}});}
   u=d.users.find(a=>a.username===alias);
  }
 }else{const phone=iraqiPhone(identifier);u=d.users.find(u=>!u.phoneReviewRequired&&u.phoneE164===phone);}
 if (!u || !await verify(u, password)) throw new Error('Incorrect mobile number or password.');
 if (u.status !== 'active' || !['admin','booking_employee'].includes(u.role)) throw new Error('This account is inactive. Contact your administrator.');
 u.lastLogin = now();
 localStorage.setItem(SESSION_KEY, JSON.stringify({ staffId: u.id, version: u.sessionVersion, expiresAt: Date.now() + 12 * 3600000 })); save(d); return currentAccount();
}
export function logout() { localStorage.removeItem(SESSION_KEY); emit(); }
function validateUser(d, input) {
 if (String(input.name || '').trim().length < 2 || (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email))) throw new Error('Enter a full name and a valid optional email.');
 input.phoneE164=iraqiPhone(input.phoneE164 || input.phone);
 if (!['admin','booking_employee'].includes(input.role) || !['active','inactive'].includes(input.status)) throw new Error('Choose a supported role and status.');
 if (d.users.some(u => u.id !== input.id && u.phoneE164 === input.phoneE164)) throw new Error('Mobile number is already in use.');
 const next = d.users.filter(u => u.id !== input.id).concat(input);
 if (!next.some(u => u.status === 'active' && u.role === 'admin')) throw new Error('Cannot deactivate or demote the last active administrator.');
}
export async function saveUser(input, password, confirmation) {
 const a = requireUser(true), d = read(); input={...input}; validateUser(d, input);
 const old = d.users.find(u => u.id === input.id);
 if (!old && (!password || password !== confirmation)) throw new Error('Passwords must match.');
 if (password) { passwordPolicy(password); if (password !== confirmation) throw new Error('Passwords must match.'); }
 const credential = password ? await hashPassword(password) : old?.credential;
 const u = { ...old, id: input.id || id(), name: input.name.trim(), username: old?.username || '', email: norm(input.email), phone: input.phoneE164, phoneE164:input.phoneE164,phoneReviewRequired:false, role: input.role, status: input.status, mustChangePassword: Boolean(input.mustChangePassword), credential, createdAt: old?.createdAt || now(), createdBy: old?.createdBy || a.name, lastLogin: old?.lastLogin, sessionVersion: (old?.sessionVersion || 0) + (old && (password || old.status !== input.status || old.role !== input.role || old.phoneE164 !== input.phoneE164) ? 1 : 0) };
 // A reviewing administrator keeps their own authorized session after a phone correction.
 if(old?.id===a.id){const s=JSON.parse(localStorage.getItem(SESSION_KEY));s.version=u.sessionVersion;localStorage.setItem(SESSION_KEY,JSON.stringify(s));}
 d.users = d.users.filter(v => v.id !== u.id).concat(u); audit(d,a,old ? 'user.updated' : 'user.created',u.id);
 notify(d,admins(d),'users', old ? ['تم تحديث حساب المستخدم','User account updated'] : ['تم إنشاء حساب المستخدم','User account created'], [u.name,u.name], { page: 'staff', userId: u.id }); save(d); return safe(u);
}
export async function changePassword(current, password, confirm) {
 const u = currentAccount(); if (!u) throw new Error('Sign in first.'); const d = read(), stored = d.users.find(v => v.id === u.id);
 if (!await verify(stored,current)) throw new Error('Current password is incorrect.');
 passwordPolicy(password); if (password !== confirm) throw new Error('Passwords must match.'); if (password === current) throw new Error('Choose a different new password.');
 stored.credential = await hashPassword(password); stored.mustChangePassword = false; stored.sessionVersion++;
 const s = JSON.parse(localStorage.getItem(SESSION_KEY)); s.version = stored.sessionVersion; localStorage.setItem(SESSION_KEY,JSON.stringify(s)); audit(d,u,'password.changed',u.id); notify(d,[stored],'security',['تم تغيير كلمة المرور','Password changed'],['تم تحديث كلمة مرور حسابك','Your account password was updated'],null); save(d);
}
export function requestReset(identifier) {
 const d = read(), key = iraqiPhone(identifier), last = d.throttle[key] || 0; if (Date.now()-last < 60000) return;
 d.throttle[key] = Date.now(); const u = d.users.find(u => !u.phoneReviewRequired && u.phoneE164 === key);
 if (u?.status === 'active' && ['admin','booking_employee'].includes(u.role) && !d.requests.some(r => r.userId === u.id && r.status === 'pending')) {
 const r = { id:id(),userId:u.id,name:u.name,phoneE164:u.phoneE164,status:'pending',requestedAt:now() }; d.requests.push(r);
 notify(d,admins(d),'requests',['طلب إعادة تعيين كلمة المرور','Password reset request'],[u.name,u.name],{page:'staff',requestId:r.id}); }
 save(d);
}
export async function resolveReset(requestId, password, confirm, reject = false) {
 const a=requireUser(true),d=read(),r=d.requests.find(r=>r.id===requestId); if(!r || r.status!=='pending') throw new Error('Request is no longer pending.'); if (!reject && r.userId===a.id) throw new Error('Use Change Password for your own account.');
 if(!reject){ passwordPolicy(password); if(password!==confirm)throw new Error('Passwords must match.'); const u=d.users.find(u=>u.id===r.userId); if(!u)throw new Error('Account not found.'); u.credential=await hashPassword(password);u.mustChangePassword=true;u.sessionVersion++; }
 r.status=reject?'rejected':'resolved';r.reviewedBy=a.name;r.resolvedAt=now();for(const n of d.notifications)if(n.target?.requestId===r.id)n.requestStatus=r.status;notify(d,admins(d),'security',reject?['تم رفض طلب كلمة المرور','Password request rejected']:['تمت إعادة تعيين كلمة المرور','Password reset completed'],[r.name,r.name],{page:'staff',requestId:r.id});audit(d,a,reject?'reset.rejected':'reset.resolved',r.userId);save(d);
}
export async function resetUser(userId,password,confirm) {
 const a=requireUser(true),d=read(),u=d.users.find(u=>u.id===userId);if(!u || u.id===a.id)throw new Error('Use Change Password for your own account.');passwordPolicy(password);if(password!==confirm)throw new Error('Passwords must match.');u.credential=await hashPassword(password);u.mustChangePassword=true;u.sessionVersion++;for(const r of d.requests.filter(r=>r.userId===u.id && r.status==='pending')){r.status='resolved';r.reviewedBy=a.name;r.resolvedAt=now();}audit(d,a,'password.reset',userId);save(d);
}
export function notifications() { const u=requireUser();return read().notifications.filter(n=>n.recipientId===u.id && (u.role==='admin' || !['users','requests'].includes(n.type))).slice().reverse(); }
export function markRead(ids) { const u=requireUser(),d=read();for(const n of d.notifications)if(n.recipientId===u.id && ids.includes(n.id))n.readAt ||= now();save(d); }
/** Daily exchange-rate reminder for administrators: one per admin per Baghdad day; marked read once the rate is set. */
export function ensureRateReminder(date,missing) {
 const a=currentAccount();if(!a || a.mustChangePassword)return;const d=read();let changed=false;
 if(missing){for(const u of admins(d)){if(d.notifications.some(n=>n.recipientId===u.id && n.type==='fx' && n.target?.fxDate===date))continue;notify(d,[u],'fx',['حدّث سعر صرف الدولار لليوم','Update today’s USD rate'],[`لم يُسجَّل سعر التحويل ليوم ${date}. سجّل سعر اليوم قبل إنشاء حجوزات جديدة.`,`No exchange rate recorded for ${date}. Set today’s rate before creating new bookings.`],{fx:true,fxDate:date});changed=true;}}
 else for(const n of d.notifications)if(n.type==='fx' && n.target?.fxDate===date && !n.readAt){n.readAt=now();changed=true;}
 if(changed)save(d);
}
export function publishOperation(before,after) {
 const a=currentAccount();if(!a || a.mustChangePassword)return;const d=read();for(const b of after){const old=before.find(v=>v.id===b.id);if(old && JSON.stringify(old)===JSON.stringify(b))continue;
 const type=b.status==='issued'?'tickets':b.status==='cancelled'?'cancellation':old && JSON.stringify(old.receipts)!==JSON.stringify(b.receipts)?'payments':'bookings';
 const targets=d.users.filter(u=>u.status==='active' && (u.role==='admin' || u.role==='booking_employee'));
 notify(d,targets,type,['تحديث الحجز','Booking update'],[`${b.id} · ${b.status}`,`${b.id} · ${b.status}`],{page:'bookings',bookingId:b.id});}save(d);
}
