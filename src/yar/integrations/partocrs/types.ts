// AUTO-GENERATED from the PartoCRS OpenAPI file (swagger.json) — Flight operations only.
// Do not hand-edit; regenerate from the spec. Hotel endpoints are intentionally excluded.

export interface AirBaggages {
  FareSourceCode: string;
}

export interface AirBaggagesResponse {
  Success?: boolean;
  Error?: Error | null;
  BaggageInfoes?: Array<BaggageInfo> | null;
  Services?: Array<Service> | null;
}

export interface AirBook {
  FareSourceCode: string;
  ClientUniqueId?: string | null;
  MarkupForAdult?: number;
  MarkupForChild?: number;
  MarkupForInfant?: number;
  CancellationGuaranteeId?: number | null;
  TravelerInfo: TravelerInfo;
  PayLaterServiceId?: string | null;
}

export interface AirBookResponse {
  Success?: boolean;
  SearchId?: number | null;
  TktTimeLimit?: string | null;
  TktTimeLimitTimeZone?: string | null;
  Category?: AirQueueCategory | null;
  Status?: AirQueueStatus | null;
  UniqueId?: string | null;
  Error?: Error | null;
  PriceChange?: boolean;
  WarningMessage?: Array<string> | null;
}

export interface AirBookingData {
  UniqueId?: string | null;
  ClientUniqueId?: string | null;
}

export interface AirBookingDataResponse {
  UniqueId?: string | null;
  ParentUniqueId?: string | null;
  ClientUniqueId?: string | null;
  FareType?: FareType;
  BookedBy?: string | null;
  OrderBy?: string | null;
  Error?: Error | null;
  Success?: boolean;
  IsPov?: boolean;
  IsSelfTransfer?: boolean;
  TktTimeLimit?: string | null;
  TktTimeLimitTimeZone?: string | null;
  Category?: AirQueueCategory | null;
  Status?: AirQueueStatus | null;
  RefundMethod?: RefundMethod | null;
  TravelItinerary?: TravelItinerary | null;
  ValidatingAirlineCode?: string | null;
  DirectionInd?: AirTripType;
  OnlineCheckIn?: boolean;
  OnlineCheckInText?: string | null;
  BeforeTravelOnlineCheckingTime?: number;
  OnlineCheckingUrl?: string | null;
  SeatSelection?: boolean;
  BeforeTravelSeatSelectionTime?: number;
  SeatSelectionUrl?: string | null;
  AirRemark?: Array<string> | null;
  WaitQueue?: WaitQueueBookingDataResponse | null;
}

export interface AirBookingNotes {
  Notes: Array<string>;
  UniqueId: string;
}

export interface AirBookingNotesResponse {
  Error?: Error | null;
  Success?: boolean;
}

export interface AirCancel {
  UniqueId: string;
}

export interface AirCancelResponse {
  Error?: Error | null;
  Success?: boolean;
}

export enum AirEticketNumberStatus {
  Ticket = 1,
  Refund = 2,
  Void = 3,
  Unknown = 4,
  PendingRefund = 5,
}

export enum AirExtraServiceBehavior {
  GroupPax = 0,
  PerPax = 1,
  PerPaxInbound = 2,
  PerPaxOutbound = 3,
  GroupPaxInbound = 4,
  GroupPaxOutbound = 5,
}

export enum AirFareAnywhereResultSortType {
  PriceAscending = 0,
  DepartureDateAscending = 1,
}

export interface AirItineraryPayLater {
  HasPayLater?: boolean;
  FixedInitialPayment?: number | null;
  InitialPaymentPercentage?: number | null;
}

export interface AirItineraryPricingInfo {
  FareType?: FareType;
  ItinTotalFare?: ItinTotalFare | null;
  PtcFareBreakdown?: Array<PtcFareBreakdown> | null;
  FareInfoes?: Array<string> | null;
}

export interface AirLowFareSearch {
  PricingSourceType: PricingSourceType;
  RequestOption: RequestOption;
  AdultCount: number;
  ChildCount: number;
  InfantCount: number;
  TravelPreference?: TravelPreference | null;
  OriginDestinationInformations?: Array<OriginDestinationInformation> | null;
  IsGenuine?: boolean;
}

