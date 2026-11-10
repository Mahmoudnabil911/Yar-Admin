/* Synthetic acceptance-test scenarios only. No network or real customer data. */
(() => {
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v));
  const prefix='YAR-TEST-FINAL-';
  function build(records,ledger,context,anchor) {
    const M=window.YAROperationsModel,C=window.YARSupplierCreditModel;
    records=M.hydrate(records); ledger=C.hydrate(ledger,records);
    const day=anchor||M.today(),base=Date.parse(day+'T08:00:00+03:00');
    let clock=Math.max(base,...ledger.map(e=>Date.parse(e.at)));
    const ctx=()=>({...context,at:new Date(clock+=1000).toISOString(),staffName:'فريق الاختبار · تجريبي'});
    const date=n=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
    const names=['نور المثال','علي التجريبي','سارة الاختبار','أحمد المثال','مريم التجريبية','حسن الاختبار','زينب المثال','عمر التجريبي'];
    const services=['flight','hotel','package','transfer','tour'];
    const labels={flight:'طيران',hotel:'فندق',package:'باقة',transfer:'نقل',tour:'جولة'};
    let added=0;
    for(let i=39;i>=0;i--){
      const id=prefix+String(i+1).padStart(3,'0');
      if(records.some(r=>r.id===id))continue;
      const service=services[i%5],p=context.providers.find(p=>p.serviceType===service&&p.status==='published'&&p.operatingEnabled!==false);
      if(!p)continue; // Respect the user's paused/archived supplier configuration.
      const currency=i%3===0?'USD':'IQD',cost=currency==='USD'?80+i*5:80000+i*10000;
      const scenario=Math.floor(i/5),orderDate=i<10?day:date(-(i%20+1));
      const info={flight:{origin:'BGW',destination:i%2?'IKA':'MHD',travelDate:date(14),returnDate:date(21),carrier:'ناقل تجريبي',cabin:'السياحية'},hotel:{hotelName:'فندق الاختبار',checkIn:date(14),checkOut:date(19),rooms:'غرفة قياسية · شخصان',breakfast:'مشمول'},package:{packageName:'برنامج مشهد التجريبي',nights:'5',travelDate:date(14),hotelName:'لوتوس'},transfer:{vehicle:'سيدان تجريبية',pickup:'المطار إلى الفندق',travelDate:date(14),passengers:'3'},tour:{tourName:'جولة مشهد التجريبية',pickup:'الفندق',travelDate:date(15),passengers:'3'}}[service];
      records=M.create(records,{id,customerId:'customer-demo-'+String(i%24+1).padStart(3,'0'),customer:names[i%names.length]+' '+(i+1),phone:'07XX XXX XX'+String(i%100).padStart(2,'0'),service,currency,source:['app','whatsapp','office'][i%3],date:orderDate,providerId:p.id,route:service==='flight'?'بغداد ← '+(i%2?'طهران':'مشهد'):'مشهد · '+labels[service]+' تجريبي',detail:'اختبار نهائي · '+['طلب جديد','قيد المعالجة','إيصال للمراجعة','مؤكد ومدفوع','إلغاء واسترداد','ملغي لعدم التوفر','إيصال مرفوض','جاهز لإكمال الإجراءات'][scenario],cost,markupMode:'percent',markupValue:15,discountMode:'percent',discountValue:i%4===0?10:0,serviceInfo:info,travellers:[{name:'DEMO TRAVELLER '+(i+1),passport:'DEMO-PASS-'+(i+1)}]},ctx());
      const employee=(context.staff||[]).filter(s=>s.status==='active'&&(s.role==='admin'||s.permissions?.includes('bookings')))[i%3];
      if(employee)records=M.assign(records,id,employee.id,ctx());
      if(scenario===5)records=M.transition(records,id,'cancelled',{reason:'إلغاء تجريبي لعدم التوفر'},ctx());
      else if(scenario>0){
        records=M.updateDetails(records,id,{reference:'DEMO-PNR-'+(i+1)},ctx());
        records=M.transition(records,id,'processing',{},ctx());
        const amount=records.find(r=>r.id===id).amount;
        if([2,3,4,6].includes(scenario))records=M.recordPayment(records,id,{amount,method:['card','wallet','office'][i%3],status:scenario===2?'review':scenario===6?'rejected':'accepted',reference:'DEMO-RECEIPT-'+(i+1),note:'إيصال تجريبي للاختبار فقط'},ctx());
        if([3,4].includes(scenario)){
          const ref='DEMO-FINAL-FUND-'+p.id+'-'+currency;
          if(!ledger.some(e=>e.reference===ref))ledger=C.deposit(records,ledger,{providerId:p.id,currency,amount:currency==='USD'?5000:10000000,reference:ref,note:'تعزيز تجريبي لا يمثل إيداعًا حقيقيًا'},ctx());
          // Preserve current balances; add only sufficient synthetic funding when needed.
          if(C.balance(ledger,p.id,currency)<cost)ledger=C.deposit(records,ledger,{providerId:p.id,currency,amount:cost,reference:'DEMO-FINAL-EXTRA-'+id,note:'رصيد تكميلي تجريبي'},ctx());
          ({records,ledger}=C.issue(records,ledger,id,{currency,amount:cost},ctx()));
          records=M.attachDocument(records,id,{label:'مرجع تأكيد تجريبي',reference:'DEMO-DOC-'+(i+1)},ctx());
          if(scenario===4){
            records=M.transition(records,id,'cancelled',{reason:'إلغاء اختباري مع استرداد كامل للعميل',confirmPaidCancellation:true},ctx());
            records=M.refund(records,id,{amount,reference:'DEMO-REFUND-'+(i+1),note:'استرداد تجريبي بعد الإلغاء'},ctx());
            ({records,ledger}=C.restore(records,ledger,id,{amount:cost,reference:'DEMO-CREDIT-RETURN-'+(i+1),note:'إرجاع تجريبي مؤكد من المورد',confirmed:true},ctx()));
          }
        }
      }
      added++;
    }
    const paidId='YAR-TEST-PAID-001';
    const flightProvider=context.providers.find(p=>p.serviceType==='flight'&&p.status==='published'&&p.operatingEnabled!==false);
    if(flightProvider&&!records.some(r=>r.id===paidId)){
      const p=flightProvider;
      records=M.create(records,{id:paidId,customer:'أحمد المثال · مدفوع بالكامل',phone:'07XX XXX XX88',service:'flight',currency:'IQD',source:'app',date:day,providerId:p.id,route:'بغداد ← مشهد',detail:'مثال تجريبي · مدفوع بالكامل ومؤكد · مسافر واحد',cost:200000,markupMode:'fixed',markupValue:45000,serviceInfo:{origin:'BGW',destination:'MHD',travelDate:date(14),carrier:'ناقل تجريبي',cabin:'السياحية'},travellers:[{name:'AHMED DEMO',passport:'DEMO-PASS-PAID'}]},ctx());
      records=M.updateDetails(records,paidId,{reference:'DEMO-PAID01'},ctx());
      records=M.transition(records,paidId,'processing',{},ctx());
      records=M.recordPayment(records,paidId,{amount:245000,method:'wallet',status:'accepted',reference:'PAY-DEMO-FULL-001',note:'تحصيل كامل تجريبي: 245,000 د.ع؛ لا توجد دفعة حقيقية.'},ctx());
      if(C.balance(ledger,p.id,'IQD')<200000)ledger=C.deposit(records,ledger,{providerId:p.id,currency:'IQD',amount:200000,reference:'DEMO-PAID-FUND-001',note:'تعزيز تجريبي لتأكيد مثال الحجز المدفوع'},ctx());
      ({records,ledger}=C.issue(records,ledger,paidId,{currency:'IQD',amount:200000},ctx()));
      records=M.attachDocument(records,paidId,{label:'تأكيد تذكرة تجريبية مدفوعة',reference:'TKT-DEMO-PAID-001'},ctx());
      added++;
    }
    return {records:M.hydrate(records),ledger:C.hydrate(ledger,records),added};
  }
  function catalogExamples(types){
    const provider=types?.providers?.seed?.find(p=>p.serviceType==='hotel');
    if(provider&&!types.providers.seed.some(p=>p.id==='DEMO-FINAL-CAT-provider-package'))types.providers.seed.push({...clone(provider),id:'DEMO-FINAL-CAT-provider-package',name:'مزود البرامج · تجريبي',serviceType:'package',status:'published',operatingEnabled:true});
    for(const key of ['hotels','packages','cars','tours','providers']){
      const type=types?.[key]; if(!type?.seed?.length)continue;
      const original=clone(type.seed);
      for(let i=0;i<4;i++){
        const r=clone(original[i%original.length]);
        r.id='DEMO-FINAL-CAT-'+key+'-'+(i+1); r.name+=' · اختبار '+(i+1);
        r.status=['published','published','draft','archived'][i];
        if(key==='providers'){r.operatingEnabled=i<2;r.fallbackProviderId='';}
        if(key==='packages')r.durationDays=7;
        if(!type.seed.some(e=>e.id===r.id))type.seed.push(r);
      }
    }
  }
  catalogExamples(window.YAR_CATALOG_TYPES);
  window.YARFinalDemo={build,prefix};
})();
