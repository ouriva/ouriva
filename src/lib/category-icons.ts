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
  Banknote, CreditCard, PiggyBank, TrendingUp, Wallet, BarChart3,
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
  Banknote, CreditCard, PiggyBank, TrendingUp, Wallet, BarChart3,
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
  { label: "Finance",        icons: ["Banknote", "CreditCard", "PiggyBank", "TrendingUp", "Wallet", "BarChart3"] },
  { label: "Work",           icons: ["Briefcase", "Laptop", "Building2", "Phone", "GraduationCap"] },
  { label: "Family",         icons: ["Baby", "Dog", "Cat", "Users"] },
  { label: "Misc",           icons: ["Gift", "Star", "Leaf", "Sun", "Moon", "Scissors", "Sparkles"] },
];

// ─── Colors ──────────────────────────────────────────────────────────────────
// Full class strings — never use template literals like `bg-${key}-500`.

export const CATEGORY_COLORS: { key: string; bg: string }[] = [
  { key: "zinc",    bg: "bg-zinc-500"    },
  { key: "blue",    bg: "bg-blue-500"    },
  { key: "violet",  bg: "bg-violet-500"  },
  { key: "rose",    bg: "bg-rose-500"    },
  { key: "orange",  bg: "bg-orange-500"  },
  { key: "amber",   bg: "bg-amber-500"   },
  { key: "lime",    bg: "bg-lime-500"    },
  { key: "emerald", bg: "bg-emerald-500" },
  { key: "teal",    bg: "bg-teal-500"    },
  { key: "sky",     bg: "bg-sky-500"     },
  { key: "pink",    bg: "bg-pink-500"    },
  { key: "red",     bg: "bg-red-500"     },
];