export interface AirLowFareSearchResponse {
  Success?: boolean;
  SearchId?: number;
  Error?: Error | null;
  PricedItineraries?: Array<PricedItinerary> | null;
}

export enum AirMealTypeServiceBehavior {
  GroupPaxPerSegment = 0,
  PerPaxPerSegment = 1,
}

export interface AirOrderTicket {
  UniqueId: string;
}

export interface AirOrderTicketResponse {
  Error?: Error | null;
  Success?: boolean;
  Category?: AirQueueCategory | null;
  Status?: AirQueueStatus | null;
}

export enum AirQueueCategory {
  Booked = 10,
  Waitlist = 12,
  TicketinProcess = 20,
  Ticketed = 21,
  Cancelled = 30,
  Exception = 40,
}

export enum AirQueueStatus {
  Booked = 10,
  Pending = 11,
  Waitlist = 12,
  TicketinProcess = 20,
  Ticketed = 21,
  TicketedChanged = 22,
  TicketedScheduleChange = 23,
  TicketedCancelled = 24,
  TicketedVoid = 25,
  Cancelled = 30,
  Exception = 40,
  Gateway = 41,
  Duplicate = 42,
}

export interface AirRefund {
  UniqueId: string;
  RefundType: RefundType;
  EticketNumbers?: Array<string> | null;
  RefundPaymentMode?: RefundPaymentMode;
}

export interface AirRefundDisplay {
  UniqueId: string;
}

export interface AirRefundDisplayResponse {
  Error?: Error | null;
  Success?: boolean;
  RefundType?: RefundType;
  EticketNumbers?: Array<RefundEticket> | null;
}

export interface AirRefundResponse {
  Error?: Error | null;
  Success?: boolean;
  RefundEticketNumbers?: Array<RefundEticket> | null;
}

export interface AirRevalidate {
  FareSourceCode: string;
}

export interface AirRevalidateResponse {
  Success?: boolean;
  SearchId?: number | null;
  Error?: Error | null;
  Services?: Array<Service> | null;
  MealTypeServices?: Array<MealTypeService> | null;
  SeatServices?: Array<SeatService> | null;
  PricedItinerary?: PricedItinerary | null;
  CancellationGuaranteeServices?: Array<CancellationGuaranteeService> | null;
  CancellationGuaranteeServiceInfo?: CancellationGuaranteeServiceInfo | null;
  NationalityReplacementOptions?: Array<PricedItineraryNationalityReplacementOption> | null;
}

export interface AirRuleDetailParsedItem {
  From?: string | null;
  To?: string | null;
  Value?: string | null;
  Unit?: string | null;
  NoShow?: boolean;
  NoGo?: boolean;
}

export interface AirRules {
  FareSourceCode?: string | null;
  UniqueId?: string | null;
}

export interface AirRulesResponse {
  Success?: boolean;
  Error?: Error | null;
  FareType?: FareType | null;
  FareRules?: Array<FareRule> | null;
}

export enum AirSeatServiceBehavior {
  PerPaxPerSegment = 1,
}

export interface AirTraveler {
  DateOfBirth: string;
  Gender: Gender;
  PassengerType: PassengerType;
  PassengerName: PassengerName;
  Passport: Passport;
  NationalId: string;
  Nationality?: string | null;
  ExtraServiceId?: Array<string> | null;
  MealTypeServiceId?: Array<string> | null;
  SeatServiceId?: Array<string> | null;
  FrequentFlyerNumber?: string | null;
  SeatPreference: SeatPreference;
  MealPreference: MealPreference;
  Wheelchair?: boolean;
  DestinationAddress?: string | null;
}

export enum AirTripType {
  OneWay = 1,
  Return = 2,
  Circle = 3,
  OpenJaw = 4,
}

export interface AutoReserveService {
  AutoReserveFee?: number;
  PassengerType?: PassengerType;
  PassengerFirstName?: string | null;
  PassengerMiddleName?: string | null;
  PassengerLastName?: string | null;
  PassengerPassportNumber?: string | null;
  PassengerNationalId?: string | null;
}

