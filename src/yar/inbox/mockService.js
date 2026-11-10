import {assertCan} from '../auth/access';
import {currentAccount,assignmentUsers} from '../accounts/repository';
import {eligibleAssignee,visibleInquiries,INQUIRY_STATUSES,InboxUnavailable} from './service';

const KEY='YAR_ADMIN_MOCK_INBOX_V1';
const examples=[
 ['أحمد علي','Ahmed Ali','استفسار عن رحلة إلى إسطنبول','Flight to Istanbul','هل تتوفر رحلة مباشرة الأسبوع القادم لشخصين؟','Are direct flights available next week for two passengers?','flights','new'],
 ['سارة حسن','Sara Hassan','تأكيد موعد الحجز','Booking confirmation','أرغب في تأكيد وقت المغادرة وعدد الحقائب المسموح بها.','I would like to confirm the departure time and baggage allowance.','bookings','new'],
 ['عمر خالد','Omar Khalid','خيارات الفنادق','Hotel options','أحتاج غرفة مزدوجة قريبة من وسط المدينة لمدة خمس ليالٍ.','I need a double room near the city centre for five nights.','hotels','in_progress'],
 ['نور حسين','Noor Hussein','تعديل بيانات المسافر','Passenger details','هل يمكن تعديل بيانات الجواز قبل إصدار التذكرة؟','Can passport details be updated before the ticket is issued?','flights','waiting_for_customer'],
 ['علي كريم','Ali Kareem','متابعة طلب سابق','Previous inquiry','شكرًا لمساعدتكم، تم استلام تفاصيل الرحلة.','Thank you for your assistance. I have received the trip details.','general','resolved'],
 ['مريم يوسف','Maryam Yousif','مواعيد التواصل','Contact hours','أود التواصل مع فريق الحجوزات بخصوص رحلة عائلية.','I would like to contact the bookings team about a family trip.','general','closed'],
];
function initial(){return examples.map(([fullName,fullNameEn,subject,subjectEn,message,messageEn,category,status],i)=>({id:`mock-inquiry-${i+1}`,reference:`MOCK-${String(i+1).padStart(4,'0')}`,fullName,fullNameEn,subject,subjectEn,message,messageEn,category,status,email:`customer${i+1}@example.com`,phoneE164:'',readBy:[],assignedTo:null,createdAt:`2026-11-${String(10-i).padStart(2,'0')}T08:00:00Z`,updatedAt:`2026-11-${String(10-i).padStart(2,'0')}T08:00:00Z`,notes:[],activity:[]}));}
function read(){const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):initial();}
function allowed(permission,id){assertCan(permission);const rows=read(),user=currentAccount();const row=visibleInquiries(rows,user?.role).find(r=>r.id===id);if(!row)throw new Error('Inquiry unavailable');return {rows,row,user};}
function change(permission,id,fn){const {rows,row,user}=allowed(permission,id);fn(row,user);row.updatedAt=new Date().toISOString();row.activity.push({id:crypto.randomUUID(),actor:user.name,action:permission,at:row.updatedAt});localStorage.setItem(KEY,JSON.stringify(rows));}
export const mockInboxService={connected:false,mock:true,
 async list(){assertCan('inquiry.view');return visibleInquiries(read(),currentAccount()?.role);},
 async submit(){throw new InboxUnavailable();},
 async update(id,patch){if(!INQUIRY_STATUSES.includes(patch.status))throw new Error('Invalid status');change('inquiry.status',id,r=>{r.status=patch.status;});},
 async markRead(id,readState){change('inquiry.read',id,(r,u)=>{r.readBy=readState?[...new Set([...r.readBy,u.id])]:r.readBy.filter(id=>id!==u.id);});},
 async addNote(id,content){if(!content.trim()||content.length>4000)throw new Error('Invalid note');change('inquiry.note',id,(r,u)=>r.notes.push({id:crypto.randomUUID(),author:u.name,content:content.trim(),at:new Date().toISOString()}));},
 async assign(id,assignee){if(assignee&&!eligibleAssignee(assignmentUsers(),assignee))throw new Error('Invalid assignee');change('inquiry.assign',id,r=>{r.assignedTo=assignee;});},
 async recordFollowUp(id){change('inquiry.followup',id,()=>{});},
 async summary(){const rows=await this.list();return Object.fromEntries(INQUIRY_STATUSES.map(s=>[s,rows.filter(r=>r.status===s).length]));},
};