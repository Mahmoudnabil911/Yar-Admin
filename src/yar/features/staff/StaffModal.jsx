import { LEGACY_REVIEW_ROLES } from '../../auth/access';
import React, { useState, useEffect } from 'react';
import { staffModel as M } from '../../services/models';
import Drawer from '../../components/ui/Drawer';
import { Icon } from '../../components/ui/Icon';

export default function StaffModal({ isOpen, onClose, staffMember, onSave }) {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    role: 'bookings',
    status: 'active',
    permissions: M.presets.bookings.slice(),
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (staffMember) {
      setFormData({
        id: staffMember.id || '',
        name: staffMember.name || '',
        role: staffMember.role || 'bookings',
        status: staffMember.status || 'active',
        permissions: (staffMember.permissions || []).slice(),
      });
      setError('');
    } else {
      setFormData({
        id: '',
        name: '',
        role: 'bookings',
        status: 'active',
        permissions: M.presets.bookings.slice(),
      });
      setError('');
    }
  }, [staffMember, isOpen]);

  const handleRoleChange = e => {
    const nextRole = e.target.value;
    const preset = M.presets[nextRole] || [];
    setFormData(prev => ({
      ...prev,
      role: nextRole,
      permissions: preset.slice(),
    }));
  };

  const handlePermissionToggle = permKey => {
    setFormData(prev => {
      const exists = prev.permissions.includes(permKey);
      const nextPerms = exists
        ? prev.permissions.filter(p => p !== permKey)
        : [...prev.permissions, permKey];
      return { ...prev, permissions: nextPerms };
    });
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('أدخل اسم الموظف.');
      return;
    }
    try {
      onSave({
        ...formData,
        id: formData.id || `staff-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      });
    } catch (err) {
      setError(err.message || 'تعذر حفظ الموظف.');
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={formData.id ? 'تعديل الموظف' : 'إضافة موظف'}
      badgeText="إدارة محلية للمعاينة"
    >
      <form className="stf-form" onSubmit={handleSubmit}>
        {error && (
          <div className="stf-error" role="alert" tabIndex="-1">
            {error}
          </div>
        )}

        <div className="stf-form-grid">
          <label className="stf-field stf-wide">
            اسم الموظف
            <input
              required
              minLength={2}
              maxLength={80}
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="اسم واضح لإسناد الطلبات"
            />
          </label>

          <label className="stf-field">
            الدور
            <select value={formData.role} onChange={handleRoleChange}>
              {LEGACY_REVIEW_ROLES.includes(formData.role) && (
                <option value={formData.role} disabled>
                  {M.roles[formData.role]} · يحتاج مراجعة
                </option>
              )}
              <option value="admin">مدير النظام (admin)</option>
              <option value="bookings">موظف حجوزات (booking_employee)</option>
            </select>
            {LEGACY_REVIEW_ROLES.includes(formData.role) && (
              <small className="stf-note" role="note">دور قديم غير مدعوم في النظام الجديد؛ لن يتمكن من الدخول حتى تختار أحد الدورين.</small>
            )}
          </label>

          <label className="stf-field">
            الحالة
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value })}
            >
              <option value="active">نشط</option>
              <option value="inactive">موقوف</option>
            </select>
          </label>
        </div>

        <fieldset className="stf-permissions">
          <legend>صلاحيات الدور</legend>
          <p>
            {formData.role === 'admin'
              ? 'مدير النظام: وصول كامل لكل الصفحات، الموظفين، الاسترداد وتعديل أرصدة المورّدين.'
              : 'موظف الحجوزات: نظرة عامة، الحجوزات والطلبات، وأرصدة المورّدين (عرض فقط). لا يسجّل استردادًا ولا يشحن أو يعيد رصيد المورّد.'}
          </p>
        </fieldset>

        <p className="stf-note">لا يمكن إيقاف آخر مدير نظام نشط. حساب المالك ثابت ومحمي.</p>

        <div className="stf-form-actions">
          <button className="button primary" type="submit">
            <Icon name="check" />
            حفظ الموظف
          </button>
          <button className="button secondary" type="button" onClick={onClose}>
            إلغاء
          </button>
        </div>
      </form>
    </Drawer>
  );
}

