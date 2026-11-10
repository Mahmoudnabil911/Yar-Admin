const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const sandbox={window:{},URL};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/operations-model.js'),'utf8'),sandbox);
const M=sandbox.YAROperationsModel;
assert.equal(M,sandbox.window.YAROperationsModel);
const plain=value=>JSON.parse(JSON.stringify(value));
const context={at:'2026-11-06T10:00:00+03:00',providers:[{id:'p1',name:'مزوّد طيران',serviceType:'flight',status:'published'},{id:'p2',name:'مزوّد نقل',serviceType:'transfer',status:'published'}],staff:[{id:'s1',name:'نور',status:'active',role:'agent',permissions:['bookings']},{id:'s2',name:'أحمد',status:'inactive',role:'admin',permissions:['bookings']},{id:'s3',name:'علي',status:'active',role:'viewer',permissions:['reports']}]};
const input=overrides=>({id:'B1',service:'flight',currency:'IQD',source:'whatsapp',date:'2026-11-06',customer:'عميل مثال',phone:'07XX XXX XX01',route:'بغداد ← مشهد',detail:'ذهاب فقط · بيانات تجريبية',providerId:'p1',cost:100000,markupMode:'percent',markupValue:10,discountMode:'percent',discountValue:0,serviceInfo:{origin:'بغداد',destination:'مشهد',travelDate:'2026-12-01'},travellers:[{name:'DEMO PERSON',passport:'DEMO001'}],...overrides});
const created=overrides=>M.create([],input(overrides),context);
function processing(overrides){let rows=created(overrides);rows=M.updateDetails(rows,'B1',{reference:'PNR-DEMO'},context);return M.transition(rows,'B1','processing',{},context);}
function paid(overrides){let rows=processing(overrides);return M.recordPayment(rows,'B1',{amount:rows[0].amount,method:'office',status:'accepted',reference:'RCPT-1'},context);}
function issued(overrides){return M.transition(paid(overrides),'B1','issued',{},context);}

test('legacy migration preserves identities and dates, declares derived costs and adds one demo tour',()=>{
  const legacy=[{id:'YAR-1048',customer:'ليان الربيعي',initials:'ل ر',service:'flight',route:'بغداد ← مشهد',detail:'مثال',date:'2026-11-05',createdAt:'09:24',amount:428000,payment:'paid',status:'issued',provider:'مزوّد طيران',assigned:'نور'}];
  const rows=M.fromLegacy(legacy,context),old=rows.find(r=>r.id==='YAR-1048');
  assert.equal(old.date,'2026-11-05');assert.equal(old.createdAt,'09:24');assert.equal(old.amount,428000);assert.equal(old.pricing.basis,'legacy-demo');assert.match(old.pricing.ruleLabel,/افتراضية/);assert.equal(M.balances(old).collected,428000);assert.equal(old.providerId,'p1');assert.equal(old.assignedId,'s1');assert.equal(rows.filter(r=>r.id==='YAR-WA-TOUR-DEMO').length,1);assert.equal(rows.find(r=>r.service==='tour').currency,'USD');assert.equal(legacy[0].pricing,undefined);
});

test('old rejected bookings migrate to cancelled without altering reasons or payment history',()=>{
  const old=plain(created());old[0].status='rejected';old[0].timeline.push({type:'rejected',note:'عدم التوفر',at:context.at});
  old[0].payments.push({id:'DECLINED-RECEIPT',amount:110000,method:'office',status:'rejected',reference:'OLD-RECEIPT',note:'غير مطابق',at:context.at});
  const restored=M.hydrate(old);
  assert.equal(restored[0].status,'cancelled');assert.equal(M.statuses.rejected,undefined);
  assert.deepEqual(plain(restored[0].timeline),old[0].timeline);assert.deepEqual(plain(restored[0].payments),old[0].payments);
  assert.deepEqual(plain(M.hydrate(restored)),plain(restored));assert.equal(old[0].status,'rejected');
  assert.equal(M.filter(restored,{status:'cancelled'}).length,1);
  assert.throws(()=>M.transition(created(),'B1','rejected',{reason:'عدم التوفر'},context));
});

test('manual order fixes a precise currency snapshot and validates provider, source and masked contact',()=>{
  const rows=created({currency:'USD',cost:1.15,markupValue:10});assert.equal(rows[0].pricing.markupAmount,.12);assert.equal(rows[0].amount,1.27);
  assert.equal(M.snapshot({cost:100000,markupMode:'percent',markupValue:10,discountMode:'percent',discountValue:5},'IQD').final,104500);
  for(const bad of [{cost:-1},{cost:NaN},{phone:'07700000000'},{providerId:'missing'},{source:'email'},{currency:'EUR'},{discountValue:101}])assert.throws(()=>created(bad));
  assert.equal(created({cost:0,markupValue:0})[0].amount,0);
});

