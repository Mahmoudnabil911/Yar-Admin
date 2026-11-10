import React, { useMemo, useState } from 'react';
import {
  Info, ConciergeBell, ScrollText, BedDouble, BadgePercent, CalendarRange, Images, ClipboardCheck, Plus, Trash2, Copy, ChevronDown,
  ArrowRight, ArrowLeft, Save, TriangleAlert, CircleCheck, Users, Sparkles, MapPin, Clock, Layers, Tag, Utensils,
} from 'lucide-react';
import { catalogTypes } from '../../services/models';
import { catalogStorage, sanitize, generatedId, normalized } from '../../services/storage/catalogStorage';
import { useToast } from '../../components/ui/Toast';
import PhotoDropzone from '../catalog/PhotoDropzone';
import { catalogFormData, addPhotoFiles } from '../../services/catalogForm';
import * as C from '../../services/hotelCatalog';
import { migrateHotel, publishChecklist, startingRates, occupancyError, seasonError } from '../../services/hotelPricing';
import { FACILITY_ICONS, ROOM_AMENITY_ICONS, VIEW_ICONS, BED_ICONS, HOTEL_TYPE_ICONS, MEAL_ICONS, GALLERY_ICONS, FALLBACK_ICON } from './hotelIcons';
import { useHotelWords, Field, TextIn, AreaIn, NumIn, DateIn, SelectIn, Toggle, ChoiceChips, AmenityPicker, SectionTitle, money } from './hotelUi';
import HotelDetailView from './HotelDetailView';
import './hotel-editor.css';

const clone = v => JSON.parse(JSON.stringify(v));
const CITIES = ['مشهد', 'طهران', 'شيراز', 'أصفهان', 'شمال إيران'].map(c => ({ code: c, ar: c, en: { 'مشهد': 'Mashhad', 'طهران': 'Tehran', 'شيراز': 'Shiraz', 'أصفهان': 'Isfahan', 'شمال إيران': 'North Iran' }[c] }));
const SEASON_NAMES = [['الموسم العادي', 'Regular Season'], ['الموسم المرتفع', 'High Season'], ['الموسم المنخفض', 'Low Season'], ['موسم العطلات', 'Holiday Season'], ['فترة ترويجية', 'Promotional Period']];
const emptyRoom = () => ({ id: generatedId(), name: '', nameEn: '', category: '', viewType: '', beds: [], bedGuaranteed: false, capacity: 2, standardAdults: 2, maxAdults: 2, maxChildren: 0, amenityCodes: [], photos: [], gallery: [], ratePlans: [], seasons: [], availability: [] });
const emptyPlan = () => ({ id: generatedId(), mealPlan: 'RO', rateType: 'standard', currency: 'IQD', priceBasis: 'per_room_night', nightlyPrice: null, refundability: 'unknown', status: 'active' });

const TABS = [
  ['basic', 'المعلومات الأساسية', 'Basic Information', Info], ['facilities', 'مرافق الفندق', 'Hotel Facilities', ConciergeBell],
  ['policies', 'السياسات والخدمات', 'Policies & Services', ScrollText], ['rooms', 'الغرف والأجنحة', 'Rooms & Suites', BedDouble],
  ['rates', 'الأسعار وأنظمة الوجبات', 'Pricing & Meal Plans', BadgePercent], ['availability', 'التوافر والمخزون', 'Availability & Inventory', CalendarRange],
  ['gallery', 'الصور والمعرض', 'Gallery & Media', Images], ['review', 'المراجعة والنشر', 'Review & Publish', ClipboardCheck],
];

function GalleryGroups({ groups, categories, onChange }) {
  const { t } = useHotelWords();
  const set = (i, patch) => onChange(groups.map((g, x) => (x === i ? { ...g, ...patch } : g)));
  return (
    <div className="hx-stack">
      {groups.map((g, i) => (
        <fieldset className="hx-card" key={i}>
          <div className="hx-card-head">
            <ChoiceChips options={categories} icons={GALLERY_ICONS} value={g.category} onChange={v => set(i, { category: v })} label={t('تصنيف الصور', 'Photo category')} />
            <button type="button" className="hx-icon-btn" aria-label={t('حذف المجموعة', 'Remove group')} onClick={() => onChange(groups.filter((_, x) => x !== i))}><Trash2 /></button>
          </div>
          <PhotoDropzone label={t('الصور', 'Photos')} value={g.photos || []} onChange={photos => set(i, { photos })} />
          <div className="editor-grid">
            <Field label={t('وصف قصير بالعربية', 'Caption (Arabic)')}><TextIn value={g.captionAr} onChange={v => set(i, { captionAr: v })} /></Field>
            <Field label={t('وصف قصير بالإنجليزية', 'Caption (English)')}><TextIn dir="ltr" value={g.captionEn} onChange={v => set(i, { captionEn: v })} /></Field>
            <Field label={t('نص بديل بالعربية', 'Alt text (Arabic)')}><TextIn value={g.altAr} onChange={v => set(i, { altAr: v })} /></Field>
            <Field label={t('نص بديل بالإنجليزية', 'Alt text (English)')}><TextIn dir="ltr" value={g.altEn} onChange={v => set(i, { altEn: v })} /></Field>
          </div>
        </fieldset>
      ))}
      <button type="button" className="button secondary" onClick={() => onChange([...groups, { category: '', photos: [], captionAr: '', captionEn: '', altAr: '', altEn: '' }])}><Plus />{t('إضافة مجموعة صور مصنفة', 'Add categorized photo group')}</button>
    </div>
  );
}

function RoomHeader({ room, index, open, onToggle, children }) {
  const { t, L } = useHotelWords();
  const View = VIEW_ICONS[room.viewType];
  return (
    <div className="hx-room-head">
      <button type="button" className="hx-room-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="hx-section-icon"><BedDouble /></span>
        <span><strong>{room.name || t(`غرفة ${index + 1}`, `Room ${index + 1}`)}</strong>
          <small>{room.category ? L(C.ROOM_CATEGORIES.find(c => c.code === room.category)) : t('النوع غير محدد', 'Type not set')}{View && <> · <View className="hx-inline-icon" /> {L(C.VIEW_TYPES.find(v => v.code === room.viewType))}</>}</small></span>
        <ChevronDown className="hx-caret" />
      </button>
      {children}
    </div>
  );
}

