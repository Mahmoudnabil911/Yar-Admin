import React, { useState, useEffect, useCallback, useMemo } from 'react';
import CatalogListView from '../catalog/CatalogListView';
import CatalogEditor from '../catalog/CatalogEditor';
import { isAuthenticated } from '../../services/api/authApi';
import { catalogAdminApi } from '../../services/api/catalogAdminApi';
import { suppliersApi } from '../../services/api/suppliersApi';

function mapServiceStatus(service) {
  if (service.active === false) return 'archived';
  if (service.published) return 'published';
  return 'draft';
}

function mapCarRecord(service, rates) {
  const serviceRates = rates.filter((r) => Number(r.service_id) === Number(service.id));
  const activeRates = serviceRates.filter((r) => r.active !== false);
  const attrs =
    service.attributes && typeof service.attributes === 'object' ? service.attributes : {};

  return {
    id: service.id,
    name: service.name || '',
    model: (service.car_model && String(service.car_model)) || String(attrs.model || ''),
    seatCount: service.capacity != null ? Number(service.capacity) : 1,
    bags:
      service.luggage_capacity != null ? Number(service.luggage_capacity) : Number(attrs.bags || 0),
    photos: Array.isArray(service.media) ? service.media : [],
    serviceProvider: service.supplier_id ? String(service.supplier_id) : '',
    cityPrices: activeRates.map((rate) => ({
      id: rate.id,
      city: rate.city || '',
      oneWayUSD: Number(rate.pickup_price_usd ?? 0),
      roundTripUSD: Number(rate.roundtrip_price_usd ?? 0),
      pickup_supplier_cost_usd: Number(rate.pickup_supplier_cost_usd ?? 0),
      roundtrip_supplier_cost_usd: Number(rate.roundtrip_supplier_cost_usd ?? 0),
    })),
    status: mapServiceStatus(service),
    _rawMedia: Array.isArray(service.media) ? service.media : [],
    _rawRates: serviceRates,
  };
}

async function dataUrlToFile(dataUrl, index) {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type?.split('/')[1] || 'webp';
  return new File([blob], `car-photo-${Date.now()}-${index}.${ext}`, {
    type: blob.type || 'image/webp',
  });
}

