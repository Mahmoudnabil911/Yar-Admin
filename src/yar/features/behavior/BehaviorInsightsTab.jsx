import React, { useState, useMemo } from 'react';
import { behaviorData as D } from '../../services/models';
import { audienceStorage } from '../../services/storage/audienceStorage';
import { Icon } from '../../components/ui/Icon';
import { useToast } from '../../components/ui/Toast';

const serviceLabels = {
  all: 'كل الخدمات',
  flight: 'الطيران',
  hotel: 'الفنادق',
  package: 'الباقات',
  transfer: 'النقل',
  tour: 'الجولات',
};

const sections = [
  { key: 'destinations', label: 'الوجهات والبحث', symbol: 'map' },
  { key: 'items', label: 'الفنادق والباقات', symbol: 'hotel' },
  { key: 'zero', label: 'دون نتائج', symbol: 'search' },
  { key: 'abandonment', label: 'الحجوزات غير المكتملة', symbol: 'clock' },
  { key: 'travel', label: 'مواعيد السفر', symbol: 'calendar' },
  { key: 'campaigns', label: 'الحملات والعروض', symbol: 'tag' },
  { key: 'conversion', label: 'التحويل للحجز', symbol: 'chart' },
];

const size = 8;
const percent = value =>
  value == null || !Number.isFinite(value)
    ? '—'
    : `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value)}%`;
const decimal = value =>
  value == null || !Number.isFinite(value)
    ? '—'
    : new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
const count = value => new Intl.NumberFormat('en-US').format(Number.isFinite(Number(value)) ? Number(value) : 0);

const ncol = (key, label) => ({ key, label, format: 'count' });
const pcol = (key, label) => ({ key, label, format: 'percent' });
const tcol = (key, label) => ({ key, label });
const svc = () => ({ key: 'service', label: 'الخدمة', format: 'service' });
const money = (key, label) => ({ key, label, format: 'money' });

const searchColumns = [
  tcol('label', 'الوجهة'),
  ncol('searches', 'عمليات البحث'),
  ncol('users', 'باحثون مميزون'),
  ncol('confirmed', 'حجوزات مؤكدة'),
  pcol('conversion', 'تحويل جلسات البحث'),
];

const conversionColumns = [
  tcol('label', 'الوجهة'),
  ncol('searchSessions', 'جلسات بحث'),
  ncol('convertedSessions', 'جلسات انتهت بحجز مؤكد'),
  ncol('confirmed', 'حجوزات مؤكدة'),
  pcol('conversion', 'نسبة التحول'),
];