export default function HotelEditor({ recordId, onBack }) {
  const toast = useToast();
  const { t, L, lang } = useHotelWords();
  const config = catalogTypes.hotels;
  const existing = useMemo(() => (recordId && recordId !== 'new' ? catalogStorage.getRecords('hotels').find(r => r.id === recordId) : null), [recordId]);
  const [record, setRecord] = useState(() => migrateHotel(existing ? clone(existing) : { ...catalogStorage.blankRecord('hotels'), stars: 3, checkIn: '14:00', checkOut: '12:00', rooms: [] }));
  const [status, setStatus] = useState(existing?.status || 'draft');
  const [tab, setTab] = useState('basic');
  const [openRoom, setOpenRoom] = useState(0);
  const [error, setError] = useState('');
  const [custom, setCustom] = useState({ labelAr: '', labelEn: '', category: 'guest' });
  const [saving, setSaving] = useState(false);

  const set = patch => setRecord(r => ({ ...r, ...patch }));
  const rooms = record.rooms || [];
  const setRoom = (i, patch) => set({ rooms: rooms.map((r, x) => (x === i ? { ...r, ...patch } : r)) });
  const setRoomRow = (i, key, j, patch) => setRoom(i, { [key]: (rooms[i][key] || []).map((row, y) => (y === j ? { ...row, ...patch } : row)) });
  const addRoomRow = (i, key, row) => setRoom(i, { [key]: [...(rooms[i][key] || []), row] });
  const removeRoomRow = (i, key, j) => setRoom(i, { [key]: (rooms[i][key] || []).filter((_, y) => y !== j) });

  const facilityCodes = new Set((record.facilities || []).map(f => f.code));
  const customFacilities = (record.facilities || []).filter(f => f.code.startsWith('custom_')).map(f => ({ code: f.code, ar: f.labelAr, en: f.labelEn, labelAr: f.labelAr, labelEn: f.labelEn, category: f.category }));
  const toggleFacility = item => set({ facilities: facilityCodes.has(item.code) ? record.facilities.filter(f => f.code !== item.code) : [...(record.facilities || []), { code: item.code, charge: 'unknown', notes: '', labelAr: item.labelAr || '', labelEn: item.labelEn || '', category: item.category || '' }] });
  const setFacility = (code, patch) => set({ facilities: record.facilities.map(f => (f.code === code ? { ...f, ...patch } : f)) });
  const addCustom = () => {
    const ar = custom.labelAr.trim(), en = custom.labelEn.trim();
    if (!ar) return setError(t('اكتب اسم المرفق بالعربية.', 'Enter the Arabic amenity name.'));
    const taken = [...C.ALL_FACILITIES, ...customFacilities].some(f => normalized(f.ar) === normalized(ar) || (en && normalized(f.en) === normalized(en)));
    if (taken) return setError(t('هذا المرفق موجود بالفعل في القائمة؛ اختره بدل إنشاء نسخة مكررة.', 'This amenity already exists; select it instead of duplicating it.'));
    setError('');
    set({ facilities: [...(record.facilities || []), { code: `custom_${Date.now().toString(36)}`, charge: 'unknown', notes: '', labelAr: ar, labelEn: en, category: custom.category }] });
    setCustom({ labelAr: '', labelEn: '', category: custom.category });
  };

  const duplicateRoom = i => {
    const copy = clone(rooms[i]);
    copy.id = generatedId(); copy.name = `${copy.name} (${t('خيار جديد', 'new variant')})`; copy.viewType = ''; copy.seasons = [];
    copy.ratePlans = (copy.ratePlans || []).map(p => ({ ...p, id: generatedId(), legacy: false }));
    set({ rooms: [...rooms, copy] }); setOpenRoom(rooms.length);
  };

  const rates = startingRates(record);
  const checklist = publishChecklist(record);

  const save = async nextStatus => {
    setError('');
    const finalStatus = nextStatus || status;
    if (finalStatus === 'published' && checklist.length) { setTab('review'); return setError(t(`لا يمكن النشر قبل إكمال: ${checklist.join('، ')}`, `Complete before publishing: ${checklist.length} item(s)`)); }
    setSaving(true);
    try {
      const candidate = { ...sanitize(record, config.fields), id: record.id || '', status: finalStatus, updatedAt: new Date().toISOString() };
      if (!candidate.id) delete candidate.id;
      const form = await addPhotoFiles(catalogFormData(candidate), candidate);
      const saved = await catalogStorage.saveForm('hotels', candidate, form);
      toast(t(`تم حفظ ${saved.name}.`, `${saved.name} saved.`));
      onBack();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  };

  const tabIndex = TABS.findIndex(x => x[0] === tab);

  return (
    <div id="catalog-view" className="hx-editor" data-no-translate>
      <div className="page-heading catalog-heading editor-heading">
        <div>
          <button type="button" className="editor-back" onClick={onBack}>{lang === 'en' ? <ArrowLeft /> : <ArrowRight />}{t('إدارة الفنادق', 'Hotel Management')}</button>
          <h1 id="catalog-title" tabIndex={-1}>{existing ? t('تعديل الفندق', 'Edit Hotel') : t('إضافة فندق', 'Add Hotel')}</h1>
          <p>{t('تُحفظ البيانات في هذا المتصفح. الأسعار النموذجية ليست أسعار موردين فعلية.', 'Data is saved in this browser. Sample prices are not real supplier rates.')}</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button secondary" onClick={onBack}>{t('إلغاء', 'Cancel')}</button>
          <button type="button" className="button secondary" disabled={saving} onClick={() => save('draft')}><Save />{t('حفظ كمسودة', 'Save Draft')}</button>
          <button type="button" className="button primary" disabled={saving} onClick={() => save()}><CircleCheck />{t('حفظ التغييرات', 'Save Changes')}</button>
        </div>
      </div>

      <nav className="hx-tabs" aria-label={t('أقسام الفندق', 'Hotel sections')}>
        {TABS.map(([code, ar, en, Icon], i) => (
          <button type="button" key={code} className={tab === code ? 'is-on' : ''} aria-current={tab === code ? 'step' : undefined} onClick={() => setTab(code)}>
            <span className="hx-tab-num">{i + 1}</span><Icon aria-hidden="true" /><span>{t(ar, en)}</span>
          </button>
        ))}
      </nav>

      {error && <div className="form-error hx-error" role="alert"><TriangleAlert />{error}</div>}

      <div className="catalog-editor hx-layout">
        <div className="editor-main">
          <section className="panel editor-section">
            {tab === 'basic' && <>
              <SectionTitle icon={Info} title={t('هوية الفندق والموقع', 'Identity & Location')} text={t('الحقول المشار إليها بـ * مطلوبة.', 'Fields marked * are required.')} />
              <div className="editor-grid">
                <Field label={t('اسم الفندق بالعربية', 'Hotel Name (Arabic)')} req><TextIn value={record.name} onChange={v => set({ name: v })} required /></Field>
                <Field label={t('اسم الفندق بالإنجليزية', 'Hotel Name (English)')}><TextIn dir="ltr" value={record.nameEn} onChange={v => set({ nameEn: v })} /></Field>
                <Field label={t('رمز داخلي (اختياري)', 'Internal Code (optional)')}><TextIn dir="ltr" value={record.code} onChange={v => set({ code: v })} /></Field>
                <Field label={t('المعرّف', 'Hotel ID')} hint={t('يُنشأ تلقائيًا ولا يتغير.', 'Generated and stable.')}><input readOnly dir="ltr" value={record.id || t('يُنشأ عند الحفظ', 'Created on save')} /></Field>
                <div className="editor-field wide-field"><span className="hx-label">{t('نوع المنشأة', 'Property Type')}</span><ChoiceChips options={C.HOTEL_TYPES} icons={HOTEL_TYPE_ICONS} value={record.hotelType} onChange={v => set({ hotelType: v || 'hotel' })} label={t('نوع المنشأة', 'Property Type')} /></div>
                <div className="editor-field"><span className="hx-label">{t('تصنيف النجوم', 'Star Rating')}<span className="required-mark">*</span></span>
                  <div className="hx-stars-input" role="radiogroup" aria-label={t('تصنيف النجوم', 'Star Rating')}>{[1, 2, 3, 4, 5].map(s => <button type="button" role="radio" aria-checked={Number(record.stars) === s} key={s} className={Number(record.stars) >= s ? 'is-on' : ''} onClick={() => set({ stars: s })} aria-label={`${s}`}>★</button>)}</div></div>
                <Field label={t('الحالة', 'Status')}><SelectIn value={status} onChange={v => setStatus(v || 'draft')} options={C.HOTEL_STATUSES} /></Field>
                <Field label={t('الدولة', 'Country')}><TextIn value={record.country} onChange={v => set({ country: v })} /></Field>
                <Field label={t('المدينة', 'City')} req><SelectIn value={record.city} onChange={v => set({ city: v })} options={CITIES} required /></Field>
                <Field label={t('المنطقة', 'Area / District')}><TextIn value={record.area} onChange={v => set({ area: v })} /></Field>
                <Field label={t('العنوان الكامل', 'Full Address')} req><TextIn value={record.address} onChange={v => set({ address: v })} required /></Field>
                <Field label={t('رابط خرائط جوجل', 'Google Maps URL')}><TextIn dir="ltr" type="url" value={record.mapsUrl} onChange={v => set({ mapsUrl: v })} placeholder="https://maps.google.com/…" /></Field>
                <Field label={t('خط العرض', 'Latitude')}><NumIn dir="ltr" step="any" value={record.latitude} onChange={v => set({ latitude: v })} /></Field>
                <Field label={t('خط الطول', 'Longitude')}><NumIn dir="ltr" step="any" value={record.longitude} onChange={v => set({ longitude: v })} /></Field>
                <Field label={t('المعالم القريبة', 'Nearby Landmarks')} wide><AreaIn value={record.landmarks} onChange={v => set({ landmarks: v })} /></Field>
                <Field label={t('وصف الفندق بالعربية', 'Description (Arabic)')} wide req><AreaIn value={record.description} onChange={v => set({ description: v })} required /></Field>
                <Field label={t('وصف الفندق بالإنجليزية', 'Description (English)')} wide><AreaIn dir="ltr" value={record.descriptionEn} onChange={v => set({ descriptionEn: v })} /></Field>
                <Field label={t('الموقع الرسمي (اختياري)', 'Official Website (optional)')}><TextIn dir="ltr" value={record.website} onChange={v => set({ website: v })} /></Field>
                <Field label={t('هاتف الفندق (اختياري)', 'Hotel Phone (optional)')}><TextIn dir="ltr" value={record.phone} onChange={v => set({ phone: v })} /></Field>
              </div>
            </>}

            {tab === 'facilities' && <>
              <SectionTitle icon={ConciergeBell} title={t('مرافق الفندق العامة', 'Property Facilities')} text={t('مرافق المنشأة نفسها، منفصلة عن مرافق الغرف. لا يُفترض أن المرفق مجاني؛ حدّد طريقة توفيره.', 'Property-level facilities, separate from room amenities. Nothing is assumed free; set how each is provided.')} />
              <AmenityPicker categories={C.FACILITY_CATEGORIES} icons={FACILITY_ICONS} selected={facilityCodes} onToggle={toggleFacility} extra={customFacilities} />
              {(record.facilities || []).length > 0 && <div className="hx-selected">
                <h3>{t('المرافق المختارة', 'Selected Facilities')} <span className="hx-count">{record.facilities.length}</span></h3>
                {record.facilities.map(f => {
                  const def = C.ALL_FACILITIES.find(x => x.code === f.code) || { ar: f.labelAr, en: f.labelEn };
                  const I = FACILITY_ICONS[f.code] || FALLBACK_ICON;
                  return (
                    <div className="hx-selected-row" key={f.code}>
                      <span className="hx-selected-name"><I />{L(def)}</span>
                      <SelectIn aria-label={t('طريقة التوفير', 'Provision')} value={f.charge} onChange={v => setFacility(f.code, { charge: v || 'unknown' })} options={C.FACILITY_CHARGES} />
                      <TextIn aria-label={t('ملاحظات', 'Notes')} placeholder={t('ملاحظات (اختياري)', 'Notes (optional)')} value={f.notes} onChange={v => setFacility(f.code, { notes: v })} />
                      <button type="button" className="hx-icon-btn" aria-label={t('إزالة', 'Remove')} onClick={() => toggleFacility(f)}><Trash2 /></button>
                    </div>
                  );
                })}
              </div>}
              <div className="hx-card">
                <h3 className="hx-card-title"><Sparkles />{t('إضافة مرفق غير موجود في القائمة', 'Add a custom facility')}</h3>
                <div className="editor-grid">
                  <Field label={t('الاسم بالعربية', 'Arabic name')}><TextIn value={custom.labelAr} onChange={v => setCustom({ ...custom, labelAr: v })} /></Field>
                  <Field label={t('الاسم بالإنجليزية', 'English name')}><TextIn dir="ltr" value={custom.labelEn} onChange={v => setCustom({ ...custom, labelEn: v })} /></Field>
                  <Field label={t('التصنيف', 'Category')}><SelectIn value={custom.category} onChange={v => setCustom({ ...custom, category: v || 'guest' })} options={C.FACILITY_CATEGORIES} /></Field>
                  <div className="editor-field hx-end"><button type="button" className="button secondary" onClick={addCustom}><Plus />{t('إضافة المرفق', 'Add Facility')}</button></div>
                </div>
              </div>
            </>}

            {tab === 'policies' && <>
              <SectionTitle icon={ScrollText} title={t('السياسات والخدمات', 'Policies & Services')} text={t('اكتب السياسات الفعلية فقط؛ اترك غير المعروف فارغًا.', 'Enter actual policies only; leave unknown items empty.')} />
              <div className="editor-grid">
                <Field label={t('وقت الوصول', 'Check-in Time')} hint="HH:mm"><TextIn dir="ltr" value={record.checkIn} onChange={v => set({ checkIn: v })} placeholder="14:00" /></Field>
                <Field label={t('وقت المغادرة', 'Check-out Time')} hint="HH:mm"><TextIn dir="ltr" value={record.checkOut} onChange={v => set({ checkOut: v })} placeholder="12:00" /></Field>
                <Field label={t('توفر الاستقبال', 'Reception Availability')}><TextIn value={record.receptionHours} onChange={v => set({ receptionHours: v })} placeholder={t('مثال: 24 ساعة', 'e.g. 24 hours')} /></Field>
                <Field label={t('الحد الأدنى لعمر تسجيل الوصول', 'Minimum Check-in Age')}><NumIn min="0" max="99" value={record.minCheckInAge} onChange={v => set({ minCheckInAge: v })} /></Field>
                <Field label={t('معلومات الإلغاء', 'Cancellation Information')} wide><AreaIn value={record.cancellationPolicy} onChange={v => set({ cancellationPolicy: v })} /></Field>
                <Field label={t('سياسات المنشأة', 'Property Policies')} wide><AreaIn value={record.propertyPolicies} onChange={v => set({ propertyPolicies: v })} /></Field>
                <Field label={t('سياسة الأطفال', 'Children Policy')} wide hint={t('حدّد الأعمار والرسوم كما يحددها الفندق؛ لا تفترض أن الأطفال مجانًا.', 'Define ages and charges as set by the hotel; do not assume children stay free.')}><AreaIn value={record.childrenPolicy} onChange={v => set({ childrenPolicy: v })} /></Field>
                <Field label={t('سياسة السرير الإضافي', 'Extra Bed Policy')}><AreaIn value={record.extraBedPolicy} onChange={v => set({ extraBedPolicy: v })} /></Field>
                <Field label={t('سياسة الحيوانات الأليفة', 'Pet Policy')}><AreaIn value={record.petPolicy} onChange={v => set({ petPolicy: v })} /></Field>
                <Field label={t('سياسة التدخين', 'Smoking Policy')}><AreaIn value={record.smokingPolicy} onChange={v => set({ smokingPolicy: v })} /></Field>
                <Field label={t('ملاحظات عامة', 'General Notes')}><AreaIn value={record.notes} onChange={v => set({ notes: v })} /></Field>
              </div>
            </>}

            {tab === 'rooms' && <>
              <SectionTitle icon={BedDouble} title={t('الغرف والأجنحة', 'Rooms & Suites')} text={t('كل بطاقة خيار غرفة قابل للبيع: النوع + الإطلالة + الأسرّة. لعرض نفس الغرفة بإطلالتين أنشئ خيارين.', 'Each card is a sellable variant: type + view + beds. Create two variants for the same room with different views.')}>
                <button type="button" className="button primary" onClick={() => { set({ rooms: [...rooms, emptyRoom()] }); setOpenRoom(rooms.length); }}><Plus />{t('إضافة غرفة', 'Add Room')}</button>
              </SectionTitle>
              {!rooms.length && <p className="hx-empty"><BedDouble />{t('لا توجد غرف بعد. أضف أول نوع غرفة.', 'No rooms yet. Add the first room type.')}</p>}
              <div className="hx-stack">
                {rooms.map((room, i) => {
                  const occ = occupancyError(room);
                  return (
                    <section className={`hx-room-editor${openRoom === i ? ' is-open' : ''}`} key={room.id || i}>
                      <RoomHeader room={room} index={i} open={openRoom === i} onToggle={() => setOpenRoom(openRoom === i ? -1 : i)}>
                        <button type="button" className="hx-icon-btn" aria-label={t('نسخ كخيار جديد', 'Duplicate as variant')} title={t('نسخ كخيار جديد', 'Duplicate as variant')} onClick={() => duplicateRoom(i)}><Copy /></button>
                        <button type="button" className="hx-icon-btn" aria-label={t('حذف الغرفة', 'Remove room')} onClick={() => set({ rooms: rooms.filter((_, x) => x !== i) })}><Trash2 /></button>
                      </RoomHeader>
                      {openRoom === i && <div className="hx-room-content">
                        <div className="editor-grid">
                          <Field label={t('اسم الغرفة بالعربية', 'Room Name (Arabic)')} req><TextIn value={room.name} onChange={v => setRoom(i, { name: v })} placeholder={t('مثال: ديلوكس — إطلالة بحر', 'e.g. Deluxe — Sea View')} /></Field>
                          <Field label={t('اسم الغرفة بالإنجليزية', 'Room Name (English)')}><TextIn dir="ltr" value={room.nameEn} onChange={v => setRoom(i, { nameEn: v })} /></Field>
                          <Field label={t('فئة الغرفة', 'Room Category')}><SelectIn value={room.category} onChange={v => setRoom(i, { category: v })} options={C.ROOM_CATEGORIES} /></Field>
                          <Field label={t('عدد الغرف في المخزون (إن كان معروفًا)', 'Room Inventory (if known)')} hint={t('مشترك بين كل خطط الأسعار لهذه الغرفة.', 'Shared by every rate plan of this room.')}><NumIn min="0" value={room.inventory} onChange={v => setRoom(i, { inventory: v })} /></Field>
                          <div className="editor-field wide-field"><span className="hx-label">{t('إطلالة الغرفة', 'Room View')}</span>
                            <ChoiceChips options={C.VIEW_TYPES} icons={VIEW_ICONS} value={room.viewType} onChange={v => setRoom(i, { viewType: v })} label={t('إطلالة الغرفة', 'Room View')} />
                            {room.view && <small className="field-hint">{t('ملاحظة الإطلالة السابقة: ', 'Previous view note: ')}{room.view}</small>}
                          </div>
                        </div>
                        <div className="hx-subsection">
                          <h3><BedDouble />{t('ترتيب الأسرّة', 'Bed Configuration')}</h3>
                          {(room.beds || []).map((bed, j) => {
                            const BI = BED_ICONS[bed.type] || BedDouble;
                            return (
                              <div className="hx-inline-row" key={j}>
                                <BI className="hx-row-icon" />
                                <SelectIn aria-label={t('نوع السرير', 'Bed type')} value={bed.type} onChange={v => setRoomRow(i, 'beds', j, { type: v })} options={C.BED_TYPES} />
                                <NumIn aria-label={t('العدد', 'Quantity')} min="1" max="10" value={bed.quantity} onChange={v => setRoomRow(i, 'beds', j, { quantity: v })} />
                                <button type="button" className="hx-icon-btn" aria-label={t('حذف السرير', 'Remove bed')} onClick={() => removeRoomRow(i, 'beds', j)}><Trash2 /></button>
                              </div>
                            );
                          })}
                          <div className="hx-row-actions">
                            <button type="button" className="button secondary" onClick={() => addRoomRow(i, 'beds', { type: '', quantity: 1 })}><Plus />{t('إضافة سرير', 'Add Bed')}</button>
                            <Toggle checked={room.bedGuaranteed} onChange={v => setRoom(i, { bedGuaranteed: v })} label={t('ترتيب الأسرّة مضمون', 'Bed setup guaranteed')} hint={t('عند الإيقاف يظهر كطلب حسب التوفر.', 'When off it shows as a request.')} />
                          </div>
                          {room.bedType && <small className="field-hint">{t('نوع الأسرّة السابق: ', 'Previous bed type: ')}{room.bedType}</small>}
                        </div>
                        <div className="hx-subsection">
                          <h3><Users />{t('السعة والإشغال', 'Capacity & Occupancy')}</h3>
                          <div className="editor-grid hx-grid-3">
                            <Field label={t('الإشغال القياسي (بالغين)', 'Standard Adults')}><NumIn min="1" value={room.standardAdults} onChange={v => setRoom(i, { standardAdults: v })} /></Field>
                            <Field label={t('أقصى عدد بالغين', 'Max Adults')}><NumIn min="1" value={room.maxAdults} onChange={v => setRoom(i, { maxAdults: v })} /></Field>
                            <Field label={t('أقصى عدد أطفال', 'Max Children')}><NumIn min="0" value={room.maxChildren} onChange={v => setRoom(i, { maxChildren: v })} /></Field>
                            <Field label={t('أقصى عدد نزلاء', 'Max Total Guests')} req><NumIn min="1" max="12" value={room.capacity} onChange={v => setRoom(i, { capacity: v })} /></Field>
                            <Field label={t('النزلاء المشمولون بالسعر', 'Included Guests')}><NumIn min="1" value={room.includedGuests} onChange={v => setRoom(i, { includedGuests: v })} /></Field>
                            <Field label={t('المساحة (م²)', 'Area (m²)')}><NumIn min="1" max="1000" value={room.size} onChange={v => setRoom(i, { size: v })} /></Field>
                          </div>
                          <div className="hx-toggle-grid">
                            <Toggle checked={room.extraAdultAllowed} onChange={v => setRoom(i, { extraAdultAllowed: v })} label={t('يسمح ببالغ إضافي', 'Extra adult allowed')} />
                            <Toggle checked={room.extraChildAllowed} onChange={v => setRoom(i, { extraChildAllowed: v })} label={t('يسمح بطفل إضافي', 'Extra child allowed')} />
                            <Toggle checked={room.extraBedAvailable} onChange={v => setRoom(i, { extraBedAvailable: v })} label={t('سرير إضافي متاح', 'Extra bed available')} />
                            <Toggle checked={room.babyCotAvailable} onChange={v => setRoom(i, { babyCotAvailable: v })} label={t('سرير أطفال متاح', 'Baby cot available')} />
                            <Toggle checked={room.privateBathroom} onChange={v => setRoom(i, { privateBathroom: v })} label={t('حمام خاص', 'Private bathroom')} />
                            <Toggle checked={room.smokingAllowed} onChange={v => setRoom(i, { smokingAllowed: v })} label={t('التدخين مسموح', 'Smoking allowed')} />
                          </div>
                          {occ && <p className="hx-warn" role="alert"><TriangleAlert />{occ}</p>}
                        </div>
                        <div className="hx-subsection">
                          <h3><Sparkles />{t('مرافق الغرفة', 'Room Amenities')}</h3>
                          <p className="field-hint">{t('لا تُورث مرافق الفندق تلقائيًا إلى الغرفة.', 'Hotel facilities are not inherited automatically.')}</p>
                          <AmenityPicker categories={C.ROOM_AMENITY_CATEGORIES} icons={ROOM_AMENITY_ICONS} selected={new Set(room.amenityCodes || [])}
                            onToggle={item => { const s = new Set(room.amenityCodes || []); s.has(item.code) ? s.delete(item.code) : s.add(item.code); setRoom(i, { amenityCodes: [...s] }); }} />
                          {room.amenities && <Field label={t('ملاحظات المرافق السابقة', 'Previous amenity notes')} wide><AreaIn value={room.amenities} onChange={v => setRoom(i, { amenities: v })} /></Field>}
                        </div>
                        <div className="editor-grid">
                          <Field label={t('وصف الغرفة بالعربية', 'Room Description (Arabic)')} wide><AreaIn value={room.description} onChange={v => setRoom(i, { description: v })} /></Field>
                          <Field label={t('وصف الغرفة بالإنجليزية', 'Room Description (English)')} wide><AreaIn dir="ltr" value={room.descriptionEn} onChange={v => setRoom(i, { descriptionEn: v })} /></Field>
                          <Field label={t('سياسة إلغاء الغرفة', 'Room Cancellation Policy')} wide><AreaIn value={room.cancellationPolicy} onChange={v => setRoom(i, { cancellationPolicy: v })} /></Field>
                        </div>
                        <div className="hx-subsection">
                          <h3><Images />{t('صور الغرفة', 'Room Photos')}</h3>
                          <PhotoDropzone label={t('صورة الغلاف وصور الغرفة', 'Cover & room photos')} value={room.photos || []} onChange={photos => setRoom(i, { photos })} />
                          <GalleryGroups groups={room.gallery || []} categories={C.ROOM_GALLERY_CATEGORIES} onChange={gallery => setRoom(i, { gallery })} />
                        </div>
                      </div>}
                    </section>
                  );
                })}
              </div>
            </>}

            {tab === 'rates' && <>
              <SectionTitle icon={BadgePercent} title={t('خطط الأسعار وأنظمة الوجبات', 'Rate Plans & Meal Plans')} text={t('لكل غرفة عدة خطط بأسعار مستقلة دون تكرار الغرفة. السعر هو سعر البيع للعميل؛ تكلفة المورد اختيارية.', 'Each room can have several independently priced plans without duplicating the room. Price = customer selling price; supplier cost is optional.')} />
              {!rooms.length && <p className="hx-empty"><BedDouble />{t('أضف غرفة أولًا من قسم الغرف.', 'Add a room first.')}</p>}
              {rooms.map((room, i) => (
                <div className="hx-subsection" key={room.id || i}>
                  <h3><BedDouble />{room.name || t(`غرفة ${i + 1}`, `Room ${i + 1}`)}</h3>
                  <div className="hx-stack">
                    {(room.ratePlans || []).map((plan, j) => {
                      const up = patch => setRoomRow(i, 'ratePlans', j, patch);
                      const MealIcon = MEAL_ICONS[plan.mealPlan] || Utensils;
                      const meal = C.MEAL_PLANS.find(m => m.code === plan.mealPlan);
                      return (
                        <fieldset className="hx-card hx-plan" key={plan.id}>
                          <div className="hx-card-head">
                            <h4><MealIcon />{plan.mealPlan} · {L(meal)} {plan.legacy && <span className="hx-badge">{t('منقولة من البيانات السابقة', 'Migrated')}</span>}</h4>
                            <button type="button" className="hx-icon-btn" aria-label={t('حذف خطة السعر', 'Remove rate plan')} onClick={() => removeRoomRow(i, 'ratePlans', j)}><Trash2 /></button>
                          </div>
                          <ChoiceChips options={C.MEAL_PLANS} icons={MEAL_ICONS} value={plan.mealPlan} onChange={v => up({ mealPlan: v || 'RO' })} label={t('نظام الوجبات', 'Meal Plan')} />
                          {meal && <p className="field-hint">{L({ ar: meal.descAr, en: meal.descEn })}</p>}
                          <div className="editor-grid hx-grid-3">
                            {plan.mealPlan === 'HB' && <Field label={t('الوجبة الثانية', 'Second Meal')}><SelectIn value={plan.secondMeal} onChange={v => up({ secondMeal: v })} options={C.SECOND_MEALS} /></Field>}
                            <Field label={t('نوع السعر', 'Rate Type')}><SelectIn value={plan.rateType} onChange={v => up({ rateType: v || 'standard' })} options={C.RATE_TYPES} /></Field>
                            <Field label={t('العملة', 'Currency')}><select value={plan.currency} onChange={e => up({ currency: e.target.value })}><option value="IQD">IQD · {t('دينار عراقي', 'Iraqi Dinar')}</option><option value="USD">USD · {t('دولار أمريكي', 'US Dollar')}</option></select></Field>
                            <Field label={t('أساس التسعير', 'Pricing Basis')}><SelectIn value={plan.priceBasis} onChange={v => up({ priceBasis: v || 'per_room_night' })} options={C.PRICE_BASES} /></Field>
                            <Field label={t('سعر البيع', 'Selling Price')} req><NumIn min="0" value={plan.nightlyPrice} onChange={v => up({ nightlyPrice: v })} /></Field>
                            <Field label={t('تكلفة المورد (اختياري)', 'Supplier Cost (optional)')}><NumIn min="0" value={plan.supplierCost} onChange={v => up({ supplierCost: v })} /></Field>
                            <Field label={t('النزلاء المشمولون', 'Included Occupancy')}><NumIn min="1" value={plan.includedGuests} onChange={v => up({ includedGuests: v })} /></Field>
                            <Field label={t('رسوم البالغ الإضافي / ليلة', 'Extra Adult / night')}><NumIn min="0" value={plan.extraAdultCharge} onChange={v => up({ extraAdultCharge: v })} /></Field>
                            <Field label={t('رسوم الطفل / ليلة', 'Child Charge / night')} hint={t('فارغ = غير محدد، وليس مجانيًا.', 'Empty = not set, not free.')}><NumIn min="0" value={plan.childCharge} onChange={v => up({ childCharge: v })} /></Field>
                            <Field label={t('رسوم السرير الإضافي', 'Extra Bed Charge')}><NumIn min="0" value={plan.extraBedCharge} onChange={v => up({ extraBedCharge: v })} /></Field>
                            <Field label={t('صالح من', 'Valid From')}><DateIn value={plan.validFrom} onChange={v => up({ validFrom: v })} /></Field>
                            <Field label={t('صالح حتى', 'Valid To')}><DateIn value={plan.validTo} onChange={v => up({ validTo: v })} /></Field>
                            <Field label={t('الحد الأدنى للإقامة (ليالٍ)', 'Minimum Stay (nights)')}><NumIn min="1" value={plan.minStay} onChange={v => up({ minStay: v })} /></Field>
                            <Field label={t('قابلية الاسترداد', 'Refundability')}><SelectIn value={plan.refundability} onChange={v => up({ refundability: v || 'unknown' })} options={C.REFUNDABILITY} /></Field>
                            <Field label={t('الضرائب والرسوم', 'Taxes & Fees')} hint={t('لا تُضاف نسب تلقائية.', 'No automatic percentages.')}><TextIn value={plan.taxesInfo} onChange={v => up({ taxesInfo: v })} /></Field>
                          </div>
                          <Toggle checked={plan.status !== 'inactive'} onChange={v => up({ status: v ? 'active' : 'inactive' })} label={t('خطة فعالة', 'Active plan')} hint={t('الخطط غير الفعالة لا تدخل في سعر البداية.', 'Inactive plans are excluded from starting rates.')} />
                          <details className="hx-more">
                            <summary><Utensils />{t('تفاصيل الوجبات والإلغاء', 'Meal & cancellation details')}<ChevronDown className="hx-caret" /></summary>
                            <div className="editor-grid">
                              <Field label={t('الوجبات المشمولة', 'Included Meals')}><AreaIn value={plan.includedMeals} onChange={v => up({ includedMeals: v })} /></Field>
                              <Field label={t('المشروبات المشمولة', 'Included Drinks')}><TextIn value={plan.includedDrinks} onChange={v => up({ includedDrinks: v })} /></Field>
                              <Field label={t('الوجبات الخفيفة', 'Included Snacks')}><TextIn value={plan.includedSnacks} onChange={v => up({ includedSnacks: v })} /></Field>
                              <Field label={t('المطاعم المشمولة', 'Included Restaurants')}><TextIn value={plan.includedRestaurants} onChange={v => up({ includedRestaurants: v })} /></Field>
                              <Field label={t('ساعات الخدمة', 'Service Hours')}><TextIn value={plan.serviceHours} onChange={v => up({ serviceHours: v })} /></Field>
                              <Field label={t('مزايا إضافية', 'Additional Benefits')}><AreaIn value={plan.benefits} onChange={v => up({ benefits: v })} /></Field>
                              <Field label={t('الاستثناءات', 'Exclusions')}><AreaIn value={plan.exclusions} onChange={v => up({ exclusions: v })} /></Field>
                              <Field label={t('سياسة وجبات الأطفال', 'Child Meal Policy')}><AreaIn value={plan.childMealPolicy} onChange={v => up({ childMealPolicy: v })} /></Field>
                              <Field label={t('سياسة الإلغاء', 'Cancellation Policy')} wide><AreaIn value={plan.cancellationPolicy} onChange={v => up({ cancellationPolicy: v })} /></Field>
                              <Field label={t('ملاحظات', 'Notes')} wide><AreaIn value={plan.notes} onChange={v => up({ notes: v })} /></Field>
                            </div>
                          </details>
                        </fieldset>
                      );
                    })}
                    <button type="button" className="button secondary" onClick={() => addRoomRow(i, 'ratePlans', emptyPlan())}><Plus />{t('إضافة خطة سعر', 'Add Rate Plan')}</button>
                  </div>
                </div>
              ))}
            </>}

            {tab === 'availability' && <>
              <SectionTitle icon={CalendarRange} title={t('التوافر والمواسم', 'Availability & Seasons')} text={t('التوافر مسجل على الغرفة ومشترك بين خطط الوجبات. الأيام غير المُدخلة تعتبر غير معروفة وليست متاحة. التواريخ شاملة بتوقيت بغداد.', 'Availability is per room and shared across meal plans. Missing dates are unknown, not available. Dates are inclusive, Baghdad time.')} />
              {rooms.map((room, i) => {
                const se = seasonError(room);
                return (
                  <div className="hx-subsection" key={room.id || i}>
                    <h3><BedDouble />{room.name || t(`غرفة ${i + 1}`, `Room ${i + 1}`)} {room.inventory != null && <span className="hx-badge">{t(`المخزون: ${room.inventory}`, `Inventory: ${room.inventory}`)}</span>}</h3>
                    <h4 className="hx-mini-title"><Layers />{t('فترات التوافر', 'Availability Periods')}</h4>
                    {(room.availability || []).map((p, j) => (
                      <div className="hx-inline-row hx-period" key={j}>
                        <Field label={t('من', 'From')}><DateIn value={p.startDate} onChange={v => setRoomRow(i, 'availability', j, { startDate: v })} /></Field>
                        <Field label={t('إلى (شامل)', 'To (inclusive)')}><DateIn value={p.endDate} onChange={v => setRoomRow(i, 'availability', j, { endDate: v })} /></Field>
                        <Field label={t('إجمالي الغرف', 'Total Rooms')}><NumIn min="0" value={p.totalRooms} onChange={v => setRoomRow(i, 'availability', j, { totalRooms: v })} /></Field>
                        <Field label={t('الغرف المتاحة', 'Available')}><NumIn min="0" value={p.availableRooms} onChange={v => setRoomRow(i, 'availability', j, { availableRooms: v })} /></Field>
                        {p.nightlyPrice != null && <Field label={t('سعر الفترة السابق', 'Previous period price')}><NumIn min="0" value={p.nightlyPrice} onChange={v => setRoomRow(i, 'availability', j, { nightlyPrice: v })} /></Field>}
                        <Toggle checked={p.closed} onChange={v => setRoomRow(i, 'availability', j, { closed: v })} label={t('مغلق للحجز', 'Closed')} />
                        <button type="button" className="hx-icon-btn" aria-label={t('حذف الفترة', 'Remove period')} onClick={() => removeRoomRow(i, 'availability', j)}><Trash2 /></button>
                      </div>
                    ))}
                    <button type="button" className="button secondary" onClick={() => addRoomRow(i, 'availability', { startDate: '', endDate: '', totalRooms: room.inventory ?? null, availableRooms: null, closed: false, nightlyPrice: null })}><Plus />{t('إضافة فترة توافر', 'Add Availability Period')}</button>
                    <h4 className="hx-mini-title"><Tag />{t('الأسعار الموسمية', 'Seasonal Prices')}</h4>
                    {(room.seasons || []).map((s, j) => (
                      <div className="hx-inline-row hx-period" key={j}>
                        <Field label={t('اسم الموسم', 'Season')}><TextIn list="hx-season-names" value={s.name} onChange={v => setRoomRow(i, 'seasons', j, { name: v })} /></Field>
                        <Field label={t('خطة السعر', 'Rate Plan')}><SelectIn value={s.ratePlanId} onChange={v => setRoomRow(i, 'seasons', j, { ratePlanId: v })} options={(room.ratePlans || []).map(p => ({ code: p.id, ar: `${p.mealPlan} · ${optionLabelAr(p)}`, en: `${p.mealPlan} · ${p.currency}` }))} /></Field>
                        <Field label={t('من', 'From')}><DateIn value={s.startDate} onChange={v => setRoomRow(i, 'seasons', j, { startDate: v })} /></Field>
                        <Field label={t('إلى (شامل)', 'To (inclusive)')}><DateIn value={s.endDate} onChange={v => setRoomRow(i, 'seasons', j, { endDate: v })} /></Field>
                        <Field label={t('سعر الليلة', 'Nightly Price')}><NumIn min="0" value={s.nightlyPrice} onChange={v => setRoomRow(i, 'seasons', j, { nightlyPrice: v })} /></Field>
                        <Field label={t('أدنى إقامة', 'Min Stay')}><NumIn min="1" value={s.minStay} onChange={v => setRoomRow(i, 'seasons', j, { minStay: v })} /></Field>
                        <button type="button" className="hx-icon-btn" aria-label={t('حذف الموسم', 'Remove season')} onClick={() => removeRoomRow(i, 'seasons', j)}><Trash2 /></button>
                      </div>
                    ))}
                    {se && <p className="hx-warn" role="alert"><TriangleAlert />{se}</p>}
                    <button type="button" className="button secondary" disabled={!(room.ratePlans || []).length} onClick={() => addRoomRow(i, 'seasons', { name: '', ratePlanId: room.ratePlans?.[0]?.id || '', startDate: '', endDate: '', nightlyPrice: null, minStay: null })}><Plus />{t('إضافة سعر موسمي', 'Add Seasonal Price')}</button>
                  </div>
                );
              })}
              <datalist id="hx-season-names">{SEASON_NAMES.map(([ar, en]) => <option key={ar} value={lang === 'en' ? en : ar} />)}</datalist>
              <p className="field-hint">{t('منع الحجز المزدوج بين عدة مستخدمين يحتاج نظامًا مركزيًا لاحقًا؛ التوافر هنا مرجعي.', 'Cross-user overbooking prevention needs a central system later; availability here is a reference.')}</p>
            </>}

            {tab === 'gallery' && <>
              <SectionTitle icon={Images} title={t('صور الفندق', 'Hotel Gallery')} text={t('الصورة الأولى هي الغلاف. تُحفظ الصور في هذا المتصفح فقط حتى يتوفر تخزين دائم.', 'The first photo is the cover. Photos are stored in this browser only until permanent storage exists.')} />
              <PhotoDropzone label={t('صورة الغلاف والصور العامة', 'Cover & general photos')} value={record.photos || []} onChange={photos => set({ photos })} />
              <GalleryGroups groups={record.gallery || []} categories={C.HOTEL_GALLERY_CATEGORIES} onChange={gallery => set({ gallery })} />
            </>}

            {tab === 'review' && <>
              <SectionTitle icon={ClipboardCheck} title={t('المراجعة والنشر', 'Review & Publish')} text={t('هكذا ستظهر بيانات الفندق للفريق.', 'This is how the hotel appears to the team.')} />
              {checklist.length ? <div className="hx-checklist is-missing"><TriangleAlert /><div><strong>{t('مطلوب قبل النشر', 'Required before publishing')}</strong><ul>{checklist.map(item => <li key={item}>{item}</li>)}</ul></div></div>
                : <div className="hx-checklist"><CircleCheck /><strong>{t('البيانات المطلوبة مكتملة ويمكن النشر.', 'Required data is complete; ready to publish.')}</strong></div>}
              <HotelDetailView hotel={{ ...record, status }} />
              <div className="hx-row-actions"><button type="button" className="button primary" disabled={saving} onClick={() => save('published')}><CircleCheck />{t('حفظ ونشر', 'Save & Publish')}</button></div>
            </>}

            <div className="hx-step-nav">
              <button type="button" className="button secondary" disabled={tabIndex === 0} onClick={() => setTab(TABS[tabIndex - 1][0])}>{lang === 'en' ? <ArrowLeft /> : <ArrowRight />}{t('السابق', 'Previous')}</button>
              <button type="button" className="button secondary" disabled={tabIndex === TABS.length - 1} onClick={() => setTab(TABS[tabIndex + 1][0])}>{t('التالي', 'Next')}{lang === 'en' ? <ArrowRight /> : <ArrowLeft />}</button>
            </div>
          </section>
        </div>

        <aside className="editor-aside">
          <section className="hotel-price-summary hx-summary">
            <span>{t('الليلة تبدأ من', 'From per night')}</span>
            <strong>{rates.IQD != null ? money(rates.IQD, 'IQD', lang) : '—'}</strong>
            {rates.USD != null && <strong className="hx-usd">{money(rates.USD, 'USD', lang)}</strong>}
            <ul>
              <li><BedDouble />{t(`${new Set(rooms.map(r => r.category || r.name)).size} أنواع غرف`, `${new Set(rooms.map(r => r.category || r.name)).size} room types`)}</li>
              <li><Layers />{t(`${rooms.length} خيارات قابلة للبيع`, `${rooms.length} sellable variants`)}</li>
              <li><Utensils />{[...new Set(rooms.flatMap(r => (r.ratePlans || []).map(p => p.mealPlan)))].join(' · ') || '—'}</li>
              <li><ConciergeBell />{t(`${(record.facilities || []).length} مرافق`, `${(record.facilities || []).length} facilities`)}</li>
              {record.city && <li><MapPin />{record.city}</li>}
              {record.checkIn && <li><Clock />{record.checkIn} – {record.checkOut}</li>}
            </ul>
          </section>
          <section className="panel publishing-panel">
            <h2>{t('حالة العرض', 'Publication')}</h2>
            <SelectIn aria-label={t('الحالة', 'Status')} value={status} onChange={v => setStatus(v || 'draft')} options={C.HOTEL_STATUSES} />
            <p>{checklist.length ? t(`${checklist.length} عناصر ناقصة قبل النشر.`, `${checklist.length} items missing before publishing.`) : t('جاهز للنشر.', 'Ready to publish.')}</p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function optionLabelAr(plan) { return C.MEAL_PLANS.find(m => m.code === plan.mealPlan)?.ar || ''; }
