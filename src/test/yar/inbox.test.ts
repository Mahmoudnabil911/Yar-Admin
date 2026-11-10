import {describe,it,expect} from 'vitest';
import {inboxService,filterInquiries,visibleInquiries,eligibleAssignee,type Inquiry} from '@/yar/inbox/service';
import {iraqiPhone} from '@/yar/accounts/phone';
const row:Inquiry={id:'1',reference:'YAR-INQ-000001',fullName:'Ahmed',phoneE164:'+9647831400500',subject:'Flight question',message:'Booking assistance',category:'flights',status:'new',readBy:['employee'],createdAt:'2026-11-10T09:00:00Z',updatedAt:'2026-11-10T09:00:00Z',notes:[],activity:[]};
describe('inquiry service boundaries',()=>{
 it('never confirms a save while shared storage is unavailable',async()=>{expect(inboxService.connected).toBe(false);await expect(inboxService.submit({fullName:'Ahmed'})).rejects.toThrow('not connected');});
 it('employees see all ordinary inquiries including assignments to others',()=>{expect(visibleInquiries([{...row,assignedTo:'other'},{...row,id:'2',restricted:true}],'booking_employee').map(r=>r.id)).toEqual(['1']);});
 it('only administrators see restricted cases',()=>{expect(visibleInquiries([{...row,restricted:true}],'admin')).toHaveLength(1);expect(visibleInquiries([row],'unknown')).toHaveLength(0);});
 it('read status does not resolve new inquiries',()=>{expect(filterInquiries([row],{read:'read',status:'new',userId:'employee'})[0]?.status).toBe('new');});
 it('resolved and closed inquiry history is retained',()=>{expect(filterInquiries([{...row,status:'resolved'},{...row,id:'2',status:'closed'}])).toHaveLength(2);});
 it('searches formatted phone numbers and references',()=>{expect(filterInquiries([row],{query:'+964 783 140 0500'})).toHaveLength(1);expect(filterInquiries([row],{query:'YAR-INQ-000001'})).toHaveLength(1);});
 it('filters by status and category',()=>{expect(filterInquiries([row],{status:'resolved'})).toHaveLength(0);expect(filterInquiries([row],{category:'hotels'})).toHaveLength(0);});
 it('excludes inactive assignees',()=>{expect(eligibleAssignee([{id:'e',role:'booking_employee',status:'inactive'}],'e')).toBe(false);expect(eligibleAssignee([{id:'e',role:'booking_employee',status:'active'}],'e')).toBe(true);});
 it('accepts contact formatting and Arabic digits for Iraqi mobiles',()=>{expect(iraqiPhone('٠٧٨٣ ١٤٠ ٠٥٠٠')).toBe('+9647831400500');expect(iraqiPhone('(+964) 783-140-0500')).toBe('+9647831400500');});
 it('rejects structurally invalid Iraqi numbers',()=>{expect(()=>iraqiPhone('0783140050')).toThrow();expect(()=>iraqiPhone('+9641231400500')).toThrow();});
});