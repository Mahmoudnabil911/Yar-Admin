// Initialize all data models in proper dependency order
import './mock-data.js';
import './catalog-hotels.js';
import './catalog-packages.js';
import './catalog-services.js';
import './catalog-tours.js';
import './operations-model.js';
import './supplier-credit-model.js';
import './final-demo.js';
import './pricing-engine.js';
import './staff-model.js';
import './audience-data.js';
import './behavior-data.js';
import './content-model.js';

export const mockData = globalThis.YAR_DEMO;
export const catalogTypes = globalThis.YAR_CATALOG_TYPES;
export const operationsModel = globalThis.YAROperationsModel;
export const supplierCreditModel = globalThis.YARSupplierCreditModel;
export const finalDemo = globalThis.YARFinalDemo || globalThis.YAR_FINAL_DEMO;
export const pricingEngine = globalThis.YARPricingEngine;
export const staffModel = globalThis.YARStaffModel;
export const audienceData = globalThis.YARAudienceData;
export const behaviorData = globalThis.YARBehaviorData;
export const contentModel = globalThis.YARContentModel;

