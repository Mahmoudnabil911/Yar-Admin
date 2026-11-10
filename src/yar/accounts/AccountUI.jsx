import React,{useState,useEffect} from 'react';
import {Button} from '@/components/ui/button';
import {usePrefs} from '../i18n/prefs';
import * as R from './repository';
export function useAccounts(){const[,set]=useState(0);useEffect(()=>R.subscribeAccounts(()=>set(v=>v+1)),[]);}
export function useWords(){const{lang}=usePrefs();return(ar,en)=>lang==='ar'?ar:en;}
export function Field({label,...props}){return <label className="account-field"><span>{label}</span><input {...props}/></label>;}
export function PasswordFields({current,setCurrent,password,setPassword,confirm,setConfirm}){const t=useWords();return <>{setCurrent&&<Field label={t('كلمة المرور الحالية','Current Password')} type="password" autoComplete="current-password" value={current} onChange={e=>setCurrent(e.target.value)} required/>}<Field label={t('كلمة المرور الجديدة','New Password')} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} required/><Field label={t('تأكيد كلمة المرور','Confirm Password')} type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} required/><small>{t('10 أحرف على الأقل، تتضمن حرفًا ورقمًا.','At least 10 characters, including a letter and a number.')}</small></>;}
const errors={
 'Incorrect mobile number or password.':['رقم الهاتف أو كلمة المرور غير صحيحة.'],
 'Enter a valid Iraqi mobile number.':['أدخل رقم هاتف عراقي صحيحًا يبدأ بـ 07 أو +964.'],
 'Enter a valid mobile number.':['أدخل رقم هاتف صحيحًا.'],
 'Mobile number is already in use.':['رقم الهاتف مستخدم لحساب آخر.'],
 'Enter a full name and a valid optional email.':['أدخل الاسم الكامل وبريدًا صحيحًا إن أضفته.'],
 'Incorrect username or password.':['اسم المستخدم أو كلمة المرور غير صحيحة.'],
 'Current password is incorrect.':['كلمة المرور الحالية غير صحيحة.'],
 'Passwords must match.':['كلمتا المرور غير متطابقتين.'],
 'Choose a different new password.':['اختر كلمة مرور جديدة مختلفة.'],
 'Use at least 10 characters, including a letter and a number.':['استخدم 10 أحرف على الأقل تتضمن حرفًا ورقمًا.'],
 'Username or email is already in use.':['اسم المستخدم أو البريد مستخدم بالفعل.'],
 'Enter a full name, a valid username and email.':['أدخل الاسم واسم المستخدم والبريد الإلكتروني بشكل صحيح.'],
 'Cannot deactivate or demote the last active administrator.':['لا يمكن إيقاف أو تغيير دور آخر مدير نظام نشط.'],
 'This account is inactive. Contact your administrator.':['الحساب موقوف. تواصل مع مدير النظام.'],
 'Access denied.':['غير مسموح بهذا الإجراء.'],
};
export function errorText(error,lang){return lang==='ar'?(errors[error.message]?.[0]||'تعذر تنفيذ الإجراء. يرجى مراجعة البيانات والمحاولة مجددًا.'):error.message;}
export function Profile({mandatory=false}){
 const t=useWords(),{lang}=usePrefs();useAccounts();const u=R.currentAccount();const[current,setCurrent]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
 if(!u)return null;
 async function submit(e){e.preventDefault();setBusy(true);setMsg('');try{await R.changePassword(current,password,confirm);setCurrent('');setPassword('');setConfirm('');setMsg(t('تم تغيير كلمة المرور.','Password changed.'));}catch(e){setMsg(errorText(e,lang));}finally{setBusy(false);}}
 return <section className="account-page" data-no-translate><div className="eyebrow">YAR / {t('الحساب والأمان','Account & Security')}</div><h1>{mandatory?t('تغيير كلمة المرور مطلوب','Password Change Required'):t('ملفي الشخصي','My Profile')}</h1><p>{u.name} · <bdi>{u.phoneE164 || t('الهاتف يحتاج مراجعة المدير','Phone requires administrator review')}</bdi> {u.email}</p>{mandatory&&<p>{t('غيّر كلمة المرور الحالية قبل الوصول إلى لوحة التحكم.','Change your current password before accessing the dashboard.')}</p>}<form className="account-form" onSubmit={submit}><PasswordFields {...{current,setCurrent,password,setPassword,confirm,setConfirm}}/>{msg&&<p role="status">{msg}</p>}<Button disabled={busy} type="submit">{t('تغيير كلمة المرور','Change Password')}</Button></form></section>;
}