export function CarsPage({
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
  const [cars, setCars] = useState([]);
  const [providers, setProviders] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  const fetchCarsData = useCallback(async (force = false) => {
    if (!isAuthenticated()) return;
    const [servicesRes, ratesRes, suppliersRes] = await Promise.all([
      catalogAdminApi.getServices(force),
      catalogAdminApi.getCarCityRates({ limit: 100, offset: 0 }, force),
      suppliersApi.listAdminSuppliers().catch(() => ({ items: [] })),
    ]);

    const allServices = Array.isArray(servicesRes?.items) ? servicesRes.items : [];
    const allRates = Array.isArray(ratesRes?.items) ? ratesRes.items : [];
    const carServices = allServices.filter((s) => s.service_type === 'car');
    setCars(carServices.map((s) => mapCarRecord(s, allRates)));

    const supplierItems = Array.isArray(suppliersRes?.items) ? suppliersRes.items : [];
    setProviders(
      supplierItems.map((sup) => ({
        id: String(sup.id),
        name: sup.name || `مورد #${sup.id}`,
        serviceType: 'transfer',
        status: sup.active === false ? 'archived' : 'published',
      })),
    );
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (!hasAuth) return;
    fetchCarsData().catch(() => {
      setHasLoaded(true);
    });
  }, [hasAuth, fetchCarsData]);

  const editingRecord = useMemo(() => {
    if (!hasAuth || !editId || editId === 'new') return null;
    return cars.find((c) => String(c.id) === String(editId)) || null;
  }, [hasAuth, editId, cars]);

  const handleArchiveCar = useCallback(
    async (id, currentStatus) => {
      const restore = currentStatus === 'archived';
      await catalogAdminApi.updateService(Number(id), {
        active: restore,
        ...(restore ? { published: false } : {}),
      });
      await fetchCarsData(true);
      return restore ? 'draft' : 'archived';
    },
    [fetchCarsData],
  );

  const handleSaveCar = useCallback(
    async (candidate) => {
      const name = String(candidate.name || '').trim();
      const model = String(candidate.model || '').trim();
      if (!name) throw new Error('يرجى إدخال اسم السيارة.');
      if (!model) throw new Error('يرجى إدخال الموديل.');

      const cityPrices = Array.isArray(candidate.cityPrices) ? candidate.cityPrices : [];
      if (cityPrices.length === 0) {
        throw new Error('أضف سعر مدينة واحدة على الأقل.');
      }

      const validCityPrices = cityPrices.filter((cp) => String(cp.city || '').trim());
      if (validCityPrices.length === 0) {
        throw new Error('يرجى تحديد المدينة في قائمة الأسعار.');
      }

      const basePrice = Math.min(...validCityPrices.map((cp) => Number(cp.oneWayUSD) || 0));

      const photos = Array.isArray(candidate.photos) ? candidate.photos : [];
      const existingMedia = photos.filter(
        (src) => typeof src === 'string' && !src.startsWith('data:'),
      );
      const newDataPhotos = photos.filter(
        (src) => typeof src === 'string' && src.startsWith('data:'),
      );

      const primaryCity = String(validCityPrices[0].city).trim();
      const baseCost = Math.min(
        ...validCityPrices.map((cp) => Number(cp.pickup_supplier_cost_usd ?? 0)),
      );

      const parsedSupplierId = Number(candidate.serviceProvider);
      const supplierPayload =
        Number.isInteger(parsedSupplierId) && parsedSupplierId > 0
          ? { supplier_id: parsedSupplierId }
          : {};

      const servicePayload = {
        name,
        service_type: 'car',
        description: `${name} - ${model}`,
        city: primaryCity,
        pickup_location: primaryCity,
        dropoff_location: primaryCity,
        duration_minutes: 60,
        car_model: model,
        capacity: Number(candidate.seatCount) || 1,
        luggage_capacity: Number(candidate.bags) || 0,
        price_usd: basePrice >= 0 ? basePrice : 0,
        supplier_cost_usd: baseCost >= 0 ? baseCost : 0,
        media: existingMedia,
        attributes: {
          model,
          bags: Number(candidate.bags) || 0,
        },
        published: candidate.status === 'published',
        active: candidate.status !== 'archived',
        ...supplierPayload,
      };

      const fallbackPayload = { ...servicePayload };
      delete fallbackPayload.car_model;
      delete fallbackPayload.luggage_capacity;

      const isUpdate = Boolean(candidate.id && Number(candidate.id) > 0);
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
            created = await catalogAdminApi.createService(fallbackPayload);
          } else {
            throw err;
          }
        }
        serviceId = Number(created.id);
      }

      // API 180 | Upload any newly added local photos
      for (let i = 0; i < newDataPhotos.length; i += 1) {
        const file = await dataUrlToFile(newDataPhotos[i], i + 1);
        await catalogAdminApi.uploadServiceMedia(serviceId, file, `${name}-${i + 1}`);
      }

      // API 182 & 183 | Sync city rates for this car service
      const existingRates = Array.isArray(candidate._rawRates) ? candidate._rawRates : [];
      const keptRateIds = new Set();

      for (const row of validCityPrices) {
        const city = String(row.city).trim();
        const pickupPrice = Number(row.oneWayUSD) || 0;
        const roundtripPrice = Number(row.roundTripUSD) || 0;
        const matchedRate =
          (row.id ? existingRates.find((r) => Number(r.id) === Number(row.id)) : null) ||
          existingRates.find(
            (r) => String(r.city).trim() === city && !keptRateIds.has(Number(r.id)),
          );

        if (matchedRate) {
          keptRateIds.add(Number(matchedRate.id));
          await catalogAdminApi.updateCarCityRate(Number(matchedRate.id), {
            service_id: serviceId,
            city,
            pickup_price_usd: pickupPrice,
            roundtrip_price_usd: roundtripPrice,
            pickup_supplier_cost_usd: Number(
              row.pickup_supplier_cost_usd ?? matchedRate.pickup_supplier_cost_usd ?? 0,
            ),
            roundtrip_supplier_cost_usd: Number(
              row.roundtrip_supplier_cost_usd ?? matchedRate.roundtrip_supplier_cost_usd ?? 0,
            ),
            active: true,
          });
        } else {
          await catalogAdminApi.createCarCityRate({
            service_id: serviceId,
            city,
            pickup_price_usd: pickupPrice,
            roundtrip_price_usd: roundtripPrice,
            pickup_supplier_cost_usd: Number(row.pickup_supplier_cost_usd ?? 0),
            roundtrip_supplier_cost_usd: Number(row.roundtrip_supplier_cost_usd ?? 0),
            active: true,
          });
        }
      }

      // Archive any active city rates that were removed from the form
      for (const oldRate of existingRates) {
        if (oldRate.active !== false && !keptRateIds.has(Number(oldRate.id))) {
          await catalogAdminApi.updateCarCityRate(Number(oldRate.id), { active: false });
        }
      }

      await fetchCarsData(true);
      return { ...candidate, id: serviceId };
    },
    [fetchCarsData],
  );

  if (!hasAuth) {
    if (editId) {
      return <CatalogEditor catalogKey="cars" recordId={editId} onBack={onBack} />;
    }
    return (
      <CatalogListView
        catalogKey="cars"
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
        catalogKey="cars"
        recordId={editId}
        onBack={onBack}
        externalRecord={editId === 'new' ? null : editingRecord}
        externalProviders={providers}
        onSaveRecord={handleSaveCar}
        syncNote="متصل بالخادم · التغييرات تُحفظ على السيرفر"
      />
    );
  }

  return (
    <CatalogListView
      catalogKey="cars"
      onNavigate={onNavigate}
      onEdit={onEdit}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
      externalRecords={hasLoaded ? cars : []}
      externalProviders={providers}
      onArchiveRecord={handleArchiveCar}
      syncNote="متصل بالخادم · بيانات حية"
    />
  );
}

export default CarsPage;
