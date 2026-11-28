import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CatalogListView from '../catalog/CatalogListView';
import CatalogEditor from '../catalog/CatalogEditor';
import { isAuthenticated } from '../../services/api/authApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';
import { suppliersApi } from '../../services/api/suppliersApi';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapServiceStatus(service) {
  if (service.active === false) return 'archived';
  if (service.published) return 'published';
  return 'draft';
}

/**
 * Map a server service record (service_type === 'tour') to the local
 * catalog shape consumed by CatalogListView / CatalogEditor (tours key).
 *
 * Local fields (catalog-tours.js):
 *   name, city, duration (hours), itinerary, inclusions, exclusions,
 *   photos, priceUSD, priceBasis, capacity, serviceProvider, status
 */
function mapTourRecord(service) {
  const attrs =
    service.attributes && typeof service.attributes === 'object' ? service.attributes : {};

  // duration: server stores duration_minutes; local wants hours
  const durationMinutes = service.duration_minutes != null ? Number(service.duration_minutes) : 0;
  const durationHours = durationMinutes > 0 ? durationMinutes / 60 : 4;

  // price_basis on the server is an enum ('legacy'|'per_person'|'per_group').
  // The human-readable free text is stored in attributes.priceBasis.
  // Never show the enum code in the UI form.
  const PRICE_BASIS_ENUM = new Set(['legacy', 'per_person', 'per_group']);
  const priceBasisText =
    String(attrs.priceBasis || '').trim() ||
    (service.price_basis && !PRICE_BASIS_ENUM.has(service.price_basis)
      ? String(service.price_basis)
      : '');

  return {
    id: service.id,
    name: service.name || '',
    city: service.city || '',
    duration: durationHours,
    itinerary: service.itinerary || String(attrs.itinerary || ''),
    inclusions: service.inclusions || String(attrs.inclusions || ''),
    exclusions: service.exclusions || String(attrs.exclusions || ''),
    photos: Array.isArray(service.media) ? service.media : [],
    priceUSD: service.price_usd != null ? Number(service.price_usd) : 0,
    priceBasis: priceBasisText,
    capacity: service.capacity != null ? Number(service.capacity) : 1,
    serviceProvider: service.supplier_id ? String(service.supplier_id) : '',
    status: mapServiceStatus(service),
    // keep raw for update diff
    _rawMedia: Array.isArray(service.media) ? service.media : [],
    _rawServiceId: service.id,
  };
}