test('workflow enforces legal transitions, complete service details, receipt and confirmation reference',()=>{
  const rows=created();assert.throws(()=>M.transition(rows,'B1','issued',{},context));
  const busy=M.transition(rows,'B1','processing',{},context);assert.throws(()=>M.transition(busy,'B1','issued',{},context));
  let ready=M.updateDetails(busy,'B1',{reference:'PNR-DEMO'},context);assert.throws(()=>M.transition(ready,'B1','issued',{},context));
  ready=M.recordPayment(ready,'B1',{amount:110000,method:'card',reference:'PAY-1',status:'accepted'},context);
  const final=M.transition(ready,'B1','issued',{},context);assert.equal(final[0].status,'issued');assert.equal(final[0].issuedAt,context.at);assert.equal(rows[0].status,'awaiting');
  assert.throws(()=>M.transition(final,'B1','processing',{},context));assert.throws(()=>M.updateDetails(final,'B1',{route:'تغيير'},context));
  assert.throws(()=>M.transition(paid({serviceInfo:{}}),'B1','issued',{},context));
  const stale={...context,providers:[{...context.providers[0],status:'archived'}]};assert.throws(()=>M.transition(ready,'B1','issued',{},stale));
});

test('payment review does not count as collected; approval is bounded and rejection has a reason',()=>{
  const initial=created({service:'transfer',providerId:'p2'});const pending=M.recordPayment(initial,'B1',{amount:60000,method:'wallet',status:'review',reference:'R1'},context);
  assert.equal(M.balances(pending[0]).collected,0);assert.equal(pending[0].paymentState,'review');
  const receipt=pending[0].payments[0].id;assert.throws(()=>M.reviewPayment(pending,'B1',receipt,'rejected','',context));
  const accepted=M.reviewPayment(pending,'B1',receipt,'accepted','مطابق',context);assert.equal(M.balances(accepted[0]).collected,60000);assert.equal(accepted[0].paymentState,'partial');
  assert.throws(()=>M.recordPayment(accepted,'B1',{amount:60000,method:'office',status:'accepted',reference:'R2'},context));
  assert.throws(()=>M.reviewPayment(accepted,'B1',receipt,'accepted','',context));
  assert.equal(initial[0].payments.length,0);assert.equal(pending[0].payments[0].status,'review');
});

test('paid cancellation needs acknowledgement and never silently refunds; rejected paid orders are forbidden',()=>{
  const rows=paid();assert.throws(()=>M.transition(rows,'B1','cancelled',{reason:'طلب العميل'},context));assert.throws(()=>M.transition(rows,'B1','rejected',{reason:'رفض',confirmPaidCancellation:true},context));
  const cancelled=M.transition(rows,'B1','cancelled',{reason:'طلب العميل',confirmPaidCancellation:true},context);
  assert.equal(M.balances(cancelled[0]).collected,110000);assert.equal(M.balances(cancelled[0]).refunded,0);assert.equal(cancelled[0].status,'cancelled');
  assert.throws(()=>M.transition(cancelled,'B1','issued',{},context));assert.throws(()=>M.recordPayment(cancelled,'B1',{amount:1,method:'office',status:'accepted',reference:'NEW'},context));
});

test('flight receipts require full payment including review approval; old partial histories remain readable',()=>{
  const initial=processing();
  for(const status of ['accepted','review'])assert.throws(()=>M.recordPayment(initial,'B1',{amount:60000,method:'office',status,reference:'PARTIAL'},context),/الدفع الكامل/);
  const pending=M.recordPayment(initial,'B1',{amount:110000,method:'office',status:'review',reference:'FULL-REVIEW'},context);
  assert.equal(M.paymentStatus(pending[0]),'unpaid');assert.throws(()=>M.transition(pending,'B1','issued',{},context));
  const accepted=M.reviewPayment(pending,'B1',pending[0].payments[0].id,'accepted','مطابق',context);assert.equal(M.paymentStatus(accepted[0]),'paid');assert.equal(M.balances(accepted[0]).balance,0);
  const old=plain(initial);old[0].payments.push({id:'OLD-PARTIAL',amount:60000,method:'office',status:'accepted',reference:'OLD',at:context.at});
  const restored=M.hydrate(old);assert.equal(M.paymentStatus(restored[0]),'unpaid');assert.throws(()=>M.recordPayment(restored,'B1',{amount:20000,method:'office',status:'accepted',reference:'PARTIAL-AGAIN'},context));
  const completed=M.recordPayment(restored,'B1',{amount:50000,method:'office',status:'accepted',reference:'COMPLETE'},context);assert.equal(M.paymentStatus(completed[0]),'paid');assert.equal(M.balances(completed[0]).balance,0);
  const partialReview=plain(initial);partialReview[0].payments.push({id:'OLD-REVIEW',amount:60000,method:'office',status:'review',reference:'OLD-REVIEW',at:context.at});assert.throws(()=>M.reviewPayment(M.hydrate(partialReview),'B1','OLD-REVIEW','accepted','',context),/دفعة جزئية/);
  assert.equal(initial[0].payments.length,0);
});

