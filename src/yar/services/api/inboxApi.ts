/**
 * YAR Odoo 18 Inbox & Communications API client
 * Endpoints:
 * - GET   /api/v1/inbox                           (API 120 | List inbox inquiries)
 * - POST  /api/v1/inbox                           (API 121 | Submit customer inquiry)
 * - POST  /api/v1/inbox/:inquiry_id/reply         (API 122 | Reply to inquiry / internal note)
 * - PATCH /api/v1/inbox/:inquiry_id/status        (API 123 | Update inquiry status)
 * - GET   /api/v1/notifications                  (API 124 | List persistent notifications)
 * - POST  /api/v1/notifications/:id/read          (API 125 | Mark notification as read)
 * - POST  /api/v1/public/contact                  (API 126 | Send public contact message)
 */

import { getApiBaseUrl, fetchWithAuth, ApiAuthError } from './authApi';

export interface InquiryReply {
  id?: number | string;
  message_id?: number | string;
  author?: string;
  author_name?: string;
  body?: string;
  content?: string;
  internal?: boolean;
  at?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface InquiryItem {
  id: number | string;
  reference?: string;
  subject: string;
  message?: string;
  body?: string;
  category?: 'general' | 'bookings' | 'flights' | 'hotels' | 'refund' | 'technical' | 'account' | 'other' | string;
  status: 'new' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
  booking_id?: number | null;
  booking_reference?: string | null;
  customer_id?: number | null;
  customer_name?: string;
  name?: string;
  fullName?: string;
  fullNameEn?: string;
  customer_phone?: string;
  phone?: string;
  phoneE164?: string;
  customer_email?: string;
  email?: string;
  created_at?: string;
  createdAt?: string;
  updated_at?: string;
  updatedAt?: string;
  assigned_to?: number | string | null;
  assignedTo?: string | null;
  replies?: InquiryReply[];
  notes?: InquiryReply[];
  read_by?: string[];
  readBy?: string[];
  activity?: Array<{ id: string; actor: string; action: string; at: string }>;
  restricted?: boolean;
  [key: string]: unknown;
}

export interface SubmitInquiryPayload {
  subject: string;
  message: string;
  category?: string;
  booking_id?: number;
}

export interface SubmitInquiryResponse {
  id: number;
  status: string;
  [key: string]: unknown;
}

export interface ReplyInquiryPayload {
  body: string;
  internal?: boolean;
}

export interface ReplyInquiryResponse {
  message_id: number;
  [key: string]: unknown;
}

export interface UpdateInquiryStatusPayload {
  status: 'new' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed';
}

export interface UpdateInquiryStatusResponse {
  id: number;
  status: string;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: number | string;
  title?: string;
  message?: string;
  body?: string;
  read?: boolean;
  is_read?: boolean;
  created_at?: string;
  at?: string;
  type?: string;
  [key: string]: unknown;
}

export interface PublicContactPayload {
  name: string;
  subject: string;
  message: string;
  phone?: string;
  email?: string;
}

export interface PublicContactResponse {
  id: number;
  status: string;
  [key: string]: unknown;
}

async function handleInboxResponse<T>(res: Response, fallback = 'Operation failed'): Promise<T> {
  let envelope: any;
  try {
    envelope = await res.json();
  } catch {
    throw new ApiAuthError('تعذر قراءة استجابة الخادم.', fallback, 'parse_error', res.status);
  }
  if (!res.ok || !envelope?.success) {
    const code = envelope?.error?.code || `http_${res.status}`;
    const ar = envelope?.message?.ar || fallback;
    const en = envelope?.message?.en || fallback;
    throw new ApiAuthError(ar, en, code, res.status);
  }
  return envelope.data as T;
}

export const inboxApi = {
  /**
   * API 120 | List inbox inquiries | قائمة رسائل الدعم
   * GET /api/v1/inbox
   * Access: Admin (JWT) + Booking Employee (JWT) + Customer (JWT)
   */
  async getInquiries(): Promise<{ items: InquiryItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/inbox`, {
      method: 'GET',
    });
    return await handleInboxResponse<{ items: InquiryItem[] }>(res, 'تعذر جلب رسائل الدعم من الخادم.');
  },

  /**
   * API 121 | Submit customer inquiry | إنشاء تذكرة دعم
   * POST /api/v1/inbox
   * Access: Admin (JWT) + Booking Employee (JWT) + Customer (JWT)
   */
  async submitInquiry(payload: SubmitInquiryPayload): Promise<SubmitInquiryResponse> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/inbox`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await handleInboxResponse<SubmitInquiryResponse>(res, 'تعذر إرسال تذكرة الدعم إلى الخادم.');
  },

  /**
   * API 122 | Reply to inquiry | الرد على رسالة الدعم
   * POST /api/v1/inbox/{inquiry_id}/reply
   * Access: Admin (JWT) + Booking Employee (JWT) + Customer (JWT)
   */
  async replyToInquiry(inquiryId: number | string, payload: ReplyInquiryPayload): Promise<ReplyInquiryResponse> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/inbox/${encodeURIComponent(inquiryId)}/reply`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return await handleInboxResponse<ReplyInquiryResponse>(res, 'تعذر إرسال الرد على الرسالة.');
  },

  /**
   * API 123 | Update inquiry status | تغيير حالة طلب الدعم
   * PATCH /api/v1/inbox/{inquiry_id}/status
   * Access: Admin (JWT) + Booking Employee (JWT)
   */
  async updateInquiryStatus(
    inquiryId: number | string,
    status: 'new' | 'in_progress' | 'waiting_for_customer' | 'resolved' | 'closed'
  ): Promise<UpdateInquiryStatusResponse> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/inbox/${encodeURIComponent(inquiryId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return await handleInboxResponse<UpdateInquiryStatusResponse>(res, 'تعذر تحديث حالة تذكرة الدعم.');
  },

  /**
   * API 124 | List persistent notifications | الإشعارات الخاصة بالحساب
   * GET /api/v1/notifications
   * Access: Admin (JWT) + Booking Employee (JWT) + Customer (JWT)
   */
  async getNotifications(): Promise<{ items: NotificationItem[] }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/notifications`, {
      method: 'GET',
    });
    return await handleInboxResponse<{ items: NotificationItem[] }>(res, 'تعذر جلب إشعارات الحساب من الخادم.');
  },

  /**
   * API 125 | Mark notification as read | تعيين الإشعار مقروءًا
   * POST /api/v1/notifications/{notification_id}/read
   * Access: Admin (JWT) + Booking Employee (JWT) + Customer (JWT)
   */
  async markNotificationRead(notificationId: number | string): Promise<{ read: boolean }> {
    const baseUrl = getApiBaseUrl();
    const res = await fetchWithAuth(`${baseUrl}/api/v1/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: 'POST',
    });
    return await handleInboxResponse<{ read: boolean }>(res, 'تعذر تعيين الإشعار كمقروء.');
  },

  /**
   * API 126 | Send public contact message | إرسال رسالة تواصل عامة
   * POST /api/v1/public/contact
   * Access: Public (Guest)
   */
  async submitPublicContact(payload: PublicContactPayload): Promise<PublicContactResponse> {
    const baseUrl = getApiBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/public/contact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    return await handleInboxResponse<PublicContactResponse>(res, 'تعذر إرسال رسالة التواصل.');
  },
};