export interface BaggageInfo {
  Arrival?: string | null;
  Baggage?: string | null;
  Departure?: string | null;
  FlightNo?: string | null;
}

export interface BookingNote {
  Note?: string | null;
  Date?: string;
}

export enum CabinType {
  Y = 1,
  S = 2,
  C = 3,
  J = 4,
  F = 5,
  P = 6,
  Default = 100,
}

export interface CancellationGuaranteeService {
  CancellationGuaranteeId?: number;
  Amount?: number;
  PassengerType?: PassengerType;
  ValidDate?: string;
}

export interface CancellationGuaranteeServiceInfo {
  RecommendedCancellationAmount?: number | null;
  Services?: Array<CancellationGuaranteeService> | null;
}

export enum CombineRouteDirection {
  Outbound = 1,
  Inbound = 2,
}

export interface Customer {
  Gender?: Gender;
  PassengerType?: PassengerType;
  PassportNumber?: string | null;
  NationalId?: string | null;
  Nationality?: string | null;
  DateOfBirth?: string | null;
  PassportExpireDate?: string | null;
  PassportIssueCountry?: string | null;
  PassportIssueDate?: string | null;
  PaxName?: PassengerName | null;
}

export interface CustomerInfo {
  Customer?: Customer | null;
  ETickets?: string | null;
  ETicketNumbers?: Array<Eticket> | null;
}

export interface Error {
  Id?: string | null;
  Message?: string | null;
}

export interface Eticket {
  ETicketNumber?: string | null;
  EticketStatus?: AirEticketNumberStatus;
  IsRefunded?: boolean;
  DateOfIssue?: string;
  AirlinePnr?: string | null;
  TotalRefund?: number;
}

export interface FareFamily {
  FareFamilyComponents?: Array<FareFamilyComponent> | null;
}

export interface FareFamilyComponent {
  RateCategory?: string | null;
  Name?: string | null;
  CarrierAirlineCode?: string | null;
  Origin?: string | null;
  Destination?: string | null;
  Descriptions?: Array<FareFamilyDescription> | null;
}

export interface FareFamilyDescription {
  Indicator?: FareFamilyIndicator;
  AirlineCode?: string | null;
  ServiceType?: FareFamilyServiceType;
  Details?: string | null;
}

export enum FareFamilyIndicator {
  None = 1,
  Included = 10,
  AtCharge = 20,
  NotOffered = 30,
}

export enum FareFamilyServiceType {
  Default = 0,
  Baggage = 1,
  MealBeverage = 2,
  LightMilesAccural = 3,
  ChoiceStandardSeat = 4,
  UpgradeEligibility = 5,
  ChangeableTicket = 6,
  RefundableTicket = 7,
  SkyPriority = 8,
  GoShow = 9,
  CashUpgrade = 10,
}

export interface FareRule {
  Airline?: string | null;
  CityPair?: string | null;
  RuleDetails?: Array<RuleDetail> | null;
}

export enum FareType {
  Default = 1,
  Publish = 2,
  Private = 3,
  WebFare = 4,
  NegoCat35 = 5,
  NegoCorporate = 6,
  AmadeusNegoCorporate = 7,
  PrivateCat15 = 8,
  AmadeusNego = 9,
  NetFare = 10,
}

export interface FlightAmenities {
  Description?: string | null;
  Value?: number;
  ClassName?: string | null;
}

export interface FlightAutoReserveBookResponse {
  TimeToFlyInHours?: number;
  PreferredMinimumBaggageKg?: number | null;
  AllowedTimeSlots?: Array<ServiceFlightAutoReserveTimeSlot> | null;
  ItinerarySelection?: Array<ServiceFlightAutoReserveItinerarySelection> | null;
}

export interface FlightAutoReserveOptionResponse {
  AdultCount?: number;
  ChildCount?: number;
  InfantCount?: number;
  CabinType?: CabinType | null;
  MaxStopsQuantity?: MaxStopsQuantity | null;
  AirTripType?: AirTripType | null;
  OriginDestinationInformations?: Array<OriginDestinationInformation> | null;
}

