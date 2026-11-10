import type {Inquiry} from './service';
export const mockInboxService:{
 connected:false;mock:true;
 list():Promise<Inquiry[]>;
 submit(input?:Record<string,string>):Promise<never>;
 update(id:string,patch:{status:string}):Promise<void>;
 markRead(id:string,readState:boolean):Promise<void>;
 addNote(id:string,content:string):Promise<void>;
 assign(id:string,assignee:string|null):Promise<void>;
 recordFollowUp(id:string):Promise<void>;
 summary():Promise<Record<string,number>>;
};