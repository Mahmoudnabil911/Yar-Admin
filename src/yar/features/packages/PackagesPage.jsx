import React, { useState } from 'react';
import CatalogListView from '../catalog/CatalogListView';
import CatalogEditor from '../catalog/CatalogEditor';

export function PackagesPage({
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
    return <CatalogEditor catalogKey="packages" recordId={editId} onBack={onBack} />;
  }
  return (
    <CatalogListView
      catalogKey="packages"
      onNavigate={onNavigate}
      onEdit={onEdit}
      searchQuery={searchQuery}
      onSearchChange={onSearchChange}
    />
  );
}

export default PackagesPage;