export interface FlightSegment {
  DepartureDateTime?: string;
  ArrivalDateTime?: string;
  StopQuantity?: number;
  /** Flight Number */
  FlightNumber?: string | null;
  ResBookDesigCode?: string | null;
  JourneyDuration?: string | null;
  JourneyDurationPerMinute?: number;
  ConnectionTimePerMinute?: number;
  DepartureAirportLocationCode?: string | null;
  ArrivalAirportLocationCode?: string | null;
  MarketingAirlineCode?: string | null;
  CabinClassCode?: CabinType;
  OperatingAirline?: OperatingAirline | null;
  SeatsRemaining?: number | null;
  IsCharter?: boolean;
  IsReturn?: boolean;
  Baggage?: string | null;
  DepartureTerminal?: string | null;
  ArrivalTerminal?: string | null;
  TechnicalStops?: Array<TechnicalStop> | null;
  FlightAmenities?: Array<FlightAmenities> | null;
  HubViaDescription?: string | null;
}

export enum Gender {
  Male = 0,
  Female = 1,
}

export interface ItinTotalFare {
  BaseFare?: number;
  TotalFare?: number;
  TotalCommission?: number;
  TotalTax?: number;
  ServiceTax?: number;
  Currency?: string | null;
}

export interface ItineraryFareFamily {
  FareFamilyComponents?: Array<FareFamilyComponent> | null;
}

export interface ItineraryInfo {
  ItineraryPricing?: ItineraryPricing | null;
  CustomerInfoes?: Array<CustomerInfo> | null;
  ReservationItems?: Array<ReservationItem> | null;
  TripDetailPtcFareBreakdowns?: Array<TripDetailPtcFareBreakdown> | null;
  PhoneNumber?: string | null;
  Email?: string | null;
  ItineraryFareFamily?: ItineraryFareFamily | null;
  InstructionDescription?: string | null;
}

export interface ItineraryPricing {
  BaseFare?: number;
  ServiceTax?: number | null;
  TotalTax?: number | null;
  TotalFare?: number;
  TotalCommission?: number;
  Currency?: string | null;
  PriceRangeDifference?: number;
  RangeLimitDifference?: number;
}

export enum MaxStopsQuantity {
  All = 0,
  Direct = 2,
}

export enum MealPreference {
  Any = 0,
  Hfml = 1,
  Lpml = 2,
  Orml = 3,
  Prml = 4,
  Vjml = 5,
  Voml = 6,
  Avml = 7,
  Bbml = 8,
  Blml = 9,
  Fpml = 10,
  Gfml = 11,
  Lfml = 12,
  Lsml = 13,
  Nlml = 14,
  Rvml = 15,
  Vvml = 16,
  Vlml = 17,
  Ksml = 18,
  Chml = 19,
  Moml = 20,
  Sfml = 21,
  Hnml = 22,
  Pfml = 23,
  Jnml = 24,
  Dbml = 25,
  Ffml = 26,
  Spmlj = 27,
  Vgml = 28,
}

export interface MealTypeService {
  PassengerFirstName?: string | null;
  PassengerMiddleName?: string | null;
  PassengerPassportNumber?: string | null;
  PassengerNationalId?: string | null;
  PassengerLastName?: string | null;
  FlightNumber?: string | null;
  Description?: string | null;
  MealTypeServiceId?: string | null;
  Behavior?: AirMealTypeServiceBehavior;
  MealTypeServiceCost?: MealTypeServiceCost | null;
}

export interface MealTypeServiceCost {
  Amount?: number;
  Currency?: string | null;
}

export enum NationalityEligibilityType {
  Only = 1,
  Except = 2,
}

export enum NonRefundableType {
  None = 0,
  NONRefundable = 1,
  NONRefundableAfterDeparture = 2,
  NONRefundableBeforeDeparture = 3,
}

export interface OperatingAirline {
  Code?: string | null;
  FlightNumber?: string | null;
  Equipment?: string | null;
  EquipmentName?: string | null;
}

export interface OriginDestinationInformation {
  DepartureDateTime: string;
  DestinationLocationCode: string;
  DestinationType: SearchLocationType;
  OriginLocationCode: string;
  OriginType: SearchLocationType;
}

