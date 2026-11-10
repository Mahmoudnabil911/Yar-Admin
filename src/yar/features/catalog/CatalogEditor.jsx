import React, { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { catalogTypes } from '../../services/models';
import {
  catalogStorage,
  statusLabels,
  safePhotos,
  sanitize
} from '../../services/storage/catalogStorage';
import { useToast } from '../../components/ui/Toast';
import PhotoDropzone,{imageSource} from './PhotoDropzone';
import {minimumRoomPrice} from '../../services/hotelPricing';
import {catalogFormData,addPhotoFiles} from '../../services/catalogForm';

export function CatalogEditor({ catalogKey, recordId, onBack }) {
  const toast = useToast();
  const config = catalogTypes[catalogKey];
  const allProviders = catalogStorage.getRecords('providers');

  const existingRecord = useMemo(() => {
    if (!recordId || recordId === 'new') return null;
    const records = catalogStorage.getRecords(catalogKey);
    return records.find(r => r.id === recordId) || null;
  }, [catalogKey, recordId]);

  const [record, setRecord] = useState(() => {
    if (existingRecord) return JSON.parse(JSON.stringify(existingRecord));
    return catalogStorage.blankRecord(catalogKey);
  });

  const [status, setStatus] = useState(() => existingRecord?.status || 'draft');
  const [errorMsg, setErrorMsg] = useState('');

  const isExisting = Boolean(existingRecord?.id);

  // Field change helpers
  const handleFieldChange = (key, value) => {
    setRecord(prev => ({ ...prev, [key]: value }));
  };

  const handleRepeatAdd = (fieldKey, subFields, maxItems = 20) => {
    const currentList = Array.isArray(record[fieldKey]) ? record[fieldKey] : [];
    if (currentList.length >= maxItems) return;
    const blankRow = sanitize({}, subFields);
    setRecord(prev => ({
      ...prev,
      [fieldKey]: [...currentList, blankRow]
    }));
  };

  const handleRepeatRemove = (fieldKey, index) => {
    const currentList = Array.isArray(record[fieldKey]) ? record[fieldKey] : [];
    const nextList = currentList.filter((_, i) => i !== index);
    setRecord(prev => ({
      ...prev,
      [fieldKey]: nextList
    }));
  };

  const handleRepeatFieldChange = (fieldKey, index, subKey, value) => {
    const currentList = Array.isArray(record[fieldKey]) ? [...record[fieldKey]] : [];
    currentList[index] = { ...currentList[index], [subKey]: value };
    setRecord(prev => ({
      ...prev,
      [fieldKey]: currentList
    }));
  };

  // Nested repeat (e.g. room.availability inside room)
  const handleNestedRepeatAdd = (parentKey, parentIdx, childKey, subFields, maxItems = 20) => {
    const currentList = Array.isArray(record[parentKey]) ? [...record[parentKey]] : [];
    const parentRow = currentList[parentIdx] || {};
    const childList = Array.isArray(parentRow[childKey]) ? parentRow[childKey] : [];
    if (childList.length >= maxItems) return;
    const blankChild = sanitize({}, subFields);
    parentRow[childKey] = [...childList, blankChild];
    currentList[parentIdx] = parentRow;
    setRecord(prev => ({ ...prev, [parentKey]: currentList }));
  };

  const handleNestedRepeatRemove = (parentKey, parentIdx, childKey, childIdx) => {
    const currentList = Array.isArray(record[parentKey]) ? [...record[parentKey]] : [];
    const parentRow = currentList[parentIdx] || {};
    const childList = Array.isArray(parentRow[childKey]) ? parentRow[childKey] : [];
    parentRow[childKey] = childList.filter((_, i) => i !== childIdx);
    currentList[parentIdx] = parentRow;
    setRecord(prev => ({ ...prev, [parentKey]: currentList }));
  };

  const handleNestedRepeatFieldChange = (parentKey, parentIdx, childKey, childIdx, subKey, value) => {
    const currentList = Array.isArray(record[parentKey]) ? [...record[parentKey]] : [];
    const parentRow = currentList[parentIdx] || {};
    const childList = Array.isArray(parentRow[childKey]) ? [...parentRow[childKey]] : [];
    childList[childIdx] = { ...childList[childIdx], [subKey]: value };
    parentRow[childKey] = childList;
    currentList[parentIdx] = parentRow;
    setRecord(prev => ({ ...prev, [parentKey]: currentList }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const candidate = {
        ...record,
        status,
        updatedAt: new Date().toISOString()
      };
      const form = await addPhotoFiles(catalogFormData(candidate),candidate);
      // The local adapter receives the multipart form contract; no network upload yet.
      const saved = await catalogStorage.saveForm(catalogKey, candidate, form);
      toast(`تم حفظ ${saved.name} في المعاينة المحلية.`);
      onBack();
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  const renderField = (field, value, onChange) => {
    const id = `field-${field.key}`;

    if (field.type === 'checkbox') {
      return (
        <label className="editor-checkbox" htmlFor={id} key={field.key}>
          <input
            type="checkbox"
            id={id}
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
          />
          <span>{field.label}</span>
        </label>
      );
    }

    if (field.type === 'select') {
      const opts = typeof field.options === 'function'
        ? field.options({ providers: allProviders })
        : (field.options || []);

      return (
        <div className="editor-field" key={field.key}>
          <label htmlFor={id}>
            {field.label}
            {field.required && <span className="required-mark">*</span>}
          </label>
          <select
            id={id}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            required={field.required}
          >
            <option value="">اختر...</option>
            {opts.map(opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const lbl = typeof opt === 'string' ? opt : opt.label;
              return <option key={val} value={val}>{lbl}</option>;
            })}
          </select>
          {field.help && <small className="field-hint">{field.help}</small>}
        </div>
      );
    }

    if (field.type === 'photos') {
      return <PhotoDropzone key={field.key} label={field.label} value={safePhotos(value)} onChange={onChange}/>;
    }

    if (field.type === 'textarea') {
      return (
        <div className="editor-field wide-field" key={field.key}>
          <label htmlFor={id}>
            {field.label}
            {field.required && <span className="required-mark">*</span>}
          </label>
          <textarea
            id={id}
            placeholder={field.placeholder || ''}
            value={value ?? ''}
            onChange={e => onChange(e.target.value)}
            required={field.required}
          />
          {field.help && <small className="field-hint">{field.help}</small>}
        </div>
      );
    }

    return (
      <div className="editor-field" key={field.key}>
        <label htmlFor={id}>
          {field.label}
          {field.required && <span className="required-mark">*</span>}
        </label>
        <input
          id={id}
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value ?? ''}
          placeholder={field.placeholder || ''}
          min={field.min}
          max={field.max}
          step={field.step}
          onChange={e => {
            const v = field.type === 'number'
              ? (e.target.value === '' ? null : Number(e.target.value))
              : e.target.value;
            onChange(v);
          }}
          required={field.required}
        />
        {field.help && <small className="field-hint">{field.help}</small>}
      </div>
    );
  };

  const helpText = useMemo(() => {
    switch (catalogKey) {
      case 'hotels':
        return 'أضف صور الفندق، ثم عرّف أنواع الغرف وسعتها وسعرها والفطور لكل نوع.';
      case 'packages':
        return 'حدّد عدد أيام البرنامج ومدنه وخيارات الفنادق، مع توضيح الأسعار والخدمات المشمولة.';
      case 'tours':
        return 'أضف مسار الجولة وصورها ومدتها وسعر المجموعة والخدمات المشمولة.';
      case 'cars':
        return 'حدّد السعة والحقائب، ثم سعر الاستقبال والاستقبال والتوديع لكل مدينة.';
      default:
        return 'حدّد نوع الخدمة وطريقة توفيرها. مفاتيح الربط الحقيقية تُدار لاحقًا على السيرفر.';
    }
  }, [catalogKey]);

  return (
    <div id="catalog-view">
      <div className="page-heading catalog-heading editor-heading">
        <div>
          <button type="button" className="editor-back" onClick={onBack}>
            <i><Icon name="back" /></i>
            {config.title}
          </button>
          <h1 id="catalog-title" tabIndex={-1}>
            {isExisting ? `تعديل ${config.singular}` : config.addLabel}
          </h1>
          <p>بيانات تجريبية؛ الحفظ يحدّث قوائم الإدارة في هذا المتصفح.</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button secondary" onClick={onBack}>
            إلغاء
          </button>
          <button type="submit" form="catalog-form" className="button primary">
            <i><Icon name="check" /></i>
            حفظ التغييرات
          </button>
        </div>
      </div>

      <form id="catalog-form" className="catalog-editor" encType="multipart/form-data" onSubmit={handleSubmit}>
        <div className="editor-main">
          {errorMsg && (
            <div id="catalog-error" className="form-error" role="alert" tabIndex={-1}>
              {errorMsg}
            </div>
          )}

          <section className="panel editor-section">
            <div className="editor-section-heading">
              <span className="metric-icon">
                <i><Icon name={config.icon} /></i>
              </span>
              <div>
                <h2>بيانات {config.singular}</h2>
                <p>الحقول المشار إليها بـ * مطلوبة.</p>
              </div>
            </div>

            <div className="editor-grid">
              {config.fields.map(field => {
                if (field.type === 'repeat') {
                  const rows = Array.isArray(record[field.key]) ? record[field.key] : [];
                  const legendPrefix = catalogKey === 'hotels' ? 'نوع الغرفة' : catalogKey === 'packages' ? 'خيار الفندق' : 'الخيار';

                  return (
                    <section className="repeat-section wide-field" key={field.key}>
                      <div className="repeat-heading">
                        <div>
                          <h3>{field.label}</h3>
                          <p>أضف كل خيار بتفاصيله المستقلة.</p>
                        </div>
                        <span className="count-chip">{rows.length}</span>
                      </div>

                      <div className="repeat-rows">
                        {rows.map((row, rIdx) => (
                          <fieldset className="repeat-card" key={rIdx}>
                            <legend>{legendPrefix} {rIdx + 1}</legend>
                            <button
                              type="button"
                              className="repeat-remove"
                              aria-label={`إزالة الخيار ${rIdx + 1}`}
                              onClick={() => handleRepeatRemove(field.key, rIdx)}
                            >
                              <i><Icon name="trash" /></i>
                            </button>
                            <div className="editor-grid">
                              {field.fields.map(subField => {
                                // Nested repeat (e.g. availability periods inside rooms)
                                if (subField.type === 'repeat') {
                                  const nestedRows = Array.isArray(row[subField.key]) ? row[subField.key] : [];
                                  return (
                                    <section className="repeat-section wide-field" key={subField.key}>
                                      <div className="repeat-heading">
                                        <div>
                                          <h3>{subField.label}</h3>
                                        </div>
                                        <span className="count-chip">{nestedRows.length}</span>
                                      </div>
                                      <div className="repeat-rows">
                                        {nestedRows.map((nRow, nIdx) => (
                                          <fieldset className="repeat-card" key={nIdx}>
                                            <legend>فترة السعر والتوافر {nIdx + 1}</legend>
                                            <button
                                              type="button"
                                              className="repeat-remove"
                                              aria-label={`إزالة الفترة ${nIdx + 1}`}
                                              onClick={() => handleNestedRepeatRemove(field.key, rIdx, subField.key, nIdx)}
                                            >
                                              <i><Icon name="trash" /></i>
                                            </button>
                                            <div className="editor-grid">
                                              {subField.fields.map(nField =>
                                                renderField(
                                                  nField,
                                                  nRow[nField.key],
                                                  val => handleNestedRepeatFieldChange(field.key, rIdx, subField.key, nIdx, nField.key, val)
                                                )
                                              )}
                                            </div>
                                          </fieldset>
                                        ))}
                                      </div>
                                      <button
                                        type="button"
                                        className="button secondary repeat-add"
                                        onClick={() => handleNestedRepeatAdd(field.key, rIdx, subField.key, subField.fields, subField.maxItems)}
                                      >
                                        <i><Icon name="plus" /></i>
                                        {subField.addLabel || 'إضافة فترة توافر'}
                                      </button>
                                    </section>
                                  );
                                }

                                return renderField(
                                  subField,
                                  row[subField.key],
                                  val => handleRepeatFieldChange(field.key, rIdx, subField.key, val)
                                );
                              })}
                            </div>
                          </fieldset>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="button secondary repeat-add"
                        onClick={() => handleRepeatAdd(field.key, field.fields, field.maxItems)}
                        disabled={rows.length >= (field.maxItems || 20)}
                      >
                        <i><Icon name="plus" /></i>
                        {field.addLabel || 'إضافة خيار'}
                      </button>
                    </section>
                  );
                }

                return renderField(field, record[field.key], val => handleFieldChange(field.key, val));
              })}
            </div>
          </section>
        </div>

        <aside className="editor-aside">
          {catalogKey==='hotels'&&<section className="hotel-price-summary"><span>الليلة تبدأ من</span><strong>{minimumRoomPrice(record.rooms)?.toLocaleString('en-US')||'—'} <small>د.ع</small></strong>{(record.rooms||[]).map((room,i)=><article className="hotel-room-preview" key={i}>{room.photos?.[0]&&<img src={imageSource(room.photos[0])} alt={room.name||'الغرفة'}/>}<strong>{room.name||`نوع الغرفة ${i+1}`}</strong><small>{room.capacity||'—'} · {room.bedType||'—'}</small><span className="hotel-room-price">{Number(room.nightlyPrice||0).toLocaleString('en-US')} د.ع</span></article>)}</section>}
          <section className="panel publishing-panel">
            <h2>حالة العرض</h2>
            <label htmlFor="record-status">الحالة في المعاينة</label>
            <select
              id="record-status"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              {Object.entries(statusLabels).map(([k, lbl]) => (
                <option key={k} value={k}>{lbl}</option>
              ))}
            </select>
            <p>
              «منشور» يظهر كسجل جاهز داخل هذه المعاينة فقط. لا تُرسل التغييرات إلى تطبيق المسافرين.
            </p>
            <div className="editor-source">
              <span className="tiny-dot green"></span>
              حفظ محلي · بيانات تجريبية
            </div>
          </section>

          <section className="panel editor-help">
            <h3>تنظيم واضح لكل خدمة</h3>
            <p>{helpText}</p>
          </section>
        </aside>
      </form>
    </div>
  );
}

export default CatalogEditor;

