import React from "react";
import YarLogo from "@/components/YarLogo";
import {usePrefs} from "../../i18n/prefs";
import { Icon } from "../ui/Icon";
import { canSeePage } from "../../auth/access";
import { useSession } from "../../auth/useSession";
import { Mail } from 'lucide-react';

const workspaceNav = [
  { key: "overview", label: "نظرة عامة", icon: "home" },
  { key: "bookings", label: "الحجوزات والطلبات", icon: "ticket", badgeKey: "awaiting" },
  { key: "audience", label: "مستخدمو التطبيق", icon: "user" },
  { key: "supplier-credit", label: "أرصدة المورّدين", icon: "wallet" },
  { key: "inbox", label: "رسائل العملاء", icon: "mail" },
  { key: "reports", label: "التقارير", icon: "chart" },
];

const servicesNav = [
  { key: "hotels", label: "إدارة الفنادق", icon: "hotel" },
  { key: "packages", label: "إدارة الباقات", icon: "bag" },
  { key: "cars", label: "إدارة السيارات", icon: "car" },
  { key: "tours", label: "إدارة الجولات", icon: "map" },
  { key: "providers", label: "مزوّدو الخدمة", icon: "swap" },
  { key: "provider-ops", label: "ربط الطيران وواجهات API", icon: "globe" },
];

// Electronic payment gateways were removed from the active app (historical data is kept).
const systemNav = [
  { key: "pricing", label: "الأسعار والخصومات", icon: "tag" },
  { key: "content", label: "محتوى التطبيق", icon: "layers" },
  { key: "staff", label: "الموظفون والصلاحيات", icon: "user" },
];

export const ROLE_LABELS = { admin: "مدير النظام", booking_employee: "موظف الاستقبال والحجوزات" };

export function Sidebar({ currentPage, onNavigate, awaitingCount = 0, isOpen, onClose, onSignOut }) {
  const session = useSession();
  const {lang}=usePrefs();
  const role = session?.role;

  const renderNavGroup = (label, items, extraClass = "") => {
    const visible = items.filter(i => canSeePage(i.key, role));
    if (!visible.length) return null;
    return (
      <>
        <div className={`sidebar-label ${extraClass}`}>{label}</div>
        <nav className="nav-list">
          {visible.map(item => {
            const isActive = currentPage === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`nav-item ${isActive ? "active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                data-nav={item.key}
                onClick={() => { onNavigate(item.key); onClose?.(); }}
              >
                <i data-icon={item.icon}>{item.key==='inbox'?<Mail size={20}/>:<Icon name={item.icon} />}</i>
                {item.label}
                {isActive && <span className="active-dot"></span>}
                {item.badgeKey === "awaiting" && awaitingCount > 0 && (
                  <span className="nav-count" id="awaiting-nav">{awaitingCount}</span>
                )}
              </button>
            );
          })}
        </nav>
      </>
    );
  };

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`} id="sidebar" aria-label="التنقل الرئيسي">
      <div className="brand">
        <YarLogo lang={lang} className="sidebar-logo"/>
        <button type="button" className="icon-button sidebar-close" aria-label="إغلاق" onClick={onClose}>
          <i data-icon="close"><Icon name="close" /></i>
        </button>
      </div>

      {renderNavGroup("مساحة العمل", workspaceNav)}
      {renderNavGroup("إدارة الخدمات", servicesNav, "second-label")}
      {renderNavGroup("إدارة النظام", systemNav, "second-label")}

      <div className="sidebar-bottom">
        <div className="profile">
          <span className="avatar" data-no-translate>{session?.name?.slice(0, 1) || "?"}</span>
          <div>
            <strong data-no-translate>{session?.name}</strong>
            <small>{ROLE_LABELS[role] || ""}</small>
          </div>
          <button type="button" className="profile-more" aria-label="تسجيل الخروج" title="تسجيل الخروج" id="profile-button" onClick={onSignOut}>
            <i data-icon="back"><Icon name="back" /></i>
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