export interface OriginDestinationOption {
  JourneyDurationPerMinute?: number;
  ConnectionTimePerMinute?: number;
  FlightSegments?: Array<FlightSegment> | null;
}

export interface PassengerFare {
  BaseFare?: number;
  TotalFare?: number;
  Commission?: number;
  ServiceTax?: number;
  Taxes?: Array<Tax> | null;
  Currency?: string | null;
  PriceCitizen?: number;
  PriceRangeDifference?: number;
  CommissionCashBack?: boolean;
  RangeLimitDifference?: number;
}

export interface PassengerName {
  PassengerFirstName: string;
  PassengerMiddleName: string;
  PassengerLastName: string;
  PassengerTitle: PassengerTitle;
}

export enum PassengerTitle {
  Mr = 0,
  Mrs = 1,
  Ms = 2,
  Miss = 3,
  Mstr = 4,
}

export enum PassengerType {
  SeniorAdt = 0,
  Adt = 1,
  Chd = 2,
  Inf = 3,
}

export interface PassengerTypeQuantity {
  PassengerType?: PassengerType;
  Quantity?: number;
}

export interface Passport {
  Country?: string | null;
  ExpiryDate?: string | null;
  IssueDate?: string | null;
  PassportNumber?: string | null;
}

export interface PricedItinerary {
  IsPassportMandatory?: boolean;
  IsDestinationAddressMandatory?: boolean;
  CustomerAddressMaxLength?: number;
  IsPassportIssueDateMandatory?: boolean;
  HasFareFamilies?: boolean;
  DirectionInd?: AirTripType;
  NonRefundableType?: NonRefundableType;
  RefundMethod?: RefundMethod;
  ValidatingAirlineCode?: string | null;
  FareSourceCode?: string | null;
  AirItineraryPricingInfo?: AirItineraryPricingInfo | null;
  OriginDestinationOptions?: Array<OriginDestinationOption> | null;
  IsPassportNameWithSpace?: boolean;
  FareFamily?: FareFamily | null;
  PricedItineraryNationality?: PricedItineraryNationality;
  NationalityEligibilityList?: Array<string> | null;
  NationalityEligibilityType?: NationalityEligibilityType | null;
  HasAmenities?: boolean;
  IsSeatServiceMandatory?: boolean;
  IsMealServiceMandatory?: boolean;
  VisaRequirements?: Array<VisaRequirementList> | null;
  IsClosed?: boolean;
  IsAutoReserved?: boolean;
  PayLater?: AirItineraryPayLater | null;
  Labels?: Array<string> | null;
  HasCancellationGuarantee?: boolean;
  IsSelfTransfer?: boolean;
  IsPov?: boolean;
  InstructionDescription?: string | null;
  FlightGroupId?: string | null;
  FareFamilyKey?: string | null;
  ItineraryFareFamilies?: Array<PricedItinerary> | null;
}

export enum PricedItineraryNationality {
  NationalityDoesNotMatter = 0,
  ForIranian = 1,
  ForForeigners = 2,
}

export interface PricedItineraryNationalityReplacementOption {
  FareSourceCode?: string | null;
  PricedItineraryNationality?: PricedItineraryNationality;
  TotalFare?: number;
  ChangePrice?: boolean;
}

export enum PricingSourceType {
  All = 0,
  Private = 1,
  Publish = 2,
  WebFare = 3,
}

export interface PtcFareBreakdown {
  PassengerFare?: PassengerFare | null;
  PassengerTypeQuantity?: PassengerTypeQuantity | null;
  RouteFareBreakdown?: Array<RouteFareBreakdown> | null;
}

export interface RefundEticket {
  ETicketNumber?: string | null;
  EticketStatus?: AirEticketNumberStatus;
  IsRefunded?: boolean;
  AirlinePnr?: string | null;
  PenaltyAmount?: number | null;
  IsNonRefundable?: boolean;
  Route?: string | null;
}

export enum RefundMethod {
  Offline = 0,
  Online = 1,
  NonRefundable = 2,
}

export enum RefundPaymentMode {
  UnKnown = 0,
  Credit = 1,
  BankAccount = 2,
}

