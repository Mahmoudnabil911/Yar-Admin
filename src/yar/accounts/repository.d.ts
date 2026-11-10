export interface Account { id:string;staffId?:string;name:string;username?:string;email?:string;phone?:string;phoneE164?:string|null;phoneReviewRequired?:boolean;role:string;status:string;mustChangePassword?:boolean;sessionVersion:number;credential?:{salt:string;hash:string};createdAt?:string;createdBy?:string;lastLogin?:string }
export interface ResetRequest {id:string;userId:string;status:string;name:string;phoneE164?:string;username?:string;requestedAt:string;reviewedBy?:string;resolvedAt?:string}
export interface Notification {id:string;recipientId:string;type:string;title:string[];message:string[];readAt:string|null;createdAt:string;target:Record<string,string>|null}
export const ACCOUNT_KEY:string;
export function hashPassword(password:string,salt?:string|Uint8Array):Promise<{salt:string;hash:string}>;
export function login(identifier:string,password:string):Promise<Account|null>;
export function logout():void;
export function currentAccount():Account|null;
export function saveUser(input:Partial<Account>,password?:string,confirmation?:string):Promise<Account>;
export function listUsers():Account[];
export function listRequests():ResetRequest[];
export function listAudit(userId?:string):Record<string,string>[];
export function changePassword(current:string,password:string,confirm:string):Promise<void>;
export function requestReset(identifier:string):void;
export function resolveReset(id:string,password:string,confirm:string,reject?:boolean):Promise<void>;
export function resetUser(id:string,password:string,confirm:string):Promise<void>;
export function notifications():Notification[];
export function markRead(ids:string[]):void;
export function passwordPolicy(password:string):void;
export function subscribeAccounts(callback:()=>void):()=>void;
export function publishOperation(before:unknown[],after:unknown[]):void;
export function assignmentUsers():{id:string;name:string;role:string;status:string;permissions:string[]}[];
export function legacyUsers():Account[];
