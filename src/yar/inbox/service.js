// Deliberately disconnected until protected shared storage and server identity exist.
// No localStorage, fake delivery, seeded customer messages, or fabricated references.
export const INQUIRY_STATUSES=['new','in_progress','waiting_for_customer','resolved','closed'];
export const INQUIRY_CATEGORIES=['general','bookings','flights','hotels','refund','technical','account','other'];
export class InboxUnavailable extends Error { constructor(){super('Shared customer inquiry delivery is not connected.');this.name='InboxUnavailable';} }
export const inboxService={connected:false,async list(){throw new InboxUnavailable();},async submit(){throw new InboxUnavailable();},async update(){throw new InboxUnavailable();},async addNote(){throw new InboxUnavailable();},async markRead(){throw new InboxUnavailable();},async assign(){throw new InboxUnavailable();},async recordFollowUp(){throw new InboxUnavailable();},async summary(){throw new InboxUnavailable();}};
export function visibleInquiries(rows,role){if(!['admin','booking_employee'].includes(role))return [];return rows.filter(r=>role==='admin'||!r.restricted);}
export function filterInquiries(rows,{query='',status='all',category='all',assignee='all',read='all',from='',until='',sort='newest',userId}={}) {
 const q=query.toLowerCase().replace(/\s/g,'');
 return rows.filter(r=>(status==='all'||r.status===status)&&(category==='all'||r.category===category)&&(assignee==='all'||(assignee==='unassigned'?!r.assignedTo:r.assignedTo===assignee))&&(read==='all'||Boolean(r.readBy?.includes(userId))===(read==='read'))&&(!from||r.createdAt.slice(0,10)>=from)&&(!until||r.createdAt.slice(0,10)<=until)&&[r.fullName,r.phoneE164,r.subject,r.message,r.reference,r.bookingReference].some(v=>String(v||'').toLowerCase().replace(/\s/g,'').includes(q))).sort((a,b)=>sort==='oldest'?a.createdAt.localeCompare(b.createdAt):sort==='updated'?b.updatedAt.localeCompare(a.updatedAt):b.createdAt.localeCompare(a.createdAt));
}
export function eligibleAssignee(users,id){return users.some(u=>u.id===id&&u.status==='active'&&['booking_employee','bookings'].includes(u.role));}