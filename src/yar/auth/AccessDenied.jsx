import React from 'react';

export default function AccessDenied({ onHome }) {
  return (
    <section className="access-denied" role="alert" aria-labelledby="denied-title">
      <div className="access-denied-mark" aria-hidden="true">!</div>
      <h1 id="denied-title" tabIndex={-1}>لا تملك صلاحية فتح هذه الصفحة</h1>
      <p>هذه الصفحة متاحة لمدير النظام فقط. تواصل مع المدير إذا كنت تحتاج الوصول.</p>
      <button type="button" className="button primary" onClick={onHome}>العودة إلى نظرة عامة</button>
    </section>
  );
}