/** Convert a data: URL to a File blob for upload via API 180. */
async function dataUrlToFile(dataUrl, index) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type?.split('/')[1] || 'webp';
  return new File([blob], `tour-photo-${Date.now()}-${index}.${ext}`, {
    type: blob.type || 'image/webp',
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ToursPage({
  editId: propEditId,
  onEdit: propOnEdit,
  onBack: propOnBack,
  searchQuery,
  onSearchChange,
  onNavigate,
}) {
  const [localEditId, setLocalEditId] = useState(null);
  const editId = propEditId !== undefined ? propEditId : localEditId;
  const onEdit = propOnEdit || setLocalEditId;
  const onBack = propOnBack || (() => setLocalEditId(null));

  const hasAuth = isAuthenticated();
  const [tours, setTours] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  // -------------------------------------------------------------------------
  // Fetch live data
  // -------------------------------------------------------------------------
  const fetchToursData = useCallback(async (force = false) => {
    if (!isAuthenticated()) return;
    const [servicesRes, suppliersRes] = await Promise.all([
      catalogAdminApi.getServices(force),
      suppliersApi.listAdminSuppliers().catch(() => ({ items: [] })),
    ]);

    const allServices = Array.isArray(servicesRes?.items) ? servicesRes.items : [];
    const tourServices = allServices.filter((s) => s.service_type === 'tour');
    setTours(tourServices.map((s) => mapTourRecord(s)));

    const supplierItems = Array.isArray(suppliersRes?.items) ? suppliersRes.items : [];
    setProviders(
      supplierItems.map((sup) => ({
        id: String(sup.id),
        name: sup.name || `مورد #${sup.id}`,
        serviceType: 'tour',
        status: sup.active === false ? 'archived' : 'published',
      })),
    );
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasAuth) return;
    fetchToursData().catch(() => {
      setHasLoaded(true);
    });
  }, [hasAuth, fetchToursData]);

  // -------------------------------------------------------------------------
  // Editing record lookup
  // -------------------------------------------------------------------------
  const editingRecord = useMemo(() => {
    if (!hasAuth || !editId || editId === 'new') return null;
    return tours.find((t) => String(t.id) === String(editId)) || null;
  }, [hasAuth, editId, tours]);

  // -------------------------------------------------------------------------
  // Archive / restore
  // -------------------------------------------------------------------------
  const handleArchiveTour = useCallback(
    async (id, currentStatus) => {
      const restore = currentStatus === 'archived';
      await catalogAdminApi.updateService(Number(id), {
        active: restore,
        ...(restore ? { published: false } : {}),
      });
      await fetchToursData(true);
      return restore ? 'draft' : 'archived';
    },
    [fetchToursData],
  );

  // -------------------------------------------------------------------------
  // Save (create / update)
  // -------------------------------------------------------------------------
  const handleSaveTour = useCallback(
    async (candidate) => {
      const name = String(candidate.name || '').trim();
      const city = String(candidate.city || '').trim();
      if (!name) throw new Error('يرجى إدخال اسم الجولة.');
      if (!city) throw new Error('يرجى اختيار مدينة للجولة.');

      // Duration: local is hours → server expects minutes
      const durationHours = Number(candidate.duration) || 4;
      const durationMinutes = Math.round(durationHours * 60);

      const priceUsd = Number(candidate.priceUSD) || 0;
      const capacity = Number(candidate.capacity) || 1;
      const supplierId =
        candidate.serviceProvider && String(candidate.serviceProvider).trim() !== ''
          ? parseInt(String(candidate.serviceProvider), 10)
          : undefined;

      // Separate existing server-hosted URLs from newly added local data: URLs
      const candidatePhotos = Array.isArray(candidate.photos) ? candidate.photos : [];
      const existingMedia = candidatePhotos.filter(
        (p) => typeof p === 'string' && !p.startsWith('data:'),
      );
      const newDataPhotos = candidatePhotos.filter(
        (p) => typeof p === 'string' && p.startsWith('data:'),
      );

      // -----------------------------------------------------------------------
      // Build the POST/PATCH payload
      // The Admin_services schema uses additionalProperties: false, so we only
      // send fields that are in the allowlist. Tour-specific fields accepted:
      // destinations, duration_days, departure_schedule, inclusions, exclusions,
      // itinerary, duration_notes, price_basis, minimum_guests
      //
      // price_basis MUST be one of the enum values: 'legacy'|'per_person'|'per_group'
      // The local free-text priceBasis is stored in attributes only.
      // -----------------------------------------------------------------------
      const servicePayload = {
        name,
        service_type: 'tour',
        description: String(candidate.itinerary || candidate.priceBasis || name).trim() || name,
        city,
        pickup_location: city,
        dropoff_location: city,
        duration_minutes: durationMinutes,
        capacity,
        price_usd: priceUsd,
        supplier_cost_usd: Math.round(priceUsd * 0.8 * 100) / 100,
        media: existingMedia,
        attributes: {
          priceBasis: String(candidate.priceBasis || '').trim(),
        },
        published: candidate.status === 'published',
        active: candidate.status !== 'archived',
        // tour-specific — price_basis must be a valid enum value
        price_basis: 'per_group',
        itinerary: String(candidate.itinerary || '').trim(),
        inclusions: String(candidate.inclusions || '').trim(),
        exclusions: String(candidate.exclusions || '').trim(),
        minimum_guests: 1,
        ...(supplierId ? { supplier_id: supplierId } : {}),
      };

      // Fallback payload without supplier_id in case server rejects it
      const { supplier_id: _sid, ...fallbackPayload } = servicePayload;

      const isUpdate =
        candidate.id && !['new'].includes(String(candidate.id)) && Number(candidate.id) > 0;
      let serviceId = isUpdate ? Number(candidate.id) : null;

      if (isUpdate) {
        const prevMedia = Array.isArray(candidate._rawMedia) ? candidate._rawMedia : [];
        const mediaChanged =
          existingMedia.length !== prevMedia.length ||
          existingMedia.some((u, idx) => u !== prevMedia[idx]);
        const patchExtra = mediaChanged ? { media: existingMedia } : {};
        try {
          await catalogAdminApi.updateService(serviceId, {
            ...servicePayload,
            ...patchExtra,
          });
        } catch (err) {
          if (err?.status === 400 || err?.code === 'invalid_request') {
            await catalogAdminApi.updateService(serviceId, {
              ...fallbackPayload,
              ...patchExtra,
            });
          } else {
            throw err;
          }
        }
      } else {
        let created;
        try {
          created = await catalogAdminApi.createService(servicePayload);
        } catch (err) {
          if (err?.status === 400 || err?.code === 'invalid_request') {
            try {
              created = await catalogAdminApi.createService(fallbackPayload);
            } catch (err2) {
              // Last resort: strip tour-specific fields that might not be allowed
              const minimalPayload = {
                name,
                service_type: 'tour',
                description: servicePayload.description,
                city,
                pickup_location: city,
                dropoff_location: city,
                duration_minutes: durationMinutes,
                capacity,
                price_usd: priceUsd,
                supplier_cost_usd: servicePayload.supplier_cost_usd,
                media: existingMedia,
                attributes: servicePayload.attributes,
                published: servicePayload.published,
                active: servicePayload.active,
              };
              created = await catalogAdminApi.createService(minimalPayload);
            }
          } else {
            throw err;
          }
        }
        serviceId = Number(created.id);
      }

      // API 180 | Upload newly added local photos
      for (let i = 0; i < newDataPhotos.length; i += 1) {
        try {
          const file = await dataUrlToFile(newDataPhotos[i], i + 1);
          await catalogAdminApi.uploadServiceMedia(serviceId, file, `${name}-${i + 1}`);
        } catch {
          // non-fatal: photo upload failure should not block save
        }
      }

      await fetchToursData(true);
      return { ...candidate, id: serviceId };
    },
    [fetchToursData],
  );

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (!hasAuth) {
    if (editId) {
      return <CatalogEditor catalogKey="tours" recordId={editId} onBack={onBack} />;
    }
    return (
      <CatalogListView
        catalogKey="tours"
        onNavigate={onNavigate}
        onEdit={onEdit}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
      />
    );
  }

  if (editId) {
    return (
      <CatalogEditor
        catalogKey="tours"
        recordId={editId}
        onBack={onBack}
        externalRecord={editId === 'new' ? null : editingRecord}
        externalProviders={providers}
        onSaveRecord={handleSaveTour}
        syncNote="متصل بالخادم · التغييرات تُحفظ على السيرفر"
      />
    );
  }

  return (
    <CatalogListView
      catalogKey="tours"
      onNavigate={onNavigate}
      onEdit={onEdit}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      externalRecords={hasLoaded ? tours : []}
      externalProviders={providers}
      onArchiveRecord={handleArchiveTour}
      syncNote="متصل بالخادم · بيانات حية"
    />
  );
}

export default ToursPage;