export enum RefundType {
  Eticket = 1,
  Segment = 2,
  Pnr = 3,
}

export enum RequestOption {
  Fifty = 0,
  Hundred = 1,
  TwoHundred = 2,
  All = 3,
}

export interface ReservationItem {
  AirEquipmentType?: string | null;
  AirlinePnr?: string | null;
  ArrivalAirportLocationCode?: string | null;
  ArrivalDateTime?: string;
  ArrivalTerminal?: string | null;
  Baggage?: string | null;
  DepartureAirportLocationCode?: string | null;
  DepartureDateTime?: string;
  DepartureTerminal?: string | null;
  FlightNumber?: string | null;
  JourneyDuration?: string | null;
  JourneyDurationPerMinute?: number;
  MarketingAirlineCode?: string | null;
  OperatingAirlineCode?: string | null;
  ResBookDesigCode?: string | null;
  StopQuantity?: number;
  IsCharter?: boolean;
  TechnicalStops?: Array<TechnicalStop> | null;
  IsReturn?: boolean;
  CabinClassCode?: CabinType;
  HubViaDescription?: string | null;
}

export interface RouteFareBreakdown {
  Route?: string | null;
  Origin?: string | null;
  Destination?: string | null;
  RouteDirection?: CombineRouteDirection;
  PassengerFare?: PassengerFare | null;
}

export interface RuleDetail {
  Category?: string | null;
  Rules?: string | null;
  RuleItemsParsed?: Array<AirRuleDetailParsedItem> | null;
  MessageDirection?: string | null;
}

export enum SearchLocationType {
  None = 0,
  City = 1,
  Airport = 2,
  RailStation = 3,
  Hotel = 4,
  Country = 5,
}

export enum SeatPreference {
  Any = 0,
  A = 1,
  W = 2,
}

export interface SeatService {
  PassengerFirstName?: string | null;
  PassengerMiddleName?: string | null;
  PassengerLastName?: string | null;
  PassengerPassportNumber?: string | null;
  PassengerNationalId?: string | null;
  FlightNumber?: string | null;
  Description?: string | null;
  SeatServiceId?: string | null;
  Behavior?: AirSeatServiceBehavior;
  SeatServiceCost?: SeatServiceCost | null;
}

export interface SeatServiceCost {
  Amount?: number;
  Currency?: string | null;
}

export interface Service {
  PassengerFirstName?: string | null;
  PassengerMiddleName?: string | null;
  PassengerPassportNumber?: string | null;
  PassengerNationalId?: string | null;
  PassengerLastName?: string | null;
  Description?: string | null;
  ServiceId?: string | null;
  Behavior?: AirExtraServiceBehavior;
  ServiceCost?: ServiceCost | null;
}

export interface ServiceCost {
  Amount?: number;
  Currency?: string | null;
}

export interface ServiceFlightAutoReserveItinerarySelection {
  ValidatingAirlineCode?: string | null;
  FlightSegments?: Array<ServiceFlightSegmentDetails> | null;
}

export interface ServiceFlightAutoReserveTimeSlot {
  Start?: string;
  End?: string;
}

export interface ServiceFlightSegmentDetails {
  MarketingAirline?: string | null;
  DepartureAirport?: string | null;
  ArrivalAirport?: string | null;
  FlightNumber?: string | null;
  DepartureDateTime?: string | null;
}

export interface Tax {
  Amount?: number;
  Currency?: string | null;
}

export interface TechnicalStop {
  ArrivalAirport?: string | null;
  ArrivalDateTime?: string;
  DepartureDateTime?: string;
}

export interface TravelItinerary {
  ItineraryInfo?: ItineraryInfo | null;
  BookingNotes?: Array<BookingNote> | null;
  Services?: Array<Service> | null;
  MealTypeServices?: Array<MealTypeService> | null;
  SeatServices?: Array<SeatService> | null;
  CancellationGuaranteeServices?: Array<CancellationGuaranteeService> | null;
  AutoReserveServices?: Array<AutoReserveService> | null;
}