test('binary payment filter excludes pending receipts, keeps refund history distinct and handles zero-price orders',()=>{
  const unpaid=created(),paidRows=paid();paidRows[0].id='PAID';const rows=[...unpaid,...paidRows];
  assert.equal(M.filter(rows,{paymentStatus:'paid'}).length,1);assert.equal(M.filter(rows,{paymentStatus:'unpaid'})[0].id,'B1');assert.throws(()=>M.filter(rows,{paymentStatus:'partial'}));
  let cancelled=M.transition(paidRows,'PAID','cancelled',{reason:'إلغاء',confirmPaidCancellation:true},context);cancelled=M.refund(cancelled,'PAID',{amount:110000,reference:'REFUND',note:'كامل'},context);
  assert.equal(M.paymentStatus(cancelled[0]),'paid');assert.equal(M.balances(cancelled[0]).paymentState,'refunded');assert.equal(M.balances(cancelled[0]).balance,0);
  assert.equal(M.paymentStatus(created({cost:0,markupValue:0})[0]),'paid');
});

test('partial and cumulative customer refunds cannot exceed accepted collection or bypass cancellation',()=>{
  const rows=paid();assert.throws(()=>M.refund(rows,'B1',{amount:1,reference:'F0',note:'مثال'},context));
  let cancelled=M.transition(rows,'B1','cancelled',{reason:'طلب العميل',confirmPaidCancellation:true},context);
  cancelled=M.refund(cancelled,'B1',{amount:30000,reference:'F1',note:'جزئي'},context);assert.equal(M.balances(cancelled[0]).netCollected,80000);assert.equal(cancelled[0].paymentState,'partialRefund');
  assert.throws(()=>M.refund(cancelled,'B1',{amount:80001,reference:'F2',note:'تجاوز'},context));
  cancelled=M.refund(cancelled,'B1',{amount:80000,reference:'F2',note:'الباقي'},context);assert.equal(cancelled[0].refunds.length,2);assert.equal(M.balances(cancelled[0]).netCollected,0);assert.equal(cancelled[0].paymentState,'refunded');
});

test('supplier settlement is bounded by frozen cost and supports cancelled-payment recovery separately',()=>{
  assert.throws(()=>M.settle(paid(),'B1',{amount:1,reference:'S0'},context));
  let rows=issued();rows=M.settle(rows,'B1',{amount:60000,reference:'S1'},context);assert.equal(M.balances(rows[0]).outstanding,40000);assert.throws(()=>M.settle(rows,'B1',{amount:40001,reference:'S2'},context));
  rows=M.transition(rows,'B1','cancelled',{reason:'إلغاء بعد الإصدار',confirmPaidCancellation:true},context);assert.equal(M.balances(rows[0]).outstanding,0);assert.equal(M.balances(rows[0]).providerRecoverable,60000);
  assert.throws(()=>M.settle(rows,'B1',{amount:1,reference:'S3'},context));assert.throws(()=>M.settle(rows,'B1',{amount:60001,direction:'refund',reference:'S4'},context));
  rows=M.settle(rows,'B1',{amount:60000,direction:'refund',reference:'S4'},context);assert.equal(M.balances(rows[0]).supplierPaid,0);assert.equal(M.balances(rows[0]).refunded,0);
});

test('report keeps currencies separate and distinguishes cancelled sales, refunds, margin and cash',()=>{
  let iqd=issued(),usd=issued({id:'B1',currency:'USD',cost:100,markupValue:10});usd[0].id='USD-1';
  let rows=[...iqd,...usd];const before=M.report(rows);assert.equal(before.currencies.IQD.grossSales,110000);assert.equal(before.currencies.USD.grossSales,110);assert.equal(before.currencies.IQD.grossMargin,10000);assert.equal(before.currencies.IQD.netCollected,110000);assert.equal(before.currencies.IQD.cashAfterSupplier,110000);
  rows=M.transition(rows,'B1','cancelled',{reason:'إلغاء',confirmPaidCancellation:true},context);let report=M.report(rows);assert.equal(report.currencies.IQD.grossSales,110000);assert.equal(report.currencies.IQD.cancelledSales,110000);assert.equal(report.currencies.IQD.netSales,0);assert.equal(report.currencies.IQD.refunds,0);assert.equal(report.currencies.IQD.netCollected,110000);
  rows=M.refund(rows,'B1',{amount:110000,reference:'FULL',note:'كامل'},context);report=M.report(rows,{currency:'IQD'});assert.equal(report.rows.length,1);assert.equal(report.currencies.IQD.refunds,110000);assert.equal(report.currencies.USD.orders,0);assert.equal(report.currencies.IQD.netCollected,0);
});

