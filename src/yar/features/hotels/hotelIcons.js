// Meaningful icon for every hotel option code (facilities, room amenities, views, beds, meals…).
import {
  Wifi, Globe, BriefcaseBusiness, WavesLadder, ThermometerSun, Baby, Infinity as InfinityIcon, Building2, Gem, ConciergeBell,
  Dumbbell, Sparkles, Flame, CloudFog, Bath, HandHeart, Scissors, Leaf, Utensils, UtensilsCrossed, Coffee, CupSoda, Croissant,
  Soup, Clock, Luggage, ArrowLeftRight, WashingMachine, Shirt, BrushCleaning, Map, AlarmClock, Languages, CircleParking,
  SquareParking, KeyRound, Car, PlaneLanding, BusFront, CarFront, ToyBrick, Puzzle, PartyPopper, Gamepad2, Umbrella, TreePalm,
  Trees, ArrowUpDown, Accessibility, Cctv, ShieldCheck, FireExtinguisher, AirVent, Heater, VolumeX, Blinds, Archive, LampDesk,
  Armchair, Sofa, DoorOpen, Tv, MonitorPlay, SatelliteDish, Phone, Usb, ShowerHead, Wind, Footprints, Package, Refrigerator,
  Wine, GlassWater, CookingPot, ChefHat, Microwave, Fence, Sun, Vault, LockKeyhole, BedDouble, BedSingle, Bed, Mountain,
  Landmark, Ship, Eye, EyeOff, Building, House, Hotel, Store, Castle, Tent, Waves, Sailboat, TreeDeciduous, Warehouse,
  Ban, Sunrise, Moon, Star, Crown, Layers, Home, Image, Camera, Grid2x2, Radar, Siren, Rows3,
} from 'lucide-react';

export const FACILITY_ICONS = {
  free_wifi: Wifi, paid_wifi: Wifi, public_wifi: Globe, business_center: BriefcaseBusiness,
  outdoor_pool: WavesLadder, indoor_pool: WavesLadder, heated_pool: ThermometerSun, kids_pool: Baby, infinity_pool: InfinityIcon,
  rooftop_pool: Building2, private_pool_facilities: Gem, poolside_service: ConciergeBell,
  gym: Dumbbell, spa: Sparkles, sauna: Flame, steam_room: CloudFog, jacuzzi: Bath, massage: HandHeart, beauty_salon: Scissors, wellness_center: Leaf,
  restaurant: Utensils, multiple_restaurants: UtensilsCrossed, cafe: Coffee, coffee_shop: CupSoda, breakfast_restaurant: Croissant,
  buffet_restaurant: Soup, room_service: ConciergeBell, room_service_24h: Clock,
  reception_24h: ConciergeBell, concierge: KeyRound, luggage_storage: Luggage, currency_exchange: ArrowLeftRight, laundry: WashingMachine,
  dry_cleaning: Shirt, housekeeping: BrushCleaning, tour_desk: Map, wake_up: AlarmClock, multilingual_staff: Languages,
  free_parking: CircleParking, paid_parking: SquareParking, private_parking: SquareParking, valet_parking: KeyRound,
  airport_shuttle: PlaneLanding, shuttle: BusFront, car_rental: CarFront,
  kids_club: ToyBrick, playground: Puzzle, babysitting: Baby, entertainment: PartyPopper, games_room: Gamepad2,
  private_beach: Umbrella, beach_access: TreePalm, garden: Trees,
  elevator: ArrowUpDown, wheelchair: Accessibility, accessible_rooms: Accessibility, accessible_parking: Car, cctv: Cctv,
  security: ShieldCheck, smoke_detectors: Siren, fire_safety: FireExtinguisher,
};

export const ROOM_AMENITY_ICONS = {
  air_conditioning: AirVent, heating: Heater, soundproofing: VolumeX, blackout_curtains: Blinds, wardrobe: Archive, desk: LampDesk,
  seating_area: Armchair, sofa: Sofa, connecting_door: DoorOpen,
  room_wifi: Wifi, tv: Tv, smart_tv: MonitorPlay, satellite: SatelliteDish, telephone: Phone, usb_ports: Usb,
  private_bathroom: Bath, shower: ShowerHead, bathtub: Bath, jacuzzi_bath: Waves, hair_dryer: Wind, bathrobes: Shirt,
  slippers: Footprints, toiletries: Package, towels: Layers,
  mini_fridge: Refrigerator, minibar: Wine, kettle: Coffee, coffee_machine: Coffee, water: GlassWater, kitchenette: CookingPot,
  full_kitchen: ChefHat, microwave: Microwave,
  balcony: Fence, terrace: Sun, private_garden: Trees, private_pool: WavesLadder, pool_access: WavesLadder, outdoor_seating: Armchair,
  safe: Vault, smoke_detector: Radar, electronic_lock: LockKeyhole,
};

export const CATEGORY_ICONS = {
  internet: Wifi, pools: WavesLadder, wellness: Sparkles, dining: Utensils, guest: ConciergeBell, transport: Car, family: ToyBrick, safety: ShieldCheck,
  comfort: Armchair, media: Tv, bathroom: Bath, food: Coffee, outdoor: Fence, room_safety: Vault,
};

export const VIEW_ICONS = {
  sea: Waves, partial_sea: Waves, ocean: Sailboat, garden: Trees, pool: WavesLadder, city: Building2, mountain: Mountain, lake: Waves,
  river: Waves, landmark: Landmark, courtyard: Grid2x2, street: Building, interior: Home, unspecified: EyeOff,
};

export const BED_ICONS = { single: BedSingle, twin: BedSingle, double: BedDouble, queen: BedDouble, king: BedDouble, super_king: BedDouble, sofa_bed: Sofa, bunk: Rows3, extra: Bed, cot: Baby };

export const HOTEL_TYPE_ICONS = { hotel: Hotel, resort: TreePalm, boutique: Gem, aparthotel: Building2, serviced_apartment: Building, guesthouse: House, villa: Castle, chalet: Tent };

export const MEAL_ICONS = { RO: Ban, BB: Croissant, HB: Soup, FB: Utensils, AI: Star, UAI: Crown, SC: CookingPot };

export const GALLERY_ICONS = { exterior: Building2, lobby: Armchair, reception: ConciergeBell, restaurant: Utensils, pool: WavesLadder, gym: Dumbbell, spa: Sparkles, garden: Trees, beach: Umbrella, facilities: Store, room: Bed, bathroom: Bath, view: Eye, balcony: Fence, amenities: Camera };

export const FALLBACK_ICON = Star;
export { Sunrise, Moon, Image, Warehouse, TreeDeciduous };
