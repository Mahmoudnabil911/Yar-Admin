// Browser/SSR-safe normalization; number structure is not proof of ownership.
export function normalizePhone(value, country = '+964') {
 const digits = String(value || '').trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
 if (/[^\d\s+().-]/.test(digits) || /\+.*\+/.test(digits)) throw new Error('Enter a valid mobile number.');
 let phone = digits.replace(/[\s().-]/g, '');
 if (phone.startsWith('00')) phone = '+' + phone.slice(2);
 if (!phone.startsWith('+')) { if (country === '+964' && phone.startsWith('964')) phone = '+' + phone; else phone = country + phone.replace(/^0/, ''); }
 if (phone.startsWith('+964')) { if (!/^\+9647[3-9]\d{8}$/.test(phone)) throw new Error('Enter a valid Iraqi mobile number.'); }
 else if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter a valid mobile number.');
 return phone;
}
export function iraqiPhone(value) { const phone = normalizePhone(value); if (!phone.startsWith('+964')) throw new Error('Enter a valid Iraqi mobile number.'); return phone; }
export function formatPhone(value) { try { const p=normalizePhone(value);return p.startsWith('+964')?`${p.slice(0,4)} ${p.slice(4,7)} ${p.slice(7,10)} ${p.slice(10)}`:p; } catch { return value || '—'; } }
export function reviewPhones(users) {
 const normalized=users.map(u=>{try{return {...u,phoneE164:iraqiPhone(u.phoneE164 || u.phone),phoneReviewRequired:false};}catch{return {...u,phoneE164:null,phoneReviewRequired:true};}});
 return normalized.map(u=>normalized.filter(v=>u.phoneE164 && v.phoneE164===u.phoneE164).length>1?{...u,phoneReviewRequired:true}:u);
}