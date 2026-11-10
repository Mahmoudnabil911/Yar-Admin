import React, { useState } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { exportDemoData, planImport, applyImport } from '../../services/storage/dataTransfer';
import { assertCan } from '../../auth/access';

export default function DataTransferModal({ isOpen, onClose }) {
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [replace, setReplace] = useState(false);
  const [done, setDone] = useState('');

  const download = () => {
    assertCan('data.transfer');
    const blob = new Blob([JSON.stringify(exportDemoData(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `yar-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDone('صُدّرت البيانات إلى ملف JSON.');
  };

  const onFile = async e => {
    setError(''); setPlan(null); setDone('');
    const file = e.target.files?.[0];
    if (!file) return;
    try { setPlan(planImport(JSON.parse(await file.text()))); }
    catch (err) { setError(err.message || 'ملف غير صالح.'); }
  };

  const doImport = () => {
    try {
      const n = applyImport(plan, { replace });
      setDone(`استُوردت ${n} مجموعات بيانات. ستُعاد تهيئة الصفحة.`);
      setTimeout(() => window.location.reload(), 900);
    } catch (err) { setError(err.message); }
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} eyebrow="البيانات" title="تصدير / استيراد البيانات">
      <section className="ops-section">
        <h3>تصدير</h3>
        <p className="ops-note">ينزّل كل البيانات المحفوظة في هذا المتصفح (الحجوزات، الأرصدة، الموظفون، المحتوى…).</p>
        <button type="button" className="button primary" onClick={download}>تنزيل ملف JSON</button>
      </section>
      <section className="ops-section">
        <h3>استيراد</h3>
        <p className="ops-note">يتحقق من صيغة الملف. المجموعات المطابقة تُتخطّى كتكرار، ولا تُستبدل البيانات المختلفة إلا بموافقتك مع حفظ نسخة احتياطية.</p>
        <input type="file" accept="application/json,.json" onChange={onFile} aria-label="ملف JSON" />
        {plan && (
          <div className="import-plan">
            <ul>
              {plan.items.map(i => (
                <li key={i.key}><bdi>{i.key}</bdi> · {{ new: 'جديد', same: 'مطابق (يُتخطّى)', conflict: 'مختلف عن الحالي' }[i.state]}</li>
              ))}
            </ul>
            {plan.items.some(i => i.state === 'conflict') && (
              <label className="ops-field wide inline-check">
                <input type="checkbox" checked={replace} onChange={e => setReplace(e.target.checked)} />
                <span>استبدال المجموعات المختلفة (تُحفظ نسخة احتياطية من الحالية).</span>
              </label>
            )}
            <button type="button" className="button primary" onClick={doImport}>تطبيق الاستيراد</button>
          </div>
        )}
        {error && <div className="ops-form-error" role="alert">{error}</div>}
        {done && <p className="ops-note" role="status">{done}</p>}
      </section>
    </Drawer>
  );
}