test('assignment permissions, timeline and metadata remain independent of frozen pricing',()=>{
  const rows=created(),snapshot=plain(rows[0].pricing);for(const staffId of ['s2','s3','missing'])assert.throws(()=>M.assign(rows,'B1',staffId,context));
  let changed=M.assign(rows,'B1','s1',context);changed=M.addNote(changed,'B1','متابعة أولى',context);changed=M.addNote(changed,'B1','متابعة ثانية',context);changed=M.attachDocument(changed,'B1',{label:'قسيمة مثال',reference:'V-DEMO',url:'https://demo.invalid/voucher'},context);
  assert.equal(changed[0].assigned,'نور');assert.equal(changed[0].timeline.filter(t=>t.type==='note').length,2);assert.equal(rows[0].timeline.length,1);assert.deepEqual(plain(changed[0].pricing),snapshot);assert.throws(()=>M.attachDocument(rows,'B1',{label:'سيئ',url:'javascript:alert(1)'},context));assert.throws(()=>M.attachDocument(rows,'B1',{label:'سيئ',url:'https://user:pass@demo.invalid/a'},context));
});

test('versioned serialization restores monetary histories and rejects inconsistent snapshots atomically',()=>{
  let rows=issued();rows=M.settle(rows,'B1',{amount:100000,reference:'S1'},context);const saved=JSON.stringify({version:1,records:rows});assert.deepEqual(plain(M.hydrate(JSON.parse(saved))),plain(rows));assert.throws(()=>M.hydrate({version:2,records:rows}));
  const bad=plain(rows);bad[0].pricing.final=1;assert.throws(()=>M.hydrate({version:1,records:bad}));assert.equal(rows[0].amount,110000);
  const prior=plain(rows);assert.throws(()=>M.settle(rows,'B1',{amount:1,reference:'TOO-MUCH'},context));assert.deepEqual(plain(rows),prior);
});

test('scoped filters are inclusive and CSV neutralizes formulas with correct quotes and newlines',()=>{
  let rows=created();rows=M.assign(rows,'B1','s1',context);assert.equal(M.filter(rows,{startDate:'2026-11-06',endDate:'2026-11-06',assignedId:'s1',providerId:'p1',currency:'IQD'}).length,1);assert.equal(M.filter(rows,{startDate:'2026-11-07'}).length,0);assert.throws(()=>M.filter(rows,{startDate:'2026-11-07',endDate:'2026-11-06'}));
  const csv=M.csv([['=SUM(1,2)','a"b','line\nnext','@cmd','safe']]);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"a""b"'));assert.ok(csv.includes('"line\nnext"'));assert.ok(csv.includes('"\'@cmd"'));
});

test('UI bootstrap restores before mount, keeps the compatibility array and returns independent clones',()=>{
  const legacy=[{id:'HIST-1',customer:'عميل مثال',service:'flight',route:'بغداد ← مشهد',detail:'مثال تاريخي',date:'2026-11-05',amount:100000,payment:'pending',status:'awaiting',provider:'مزوّد طيران',assigned:'نور'}];
  const saved=M.fromLegacy(legacy,context);const compatibility=[];
  const browser={window:{YAROperationsModel:M,YAR_ADMIN:{esc:String,icon:()=>'',toast:()=>{}},YAR_DEMO:{bookings:compatibility}},localStorage:{getItem:()=>JSON.stringify({version:1,records:saved}),setItem:()=>{}},URL};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../dist/operations.js'),'utf8'),browser);
  const api=browser.window.YAROperations;api.configure({getProviders:()=>context.providers,getStaff:()=>context.staff});const rows=api.getBookings();
  assert.equal(browser.window.YAR_DEMO.bookings,compatibility);assert.equal(compatibility.find(r=>r.id==='HIST-1').date,'2026-11-05');
  rows.find(r=>r.id==='HIST-1').pricing.cost=1;assert.notEqual(api.getBookings().find(r=>r.id==='HIST-1').pricing.cost,1);
  assert.equal(compatibility.some(r=>r.service==='tour'),true);
});
