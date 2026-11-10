(() => {
  'use strict';
  const M=globalThis.YAROperationsModel || window.YAROperationsModel;
  const copy=v=>JSON.parse(JSON.stringify(v)), text=v=>String(v??'').trim();
  const fail=message=>{throw Error(message);};
  let serial=0;
  const units=(value,currency)=>{M.money(value,currency);const n=Math.round(value*(currency==='USD'?100:1));if(!Number.isSafeInteger(n)||M.money(value,currency)!==value)fail('استخدم مبلغًا صحيحًا بالدينار أو منزلتين عشريتين للدولار.');return n;};
  const positive=(value,currency)=>{if(units(value,currency)<=0)fail('المبلغ يجب أن يكون أكبر من صفر.');return value;};
  const stamp=context=>context.at||new Date().toISOString();
  const id=()=>`credit-${Date.now().toString(36)}-${++serial}`;
  const balance=(ledger,providerId,currency)=>{const n=ledger.filter(e=>e.providerId===providerId&&e.currency===currency).reduce((sum,e)=>sum+(e.type==='issue'?-1:1)*units(e.amount,currency),0);if(!Number.isSafeInteger(n))fail('الرصيد خارج النطاق المتاح.');return n/(currency==='USD'?100:1);};
  function hydrate(input,records=[]){
    if(!Array.isArray(input))fail('سجل رصيد المورّد غير صالح.');
    const ledger=copy(input),ids=new Set(),issues=new Map(),returns=new Map(),running=new Map();
    for(const e of ledger){
      if(!text(e.id)||ids.has(e.id)||!['deposit','issue','return'].includes(e.type)||!text(e.providerId)||!text(e.providerName)||!text(e.reference)||!Number.isFinite(Date.parse(e.at)))fail('إحدى حركات رصيد المورّد غير صالحة.');
      ids.add(e.id);positive(e.amount,e.currency);
      const key=e.providerId+'|'+e.currency,n=(running.get(key)||0)+(e.type==='issue'?-1:1)*units(e.amount,e.currency);
      if(!Number.isSafeInteger(n)||n<0)fail('حركة الخصم تتجاوز الرصيد المتاح.');running.set(key,n);
      if(e.type==='issue'){
        if(!text(e.bookingId)||issues.has(e.bookingId))fail('يوجد خصم مكرر للطلب نفسه.');
        const r=records.find(r=>r.id===e.bookingId),billing=r?.supplierBilling;
        if(!r||!['issued','cancelled'].includes(r.status)||!r.issuedAt||r.providerId!==e.providerId||r.supplierCreditEntryId!==e.id||billing?.currency!==e.currency||billing.amount!==e.amount)fail('خصم المورّد غير مطابق للإصدار المحفوظ.');
        issues.set(e.bookingId,e);
      }
      if(e.type==='return'){
        const debit=issues.get(e.bookingId),r=records.find(r=>r.id===e.bookingId),prior=returns.get(e.bookingId)||0;
        if(!debit||r.status!=='cancelled'||debit.providerId!==e.providerId||debit.currency!==e.currency||!text(e.note)||prior+units(e.amount,e.currency)>units(debit.amount,e.currency))fail('إرجاع الرصيد يتطلب إلغاءً وخصمًا سابقًا ومبلغًا ضمن الحد المتاح.');
        returns.set(e.bookingId,prior+units(e.amount,e.currency));
      }
    }
    for(const r of records)if(r.supplierCreditEntryId&&!issues.has(r.id))fail('خصم الإصدار مفقود من سجل الرصيد.');
    return ledger;
  }
  function deposit(records,inputLedger,input,context={}){
    const ledger=hydrate(inputLedger,records),p=(context.providers||[]).find(p=>p.id===input.providerId&&p.status!=='archived');
    if(!p)fail('اختر مورّدًا موجودًا وغير مؤرشف.');
    if(!text(input.reference))fail('أدخل مرجع إيداع الرصيد.');positive(input.amount,input.currency);
    if(ledger.some(e=>e.type==='deposit'&&e.providerId===p.id&&e.currency===input.currency&&e.reference===text(input.reference)))fail('مرجع الإيداع مسجّل لهذا المورّد بهذه العملة.');
    ledger.push({id:id(),type:'deposit',providerId:p.id,providerName:p.name,currency:input.currency,amount:input.amount,reference:text(input.reference),note:text(input.note),at:stamp(context),staffName:text(context.staffName)||'فريق المعاينة'});
    return hydrate(ledger,records);
  }
  function issue(records,inputLedger,bookingId,billing,context={}){
    const ledger=hydrate(inputLedger,records),r=records.find(r=>r.id===bookingId);if(!r)fail('الطلب غير موجود.');
    if(r.supplierCreditEntryId||ledger.some(e=>e.type==='issue'&&e.bookingId===bookingId))fail('تم الخصم لهذا الإصدار مسبقًا.');
    positive(billing.amount,billing.currency);
    if(billing.currency===r.currency&&billing.amount!==r.pricing.cost)fail('قيمة الخصم بنفس عملة البيع يجب أن تطابق تكلفة المورّد في لقطة السعر.');
    if(billing.currency!==r.currency&&billing.confirmCurrency!==true)fail('أكّد قيمة الخصم بعملة المورّد؛ لا يوجد تحويل عملة تلقائي.');
    if(units(billing.amount,billing.currency)>units(balance(ledger,r.providerId,billing.currency),billing.currency))fail('رصيد المورّد غير كافٍ للإصدار. اشحن رصيد العملة المطلوبة أولًا.');
    const next=M.transition(records,bookingId,'issued',{},context),issued=next.find(r=>r.id===bookingId),entryId=id();
    issued.supplierTicket={pnr:issued.reference,route:issued.route,travelDate:issued.serviceInfo?.travelDate||'',carrier:issued.serviceInfo?.carrier||''};
    issued.supplierBilling={currency:billing.currency,amount:billing.amount,confirmedAt:stamp(context)};issued.supplierCreditEntryId=entryId;
    ledger.push({id:entryId,type:'issue',providerId:r.providerId,providerName:r.provider,currency:billing.currency,amount:billing.amount,bookingId,reference:issued.reference,note:'خصم تكلفة المورّد من الرصيد عند الإصدار / التأكيد',at:stamp(context),staffName:text(context.staffName)||'فريق المعاينة'});
    issued.timeline.push({id:`${bookingId}-credit-${entryId}`,at:stamp(context),type:'supplier-credit',note:`خصم من رصيد المورّد: ${billing.amount} ${billing.currency} · ${issued.reference}`,staffName:text(context.staffName)||'فريق المعاينة'});
    return {records:next,ledger:hydrate(ledger,next)};
  }
  function refundable(ledger,bookingId){const debit=ledger.find(e=>e.type==='issue'&&e.bookingId===bookingId);if(!debit)return 0;return M.money(debit.amount-ledger.filter(e=>e.type==='return'&&e.bookingId===bookingId).reduce((n,e)=>n+e.amount,0),debit.currency);}
  function restore(records,inputLedger,bookingId,input,context={}){
    const ledger=hydrate(inputLedger,records),r=records.find(r=>r.id===bookingId),debit=ledger.find(e=>e.type==='issue'&&e.bookingId===bookingId);
    if(r?.status!=='cancelled'||!debit)fail('إرجاع رصيد المورّد يتطلب طلبًا ملغيًا سبق خصمه من الرصيد.');
    positive(input.amount,debit.currency);if(input.amount>refundable(ledger,bookingId))fail('الإرجاع يتجاوز الخصم المتبقي لهذا الإصدار.');
    if(!text(input.reference)||!text(input.note)||input.confirmed!==true)fail('أدخل مرجع وسبب الإرجاع وأكّد أن المورّد أعاد الرصيد.');
    if(ledger.some(e=>e.type==='return'&&e.providerId===debit.providerId&&e.currency===debit.currency&&e.reference===text(input.reference)))fail('مرجع الإرجاع مسجّل مسبقًا.');
    ledger.push({id:id(),type:'return',providerId:debit.providerId,providerName:debit.providerName,currency:debit.currency,amount:input.amount,bookingId,reference:text(input.reference),note:text(input.note),at:stamp(context),staffName:text(context.staffName)||'فريق المعاينة'});
    const next=M.addNote(records,bookingId,`إرجاع إلى رصيد المورّد بعد التأكيد: ${input.amount} ${debit.currency} · ${text(input.reference)}`,context);
    return {records:next,ledger:hydrate(ledger,next)};
  }
  function accounts(ledger,providers=[]){
    const keys=new Map(providers.filter(p=>p.status!=='archived').map(p=>[p.id+'|USD',{providerId:p.id,name:p.name,currency:'USD'}]));
    for(const e of ledger)keys.set(e.providerId+'|'+e.currency,{providerId:e.providerId,name:providers.find(p=>p.id===e.providerId)?.name||e.providerName,currency:e.currency});
    return [...keys.values()].map(a=>{const rows=ledger.filter(e=>e.providerId===a.providerId&&e.currency===a.currency),sum=type=>M.money(rows.filter(e=>e.type===type).reduce((n,e)=>n+e.amount,0),a.currency);return {...a,balance:balance(ledger,a.providerId,a.currency),deposits:sum('deposit'),issued:sum('issue'),returned:sum('return'),count:rows.length,low:balance(ledger,a.providerId,a.currency)<(a.currency==='USD'?100:100000)};});
  }
  function statement(input,records=[]){
    const ledger=hydrate(input,records),running=new Map();
    return ledger.map(e=>{const key=e.providerId+'|'+e.currency,debit=e.type==='issue'?e.amount:0,credit=e.type==='issue'?0:e.amount,after=M.money((running.get(key)||0)+credit-debit,e.currency);running.set(key,after);const r=records.find(r=>r.id===e.bookingId),ticket=e.ticket||r?.supplierTicket||{};return {...e,debit,credit,after,pnr:text(ticket.pnr)||text(r?.reference),route:text(ticket.route)||text(r?.route),travelDate:text(ticket.travelDate)||text(r?.serviceInfo?.travelDate),carrier:text(ticket.carrier)||text(r?.serviceInfo?.carrier)};});
  }
  function demo(inputRecords,inputLedger,providerId,context={}){
    let records=M.hydrate(inputRecords),ledger=hydrate(inputLedger,records);const p=(context.providers||[]).find(p=>p.id===providerId&&p.serviceType==='flight'&&p.status==='published'&&p.operatingEnabled!==false);if(!p)fail('اختر مورّد طيران منشورًا ومفعّلًا لإضافة المثال.');
    const prefix='DEMO-STATEMENT-'+p.id;if(records.some(r=>r.id.startsWith(prefix)))fail('مثال هذا المورّد موجود مسبقًا؛ لم تُضف حركات مكررة.');
    let at=Math.max(Date.now(),...ledger.map(e=>Date.parse(e.at)));const ctx=()=>({...context,at:new Date(at+=60000).toISOString(),staffName:'فريق المعاينة · مثال تجريبي'});
    if(balance(ledger,p.id,'USD')<470)ledger=deposit(records,ledger,{providerId:p.id,currency:'USD',amount:1000,reference:prefix+'-FUND',note:'تعزيز تجريبي لعرض الكشف؛ لا توجد حوالة فعلية.'},ctx());
    const examples=[{cost:100,name:'أحمد المثال',route:'بغداد ← مشهد',origin:'BGW',destination:'MHD',pnr:'DEMO-PNR101'},{cost:150,name:'نور المثال',route:'النجف ← طهران',origin:'NJF',destination:'IKA',pnr:'DEMO-PNR102'},{cost:220,name:'ليان المثال',route:'البصرة ← شيراز',origin:'BSR',destination:'SYZ',pnr:'DEMO-PNR103'}];
    examples.forEach((e,i)=>{if(i===2)ledger=deposit(records,ledger,{providerId:p.id,currency:'USD',amount:500,reference:prefix+'-TOPUP500',note:'تعزيز رصيد تجريبي إضافي.'},ctx());const id=prefix+'-'+(i+1);records=M.create(records,{id,service:'flight',currency:'USD',source:'office',date:M.today(),customer:e.name,phone:'07XX XXX XX99',route:e.route,detail:'تذكرة تجريبية لعرض كشف المورّد فقط',providerId:p.id,cost:e.cost,markupMode:'fixed',markupValue:25,serviceInfo:{origin:e.origin,destination:e.destination,travelDate:'2026-12-01',carrier:'ناقل تجريبي'},travellers:[{name:'DEMO TRAVELLER '+(i+1),passport:'DEMO-PASS-'+(i+1)}]},ctx());records=M.updateDetails(records,id,{reference:e.pnr},ctx());records=M.transition(records,id,'processing',{},ctx());records=M.recordPayment(records,id,{amount:e.cost+25,method:'office',status:'accepted',reference:prefix+'-RECEIPT-'+(i+1),note:'تحصيل تجريبي فقط.'},ctx());({records,ledger}=issue(records,ledger,id,{currency:'USD',amount:e.cost},ctx()));if(i===2){records=M.transition(records,id,'cancelled',{reason:'مثال إلغاء لتوضيح الإرجاع إلى رصيد المورد',confirmPaidCancellation:true},ctx());({records,ledger}=restore(records,ledger,id,{amount:50,reference:prefix+'-RETURN50',note:'إرجاع جزئي تجريبي بعد تأكيد المورد؛ لا توجد حركة مالية فعلية.',confirmed:true},ctx()));}});
    return {records,ledger};
  }
  const api={hydrate,deposit,issue,restore,refundable,balance,accounts,statement,demo};globalThis.YARSupplierCreditModel=api;if(typeof window!=='undefined')window.YARSupplierCreditModel=api;
})();
