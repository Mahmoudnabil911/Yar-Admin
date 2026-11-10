export function normalizePhone(value:unknown,country?:string):string;
export function iraqiPhone(value:unknown):string;
export function formatPhone(value:unknown):string;
export function reviewPhones<T extends {phone?:string;phoneE164?:string|null}>(users:T[]):(T & {phoneE164:string|null;phoneReviewRequired:boolean})[];