export interface TravelPreference {
  CabinType: CabinType;
  MaxStopsQuantity: MaxStopsQuantity;
  AirTripType: AirTripType;
  VendorExcludeCodes?: Array<string> | null;
  VendorPreferenceCodes?: Array<string> | null;
  AirFareAnywhereResultSortType?: AirFareAnywhereResultSortType;
}

export interface TravelerInfo {
  CountryCodePrefix?: string | null;
  PhoneNumber?: string | null;
  Email?: string | null;
  OwnerCountryCodePrefix?: string | null;
  OwnerPhoneNumber?: string | null;
  OwnerEmail?: string | null;
  AirTravelers?: Array<AirTraveler> | null;
}

export interface TripDetailPassengerFare {
  BaseFare?: number;
  ServiceTax?: number | null;
  Tax?: number | null;
  TotalFare?: number;
  Commission?: number;
  Currency?: string | null;
  PriceRangeDifference?: number;
  CommissionCashBack?: boolean;
  RangeLimitDifference?: number;
}

export interface TripDetailPtcFareBreakdown {
  PassengerTypeQuantity?: PassengerTypeQuantity | null;
  TripDetailPassengerFare?: TripDetailPassengerFare | null;
  RouteFareBreakdown?: Array<TripDetailRouteFareBreakdown> | null;
}

export interface TripDetailRouteFareBreakdown {
  Route?: string | null;
  Origin?: string | null;
  Destination?: string | null;
  RouteDirection?: CombineRouteDirection;
  TripDetailPassengerFare?: TripDetailPassengerFare | null;
}

export interface VisaRequirementList {
  Name?: string | null;
}

export interface WaitQueueBookingDataResponse {
  Conditions?: WaitQueueConditionResponse | null;
}

export interface WaitQueueConditionResponse {
  FlightAutoReserveBook?: FlightAutoReserveBookResponse | null;
  FlightAutoReserveOption?: FlightAutoReserveOptionResponse | null;
}

/** Flight operation → [request, response] types, exactly as declared in swagger.json. */
export interface PartoFlightOperations {
  /** Searching method for city pairs — POST /api/Air/AirLowFareSearch */
  AirLowFareSearch: { request: AirLowFareSearch; response: AirLowFareSearchResponse };
  /** Checking the validity of the fares — POST /api/Air/AirRevalidate */
  AirRevalidate: { request: AirRevalidate; response: AirRevalidateResponse };
  /** Retrieving Fare Rule from GDS — POST /api/Air/AirRules */
  AirRules: { request: AirRules; response: AirRulesResponse };
  /** Retrieving Baggage Rule from GDS — POST /api/Air/AirBaggages */
  AirBaggages: { request: AirBaggages; response: AirBaggagesResponse };
  /** For making reservation (Issuing WebFare tickets) — POST /api/Air/AirBook */
  AirBook: { request: AirBook; response: AirBookResponse };
  /** Issuing the reservation — POST /api/Air/AirOrderTicket */
  AirOrderTicket: { request: AirOrderTicket; response: AirOrderTicketResponse };
  /** Retrieve the booking details — POST /api/Air/AirBookingData */
  AirBookingData: { request: AirBookingData; response: AirBookingDataResponse };
  /** Cancelling reserved PNR — POST /api/Air/AirCancel */
  AirCancel: { request: AirCancel; response: AirCancelResponse };
  /** Online Refund Display — POST /api/Air/AirRefundDisplay */
  AirRefundDisplay: { request: AirRefundDisplay; response: AirRefundDisplayResponse };
  /** Online Refund — POST /api/Air/AirRefund */
  AirRefund: { request: AirRefund; response: AirRefundResponse };
  /** Note for the reservation — POST /api/Air/AirAddBookingNotes */
  AirAddBookingNotes: { request: AirBookingNotes; response: AirBookingNotesResponse };
}

export type PartoFlightOperation = keyof PartoFlightOperations;

export const PARTO_FLIGHT_OPERATIONS = ["AirLowFareSearch", "AirRevalidate", "AirRules", "AirBaggages", "AirBook", "AirOrderTicket", "AirBookingData", "AirCancel", "AirRefundDisplay", "AirRefund", "AirAddBookingNotes"] as const;
