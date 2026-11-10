export interface FxEntry { id: string; date: string; rate: number; setAt: string; setById: string; setByName: string; note: string }
export const FX_KEY: string;
export const RATE_MIN: number;
export const RATE_MAX: number;
export function baghdadDate(date?: Date): string;
export function normalizeRate(value: unknown): number;
export function hydrateHistory(input: unknown): FxEntry[];
export function rateFor(history: unknown, date: string): FxEntry | null;
export function latestRate(history: unknown): FxEntry | null;
export function needsDailyUpdate(history: unknown, date: string): boolean;
export function addRate(history: unknown, input: { rate: unknown; date: string; setAt?: string; setById?: string; setByName?: string; note?: string }): FxEntry[];
export function usdToIqd(usd: number, rate: number): number;
export function iqdToUsd(iqd: number, rate: number): number;
