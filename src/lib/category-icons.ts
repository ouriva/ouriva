// Category Icons + Colors
// =======================
// Curated set of ~60 Lucide icons and 12 predefined colors for category
// customisation. Storing the icon name (string) in the database keeps the
// schema simple; at render time we look up the component from CATEGORY_ICONS.
//
// IMPORTANT: CATEGORY_COLORS uses full Tailwind class strings, never dynamic
// constructions like `bg-${color}-500`, so the classes are never purged.

import {
  // Food & Dining
  UtensilsCrossed, Coffee, Pizza, Apple, ShoppingBasket, Wine, Sandwich,
  // Transport
  Car, Fuel, Bus, Train, Plane, Bike, Truck,
  // Home
  Home, Sofa, Wrench, Zap, Wifi, Flame, Droplets,
  // Health
  Heart, Activity, Pill, Stethoscope, Dumbbell, Brain,
  // Shopping
  ShoppingCart, ShoppingBag, Package, Tag, Shirt,
  // Entertainment
  Music, Tv, Gamepad2, Film, Ticket, BookOpen, Headphones,
  // Travel
  MapPin, Hotel, Luggage, Globe, Compass,
  // Finance
  Banknote, CreditCard, PiggyBank, TrendingUp, Wallet, BarChart3, ArrowLeftRight,
  // Work
  Briefcase, Laptop, Building2, Phone, GraduationCap,
  // Family
  Baby, Dog, Cat, Users,
  // Misc
  Gift, Star, Leaf, Sun, Moon, Scissors, Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Icons ───────────────────────────────────────────────────────────────────

export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  // Food & Dining
  UtensilsCrossed, Coffee, Pizza, Apple, ShoppingBasket, Wine, Sandwich,
  // Transport
  Car, Fuel, Bus, Train, Plane, Bike, Truck,
  // Home
  Home, Sofa, Wrench, Zap, Wifi, Flame, Droplets,
  // Health
  Heart, Activity, Pill, Stethoscope, Dumbbell, Brain,
  // Shopping
  ShoppingCart, ShoppingBag, Package, Tag, Shirt,
  // Entertainment
  Music, Tv, Gamepad2, Film, Ticket, BookOpen, Headphones,
  // Travel
  MapPin, Hotel, Luggage, Globe, Compass,
  // Finance
  Banknote, CreditCard, PiggyBank, TrendingUp, Wallet, BarChart3, ArrowLeftRight,
  // Work
  Briefcase, Laptop, Building2, Phone, GraduationCap,
  // Family
  Baby, Dog, Cat, Users,
  // Misc
  Gift, Star, Leaf, Sun, Moon, Scissors, Sparkles,
};

// Grouped for the picker UI — same icons with section headings
export const ICON_GROUPS: { label: string; icons: string[] }[] = [
  { label: "Food & Dining",  icons: ["UtensilsCrossed", "Coffee", "Pizza", "Apple", "ShoppingBasket", "Wine", "Sandwich"] },
  { label: "Transport",      icons: ["Car", "Fuel", "Bus", "Train", "Plane", "Bike", "Truck"] },
  { label: "Home",           icons: ["Home", "Sofa", "Wrench", "Zap", "Wifi", "Flame", "Droplets"] },
  { label: "Health",         icons: ["Heart", "Activity", "Pill", "Stethoscope", "Dumbbell", "Brain"] },
  { label: "Shopping",       icons: ["ShoppingCart", "ShoppingBag", "Package", "Tag", "Shirt"] },
  { label: "Entertainment",  icons: ["Music", "Tv", "Gamepad2", "Film", "Ticket", "BookOpen", "Headphones"] },
  { label: "Travel",         icons: ["MapPin", "Hotel", "Luggage", "Globe", "Compass"] },
  { label: "Finance",        icons: ["Banknote", "CreditCard", "PiggyBank", "TrendingUp", "Wallet", "BarChart3", "ArrowLeftRight"] },
  { label: "Work",           icons: ["Briefcase", "Laptop", "Building2", "Phone", "GraduationCap"] },
  { label: "Family",         icons: ["Baby", "Dog", "Cat", "Users"] },
  { label: "Misc",           icons: ["Gift", "Star", "Leaf", "Sun", "Moon", "Scissors", "Sparkles"] },
];

// ─── Colors ──────────────────────────────────────────────────────────────────
// Full class strings — never use template literals like `bg-${key}-500`.
// Values are the muted --cat-* tokens from globals.css, not raw Tailwind
// colors — see docs/COLOR_SYSTEM.md. Keys are unchanged from the original
// Tailwind-backed palette so existing categories' stored `color` values
// still resolve; only what each key renders as has changed.

export const CATEGORY_COLORS: { key: string; bg: string }[] = [
  { key: "zinc",    bg: "bg-cat-zinc"    },
  { key: "blue",    bg: "bg-cat-blue"    },
  { key: "violet",  bg: "bg-cat-violet"  },
  { key: "rose",    bg: "bg-cat-rose"    },
  { key: "orange",  bg: "bg-cat-orange"  },
  { key: "amber",   bg: "bg-cat-amber"   },
  { key: "lime",    bg: "bg-cat-lime"    },
  { key: "emerald", bg: "bg-cat-emerald" },
  { key: "teal",    bg: "bg-cat-teal"    },
  { key: "sky",     bg: "bg-cat-sky"     },
  { key: "pink",    bg: "bg-cat-pink"    },
  { key: "red",     bg: "bg-cat-red"     },
];
