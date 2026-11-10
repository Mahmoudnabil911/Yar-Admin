type Option = { code: string; ar: string; en: string; [k: string]: unknown };
type Category = { code: string; ar: string; en: string; items: Option[] };
export const HOTEL_TYPES: Option[]; export const FACILITY_CATEGORIES: Category[]; export const ROOM_AMENITY_CATEGORIES: Category[];
export const ROOM_CATEGORIES: Option[]; export const VIEW_TYPES: Option[]; export const BED_TYPES: Option[]; export const MEAL_PLANS: Option[];
export const RATE_TYPES: Option[]; export const PRICE_BASES: Option[]; export const REFUNDABILITY: Option[]; export const FACILITY_CHARGES: Option[];
export const HOTEL_GALLERY_CATEGORIES: Option[]; export const ROOM_GALLERY_CATEGORIES: Option[]; export const SECOND_MEALS: Option[]; export const HOTEL_STATUSES: Option[];
export const ALL_FACILITIES: Option[]; export const ALL_ROOM_AMENITIES: Option[];
export function optionLabel(listName: string, code: string, lang?: string): string;
export function hotelTranslations(): Record<string, string>;
