import React, { useState } from 'react';
import CatalogListView from '../catalog/CatalogListView';
import HotelEditor from './HotelEditor';

export function HotelsPage({
  editId: propEditId,
  onEdit: propOnEdit,
  onBack: propOnBack,
  searchQuery,
  onSearchChange,
  onNavigate
}) {
  const [localEditId, setLocalEditId] = useState(null);
  const editId = propEditId !== undefined ? propEditId : localEditId;
  const onEdit = propOnEdit || setLocalEditId;
  const onBack = propOnBack || (() => setLocalEditId(null));

  if (editId) {
    return <HotelEditor key={editId} recordId={editId} onBack={onBack} />;
  }
  return (
    <CatalogListView
      catalogKey="hotels"
      onNavigate={onNavigate}
      onEdit={onEdit}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
    />
  );
}

export default HotelsPage;