export default function BehaviorInsightsTab({ filters = {} }) {
  const { showToast } = useToast();
  const [service, setService] = useState('all');
  const [section, setSection] = useState('destinations');
  const [pages, setPages] = useState({});

  const report = useMemo(() => {
    try {
      const fixture = audienceStorage.getBehaviorFixture();
      return D.report(fixture, { ...filters, service });
    } catch {
      return null;
    }
  }, [filters, service]);

  const config = useMemo(() => {
    if (!report) return null;
    switch (section) {
      case 'destinations':
        return {
          title: 'أين يريد المسافرون الذهاب؟',
          note: 'عمليات البحث تشمل المحاولات المتكررة. الباحث المميز يُحسب مرة لكل مجموعة؛ الحساب المسجل أو معرّف المتصفح المجهول، دون دمج الجلسات السابقة تلقائيًا.',
          tables: [
            {
              key: 'destinations',
              title: 'أكثر الوجهات بحثًا',
              description: 'ترتيب حسب عدد عمليات البحث، مع الحجوزات المؤكدة المرتبطة بها.',
              rows: report.destinations,
              columns: searchColumns,
            },
            {
              key: 'routes',
              title: 'أكثر المسارات بحثًا',
              description: 'المغادرة والوصول اتجاهيان؛ بغداد إلى مشهد تختلف عن مشهد إلى بغداد.',
              rows: report.routes,
              columns: [{ ...searchColumns[0], label: 'المسار' }, ...searchColumns.slice(1)],
            },
          ],
        };
      case 'items':
        return {
          title: 'الفنادق والباقات التي تجذب الاهتمام',
          note: 'المشاهدة تعني فتح التفاصيل. الطلب المرسل منفصل عن الحجز المؤكد، وقد يشاهد المسافر أكثر من خيار في الجلسة الواحدة.',
          tables: [
            {
              key: 'items',
              title: 'الأكثر مشاهدةً وطلبًا',
              description: 'فنادق وباقات المثال، وفق الفترة والمنصة والخدمة المختارة.',
              rows: report.items,
              columns: [
                tcol('label', 'الفندق أو الباقة'),
                svc(),
                ncol('views', 'مشاهدات التفاصيل'),
                ncol('users', 'مشاهدون مميزون'),
                ncol('requests', 'طلبات مرسلة'),
                ncol('confirmed', 'حجوزات مؤكدة'),
              ],
            },
          ],
        };
      case 'zero':
        return {
          title: 'طلب موجود دون عروض مناسبة',
          note: 'هذا التقرير يحصي عمليات البحث التي عادت بصفر عروض داخل بيانات المثال. راجع المسار وتاريخ السفر لمعرفة الفجوات في التوفر.',
          tables: [
            {
              key: 'zeroResults',
              title: 'عمليات البحث دون نتائج',
              description: 'يتكرر الصف عند اختلاف الخدمة أو تاريخ السفر؛ عدد الباحثين يختلف عن عدد المحاولات.',
              rows: report.zeroResults,
              columns: [
                tcol('label', 'الوجهة أو المسار'),
                svc(),
                { key: 'travelDate', label: 'تاريخ السفر المطلوب', format: 'date' },
                ncol('searches', 'عمليات بحث دون نتائج'),
                ncol('users', 'باحثون مميزون'),
              ],
            },
          ],
        };
      case 'abandonment':
        return {
          title: 'في أي مرحلة يتوقف المستخدم؟',
          note: 'الجلسات المنتهية التي لم تصل إلى المرحلة التالية، وليس الطلبات المرسلة التي تنتظر التأكيد. كل صف يقارن التوقف بعدد الجلسات التي بلغت مرحلته.',
          tables: [
            {
              key: 'abandonment',
              title: 'مراحل عدم إكمال الرحلة',
              description: 'قد تتراجع أعداد المراحل بالتتابع. تُستبعد الجلسات التي ما زالت مفتوحة من التوقف.',
              rows: report.abandonment,
              columns: [
                tcol('label', 'موضع التوقف'),
                ncol('starts', 'جلسات بلغت المرحلة'),
                ncol('abandoned', 'جلسات توقفت'),
                pcol('rate', 'نسبة التوقف'),
              ],
            },
          ],
          callout: `بدأت ${count(report.summary.checkoutStarts)} جلسة الحجز، وتوقفت ${count(
            report.summary.abandoned
          )} جلسة منتهية قبل إرسال الطلب.`,
        };
      case 'travel':
        return {
          title: 'متى وكم يومًا يريدون السفر؟',
          note: 'الفترة أعلاه هي تاريخ نشاط المستخدم. التواريخ في هذا التقرير هي تواريخ السفر التي بحث عنها؛ ليالي الفندق منفصلة عن أيام الباقة كاملةً.',
          tables: [
            {
              key: 'travelDates',
              title: 'تواريخ السفر الأكثر طلبًا',
              description: 'مرتبة بعدد عمليات البحث، وليس بتاريخ إنشاء الحجز.',
              rows: report.travelDates,
              columns: [
                { key: 'date', label: 'تاريخ السفر المطلوب', format: 'date' },
                ncol('searches', 'عمليات البحث'),
                ncol('users', 'باحثون مميزون'),
              ],
            },
            {
              key: 'durations',
              title: 'مدد الإقامة والبرامج المطلوبة',
              description: 'الوحدة موضحة لكل مدة: ليالٍ للفنادق وأيام كاملة للباقات.',
              rows: report.durations,
              columns: [tcol('label', 'المدة المطلوبة'), svc(), ncol('searches', 'عمليات البحث'), ncol('users', 'باحثون مميزون')],
            },
          ],
        };
      case 'campaigns':
        return {
          title: 'أداء الحملات والعروض',
          note: 'الإسناد لآخر تفاعل مع الحملة أو العرض داخل جلسة البحث. حجوزات العرض تُحتسب فقط عند تسجيل تطبيق الخصم عليها. الإسناد لا يثبت أثرًا سببيًا، والعملات مستقلة ولا تُجمع.',
          tables: [
            {
              key: 'campaigns',
              title: 'الحملات الإعلانية',
              description: 'العائد الإعلاني = إيراد الحجوزات المؤكدة المنسوبة ÷ كلفة الإعلان بنفس العملة؛ ليس صافي الربح.',
              rows: report.campaigns,
              wide: true,
              columns: [
                tcol('label', 'الحملة'),
                tcol('currency', 'العملة'),
                ncol('impressions', 'ظهور'),
                ncol('clicks', 'نقرات'),
                ncol('visits', 'زيارات'),
                ncol('searches', 'عمليات بحث'),
                ncol('requests', 'طلبات'),
                ncol('confirmed', 'حجوزات مؤكدة'),
                pcol('conversion', 'تحويل جلسات البحث'),
                money('cost', 'كلفة الإعلان'),
                money('revenue', 'إيراد منسوب'),
                { key: 'roas', label: 'العائد الإعلاني', format: 'ratio' },
              ],
            },
            {
              key: 'offers',
              title: 'العروض والخصومات',
              description: '«حجوزات بالعرض» تشترط حجزًا مؤكدًا بلقطة خصم مطابقة. التحويل = جلسات البحث التي انتهت بهذا الحجز ÷ جلسات البحث المنسوبة للعرض بعد النقر عليه.',
              rows: report.offers,
              columns: [
                tcol('label', 'العرض'),
                pcol('discountPercent', 'نسبة الخصم'),
                ncol('impressions', 'ظهور'),
                ncol('clicks', 'نقرات'),
                ncol('searches', 'عمليات بحث'),
                ncol('requests', 'طلبات'),
                ncol('confirmed', 'حجوزات بالعرض'),
                pcol('conversion', 'تحويل بالعرض'),
              ],
            },
          ],
        };
      default:
        return {
          title: 'من البحث إلى حجز مؤكد',
          note: 'نسبة التحول = جلسات البحث التي لها حجز مؤكد مرتبط ÷ كل جلسات البحث المطابقة. لا تُحسب الطلبات المعلقة أو الملغاة، ولا يُعد تكرار البحث في الجلسة تحويلًا إضافيًا.',
          tables: [
            {
              key: 'conversionDestinations',
              title: 'التحويل حسب الوجهة',
              description: 'تُحسب التأكيدات المرتبطة بجلسات الفترة حتى نهاية الفترة المطبقة فقط.',
              rows: report.destinations,
              columns: conversionColumns,
            },
            {
              key: 'conversionServices',
              title: 'التحويل حسب الخدمة',
              description: 'مقارنة الطيران والفنادق والباقات والنقل والجولات على أساس جلسات البحث.',
              rows: report.conversionServices,
              columns: [{ ...conversionColumns[0], label: 'الخدمة' }, ...conversionColumns.slice(1)],
            },
          ],
        };
    }
  }, [report, section]);

  const renderCell = (row, column) => {
    const value = row[column.key];
    if (column.format === 'count') return <bdi>{count(value)}</bdi>;
    if (column.format === 'percent') return <bdi>{percent(value)}</bdi>;
    if (column.format === 'ratio') return <bdi>{value == null ? '—' : `${decimal(value)}×`}</bdi>;
    if (column.format === 'money')
      return (
        <>
          <bdi>{decimal(value)}</bdi> <small>{row.currency}</small>
        </>
      );
    if (column.format === 'service') return <span className="bh-service">{serviceLabels[value] || value}</span>;
    if (column.format === 'date') return <bdi>{value || '—'}</bdi>;
    return <span className="bh-cell-label">{value == null || value === '' ? '—' : value}</span>;
  };

  const handleExportCurrent = () => {
    if (!config) return;
    try {
      const csvLines = [];
      csvLines.push(['تقرير السلوك', config.title]);
      csvLines.push(['الخدمة', serviceLabels[service]]);
      csvLines.push([]);

      for (const t of config.tables) {
        csvLines.push([t.title]);
        csvLines.push(t.columns.map(c => c.label));
        for (const row of t.rows) {
          csvLines.push(
            t.columns.map(c => {
              const val = row[c.key];
              if (c.format === 'service') return serviceLabels[val] || val || '';
              return val == null ? '' : val;
            })
          );
        }
        csvLines.push([]);
      }

      const csvContent =
        '\ufeff' +
        csvLines
          .map(row =>
            row
              .map(val => {
                let text = String(val ?? '');
                if (/^[\s\uFEFF]*[=+\-@]/u.test(text)) text = `'${text}`;
                return `"${text.replace(/"/g, '""')}"`;
              })
              .join(',')
          )
          .join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `YAR-behavior-${section}-${Date.now().toString(36)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('صُدّرت بيانات التقرير الحالي بنجاح.');
    } catch {
      showToast('تعذر إنشاء ملف التصدير.', 'error');
    }
  };

  if (!report || !config) {
    return <div className="bh-error">تعذر عرض التقرير. راجع الفترة المطبقة.</div>;
  }

  const summary = report.summary;

  return (
    <div className="bh-page">
      <div className="bh-heading">
        <div>
          <div className="bh-eyebrow">افهم الطلب قبل ترتيب عروضك</div>
          <h2>الطلب والاهتمامات</h2>
          <p>تقارير توضيحية لسلوك المسافرين، من أول بحث إلى الحجز المؤكد.</p>
        </div>
        <span className="bh-demo">
          <span />
          بيانات مثال · دون تتبّع فعلي
        </span>
      </div>

      <div className="bh-toolbar">
        <label className="bh-field" htmlFor="bh-service">
          <span>الخدمة في تقارير السلوك</span>
          <select id="bh-service" value={service} onChange={e => setService(e.target.value)}>
            {Object.entries(serviceLabels).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <p>
          الفترة والمنصة من المرشحات أعلاه.
          <br />
          النتائج خاصة بالبيانات التجريبية؛ لا تتصل بعمليات العملاء الفعلية.
        </p>
        <button type="button" className="button secondary" onClick={handleExportCurrent}>
          <Icon name="download" />
          تصدير التقرير الحالي
        </button>
      </div>

      <div className="bh-metrics">
        <article className="bh-metric">
          <div>
            <span>عمليات البحث</span>
            <Icon name="search" />
          </div>
          <strong>
            <bdi>{count(summary.searches)}</bdi>
          </strong>
          <p>{count(summary.searchSessions)} جلسة بحث، مع احتساب المحاولات المتكررة</p>
        </article>

        <article className="bh-metric">
          <div>
            <span>باحثون مميزون</span>
            <Icon name="users" />
          </div>
          <strong>
            <bdi>{count(summary.users)}</bdi>
          </strong>
          <p>حسابات ومعرّفات متصفح مميزة داخل الفترة</p>
        </article>

        <article className="bh-metric">
          <div>
            <span>بحث دون نتائج</span>
            <Icon name="layers" />
          </div>
          <strong>
            <bdi>{percent(summary.zeroRate)}</bdi>
          </strong>
          <p>{count(summary.zeroSearches)} محاولة عادت بصفر عروض</p>
        </article>

        <article className="bh-metric">
          <div>
            <span>تحويل إلى حجز مؤكد</span>
            <Icon name="check" />
          </div>
          <strong>
            <bdi>{percent(summary.conversion)}</bdi>
          </strong>
          <p>{count(summary.confirmed)} حجزًا مؤكدًا مرتبطًا بجلسات البحث</p>
        </article>
      </div>

      {/* Sub-tabs for 7 sections */}
      <div className="bh-report-nav" role="tablist" aria-label="تقارير الطلب والاهتمامات">
        {sections.map(s => (
          <button
            key={s.key}
            type="button"
            role="tab"
            aria-selected={s.key === section}
            className={s.key === section ? 'selected' : ''}
            onClick={() => setSection(s.key)}
          >
            <Icon name={s.symbol} />
            {s.label}
          </button>
        ))}
      </div>

      <div id="bh-report-content" role="tabpanel" tabIndex="-1">
        <div className="bh-report-intro">
          <h3>{config.title}</h3>
          <p>{config.note}</p>
        </div>

        {config.callout && <p className="bh-callout">{config.callout}</p>}

        <div className="bh-tables">
          {config.tables.map(def => {
            const rows = Array.isArray(def.rows) ? def.rows : [];
            const totalPages = Math.max(1, Math.ceil(rows.length / size));
            const currentPage = Math.max(1, Math.min(pages[def.key] || 1, totalPages));
            const start = (currentPage - 1) * size;
            const shown = rows.slice(start, start + size);
            const maxVal = Math.max(
              1,
              ...rows.map(r => Number(r.searches || r.views || r.starts || r.searchSessions) || 0)
            );

            return (
              <section key={def.key} className="panel bh-panel">
                <div className="bh-panel-heading">
                  <div>
                    <h3>{def.title}</h3>
                    <p>{def.description}</p>
                  </div>
                  <span className="bh-row-count">
                    <bdi>{count(rows.length)}</bdi> بند
                  </span>
                </div>

                {rows.length ? (
                  <>
                    <div
                      className="bh-table-scroll"
                      role="region"
                      aria-label={def.title}
                      tabIndex="0"
                    >
                      <table className={`bh-table${def.wide ? ' bh-wide-table' : ''}`}>
                        <caption className="sr-only">
                          {def.title} وفق الفترة والمنصة والخدمة المطبقة
                        </caption>
                        <thead>
                          <tr>
                            {def.columns.map(c => (
                              <th key={c.key} scope="col">
                                {c.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {shown.map((row, index) => {
                            const valForBar =
                              Number(row.searches || row.views || row.starts || row.searchSessions) || 0;
                            const barPct = Math.max(0, Math.min(100, (valForBar / maxVal) * 100)).toFixed(2);

                            return (
                              <tr key={index}>
                                {def.columns.map((column, colIndex) => {
                                  if (colIndex === 0) {
                                    return (
                                      <th key={column.key} scope="row">
                                        <div className="bh-ranked-cell">
                                          <span className="bh-rank">
                                            {String(start + index + 1).padStart(2, '0')}
                                          </span>
                                          <div>
                                            {renderCell(row, column)}
                                            {!def.wide && (
                                              <span className="bh-mini-bar" aria-hidden="true">
                                                <span style={{ width: `${barPct}%` }} />
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </th>
                                    );
                                  }
                                  return <td key={column.key}>{renderCell(row, column)}</td>;
                                })}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="bh-pagination">
                      <span>
                        عرض <bdi>{count(start + 1)}–{count(Math.min(start + size, rows.length))}</bdi> من{' '}
                        <bdi>{count(rows.length)}</bdi>
                      </span>
                      <div>
                        <button
                          type="button"
                          disabled={currentPage === 1}
                          onClick={() => setPages(p => ({ ...p, [def.key]: currentPage - 1 }))}
                          aria-label={`الصفحة السابقة — ${def.title}`}
                        >
                          <Icon name="back" />
                        </button>
                        <bdi>
                          {currentPage} / {totalPages}
                        </bdi>
                        <button
                          type="button"
                          disabled={currentPage === totalPages}
                          onClick={() => setPages(p => ({ ...p, [def.key]: currentPage + 1 }))}
                          aria-label={`الصفحة التالية — ${def.title}`}
                        >
                          <Icon name="chevronLeft" />
                        </button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bh-empty">
                    <Icon name="search" />
                    <strong>لا توجد بيانات مطابقة لهذا التقرير</strong>
                    <p>جرّب فترة أخرى أو اختر «كل الخدمات» والمنصات.</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      <details className="bh-method">
        <summary>كيف تُقرأ هذه الأرقام؟</summary>
        <p>
          المرشحات تعتمد تاريخ جلسة النشاط بتوقيت بغداد؛ تواريخ السفر المطلوبة قد تكون خارج هذه الفترة. التحويل ينسب
          الحجز المؤكد إلى البحث المرتبط في الجلسة نفسها وحتى نهاية الفترة، ولا يساوي معدل إرسال الطلب.
        </p>
        <p>
          الحسابات ومعرّفات المتصفح ليست تقديرًا مؤكدًا لعدد الأشخاص. لا تُربط الزيارات المجهولة السابقة بحساب ظهر لاحقًا.
          تقارير الفنادق والباقات تعرض مشاهدات التفاصيل؛ وقد لا تظهر صفوف عند اختيار خدمة أخرى.
        </p>
        <p>
          بيانات السلوك مستقلة عن بيانات مركز الحجوزات في هذه المعاينة. التصدير يشمل جميع صفوف التقرير الحالي وفق
          المرشحات، حتى الصفوف خارج الصفحة المعروضة.
        </p>
      </details>
    </div>
  );
}

