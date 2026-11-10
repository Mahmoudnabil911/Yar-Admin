import React, { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { catalogTypes } from '../../services/models';
import { catalogStorage, statusLabels, normalized } from '../../services/storage/catalogStorage';
import { useToast } from '../../components/ui/Toast';
import {imageSource} from './PhotoDropzone';
import HotelFilters,{emptyHotelFilters,matchHotel} from '../hotels/HotelFilters';
import '../hotels/hotel-editor.css';

export function CatalogListView({
  catalogKey,
  onNavigate,
  onEdit,
  searchQuery = '',
  onSearchChange
}) {
  const toast = useToast();
  const config = catalogTypes[catalogKey];
  const allProviders = catalogStorage.getRecords('providers');
  const [records, setRecords] = useState(() => catalogStorage.getRecords(catalogKey));
  const [statusFilter, setStatusFilter] = useState('all');
  const [hotelFilters, setHotelFilters] = useState(emptyHotelFilters);
  const [page, setPage] = useState(1);
  const pageSize = 6;

  // Subscribe to storage
  React.useEffect(() => {
    const unsub = catalogStorage.subscribe(() => {
      setRecords(catalogStorage.getRecords(catalogKey));
    });
    return unsub;
  }, [catalogKey]);

  const numFormat = useMemo(() => new Intl.NumberFormat('en-US'), []);
  const num = val => numFormat.format(Number(val) || 0);

  // Filtered rows
  const filtered = useMemo(() => {
    const q = normalized(searchQuery);
    return records.filter(r => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !normalized(JSON.stringify(r)).includes(q)) return false;
      if (catalogKey === 'hotels' && !matchHotel(r, hotelFilters)) return false;
      return true;
    });
  }, [records, statusFilter, searchQuery, catalogKey, hotelFilters]);

  // Counts
  const counts = useMemo(() => ({
    all: records.length,
    published: records.filter(r => r.status === 'published').length,
    draft: records.filter(r => r.status === 'draft').length,
    archived: records.filter(r => r.status === 'archived').length
  }), [records]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPageSafe = Math.min(page, totalPages);
  const startIdx = (currentPageSafe - 1) * pageSize;
  const pageRows = filtered.slice(startIdx, startIdx + pageSize);

  const handleArchive = (id, currentStatus, name) => {
    try {
      const nextStatus = catalogStorage.archiveRecord(catalogKey, id);
      toast(nextStatus === 'archived'
        ? 'نُقل السجل إلى الأرشيف. يمكن استعادته من تصفية «مؤرشف».'
        : 'استُعيد السجل كمسودة للمراجعة.');
    } catch (err) {
      toast(err.message);
    }
  };

  const renderCell = (record, col) => {
    const value = record[col.key];
    if (col.render) {
      const rendered = col.render(record, {
        esc: v => String(v ?? ''),
        icon: name => <Icon name={name} />,
        num,
        catalogs: { providers: allProviders }
      });
      if (typeof rendered === 'string' && rendered.includes('<')) {
        return <span dangerouslySetInnerHTML={{ __html: rendered }} />;
      }
      return rendered;
    }

    switch (col.format) {
      case 'status':
        return (
          <span className={`catalog-status ${record.status}`}>
            <span></span>
            {statusLabels[record.status] || 'مسودة'}
          </span>
        );
      case 'moneyIQD':
        return value == null ? '—' : (
          <>
            <bdi>{num(value)}</bdi> <small>د.ع</small>
          </>
        );
      case 'moneyUSD':
        return value == null ? '—' : (
          <>
            <bdi>{num(value)}</bdi> <small>$</small>
          </>
        );
      case 'stars':
        return (
          <span className="star-rating" aria-label={`${value} نجوم`}>
            {'★'.repeat(Math.min(5, Number(value) || 0))}
          </span>
        );
      case 'count':
      case 'rooms':
        return <span className="count-chip">{Array.isArray(value) ? value.length : 0}</span>;
      case 'photos':
        return (
          <span className="gallery-count">
            <i><Icon name="layers" /></i>
            {Array.isArray(value) ? value.length : 0}
          </span>
        );
      default:
        if (col.key === 'name') {
          return (
            <div className="catalog-name">
              {catalogKey==='hotels'&&record.photos?.[0]?<img className="hotel-thumbnail" src={imageSource(record.photos[0])} alt={record.name}/>:<span className="catalog-avatar">
                <i><Icon name={config.icon} /></i>
              </span>}
              <div>
                <strong>{value || 'غير مسمى'}</strong>
                <small>{record.id}</small>
              </div>
            </div>
          );
        }
        if (col.key === 'serviceProvider') {
          const provider = allProviders.find(p => p.id === value);
          return provider?.name || 'غير محدد';
        }
        return value == null || value === '' ? '—' : String(value);
    }
  };

  return (
    <div id="catalog-view">
      <div className="page-heading catalog-heading">
        <div>
          <div className="eyebrow">إدارة الخدمات</div>
          <h1 id="catalog-title" tabIndex={-1}>{config.title}</h1>
          <p>{config.description}</p>
        </div>
        <button
          type="button"
          className="button primary"
          data-catalog-add
          onClick={() => onEdit?.('new')}
        >
          <i><Icon name="plus" /></i>
          {config.addLabel}
        </button>
      </div>

      {/* Summary status filter buttons */}
      <div className="catalog-summary">
        {[
          ['all', 'إجمالي السجلات'],
          ['published', 'منشور في المعاينة'],
          ['draft', 'مسودات'],
          ['archived', 'مؤرشف']
        ].map(([s, label]) => (
          <button
            key={s}
            type="button"
            className={statusFilter === s ? 'selected' : ''}
            aria-pressed={statusFilter === s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
          >
            <span>{label}</span>
            <strong>{counts[s]}</strong>
          </button>
        ))}
      </div>

      <section className="panel catalog-list-panel">
        <div className="catalog-toolbar">
          <label className="catalog-search">
            <i><Icon name="search" /></i>
            <input
              type="search"
              placeholder={config.searchPlaceholder}
              value={searchQuery}
              onChange={e => { onSearchChange?.(e.target.value); setPage(1); }}
            />
          </label>
          <span className="local-preview-note">
            <span className="tiny-dot green"></span>
            التعديلات محفوظة في هذا المتصفح فقط
          </span>
        </div>
        {catalogKey === 'hotels' && <HotelFilters records={records} value={hotelFilters} onChange={v => { setHotelFilters(v); setPage(1); }} />}

        <div className="table-scroll">
          {pageRows.length > 0 ? (
            <table className="catalog-table">
              <thead>
                <tr>
                  {config.columns.map(c => (
                    <th scope="col" key={c.key}>{c.label}</th>
                  ))}
                  <th scope="col">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(record => (
                  <tr key={record.id}>
                    {config.columns.map(col => (
                      <td key={col.key}>{renderCell(record, col)}</td>
                    ))}
                    <td>
                      <div className="catalog-row-actions">
                        <button
                          type="button"
                          className="catalog-edit"
                          onClick={() => onEdit?.(record.id)}
                        >
                          <i><Icon name="layers" /></i>
                          تعديل
                        </button>
                        <button
                          type="button"
                          className="catalog-archive"
                          aria-label={record.status === 'archived' ? `استعادة ${record.name}` : `أرشفة ${record.name}`}
                          onClick={() => handleArchive(record.id, record.status, record.name)}
                        >
                          <i><Icon name={record.status === 'archived' ? 'back' : 'trash'} /></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">
              <i><Icon name={config.icon} /></i>
              <strong>لا توجد سجلات مطابقة</strong>
              <p>غيّر البحث أو الحالة، أو أضف {config.singular} جديدًا.</p>
              <button
                type="button"
                className="button secondary"
                onClick={() => { setStatusFilter('all'); onSearchChange?.(''); setPage(1); }}
              >
                مسح البحث والتصفية
              </button>
            </div>
          )}
        </div>

        <div className="table-footer">
          <span aria-live="polite">
            {filtered.length > 0
              ? `عرض ${startIdx + 1}–${Math.min(startIdx + pageSize, filtered.length)} من ${filtered.length} سجلًا`
              : 'لا توجد نتائج'}
          </span>
          <div className="pagination">
            <button
              type="button"
              aria-label="السجلات السابقة"
              disabled={currentPageSafe === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <i><Icon name="back" /></i>
            </button>
            <span>{currentPageSafe}</span>
            <button
              type="button"
              aria-label="السجلات التالية"
              disabled={currentPageSafe === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <i><Icon name="chevronLeft" /></i>
            </button>
          </div>
        </div>
      </section>

      {catalogKey === 'packages' && (
        <div className="catalog-tip">
          الأسعار تخص الباقة كاملة للشخص عند حجز شخصين؛ يمكن إضافة عدة خيارات فنادق ضمن البرنامج نفسه.
        </div>
      )}

      {catalogKey === 'providers' && (
        <div className="catalog-tip">
          مزوّدو الطيران والفنادق والنقل والبرامج في صفحة واحدة. إعدادات الربط توضيحية، ولا تُحفظ أي مفاتيح API في هذا النموذج.
        </div>
      )}
    </div>
  );
}

export default CatalogListView;

