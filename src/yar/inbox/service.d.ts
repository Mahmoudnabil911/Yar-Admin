export interface Inquiry {id:string;reference:string;fullName:string;phoneE164:string;email?:string;subject:string;message:string;category:string;bookingReference?:string;status:string;assignedTo?:string;readBy?:string[];restricted?:boolean;createdAt:string;updatedAt:string;notes:{id:string;author:string;at:string;content:string}[];activity:{id:string;actor:string;at:string;action:string}[]}
export const INQUIRY_STATUSES:string[];
export const INQUIRY_CATEGORIES:string[];
export class InboxUnavailable extends Error {}
export const inboxService:{connected:boolean;list():Promise<Inquiry[]>;submit(input:Record<string,string>):Promise<{reference:string}>;update(...args:unknown[]):Promise<void>;addNote(...args:unknown[]):Promise<void>;markRead(...args:unknown[]):Promise<void>;assign(...args:unknown[]):Promise<void>;recordFollowUp(...args:unknown[]):Promise<void>;summary():Promise<Record<string,number>>};
export function visibleInquiries(rows:Inquiry[],role:string):Inquiry[];
export function filterInquiries(rows:Inquiry[],filters?:Record<string,unknown>):Inquiry[];
export function eligibleAssignee(users:{id:string;status:string;role:string}[],id:string):boolean;