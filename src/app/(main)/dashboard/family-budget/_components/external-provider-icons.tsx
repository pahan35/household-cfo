import type { ComponentPropsWithoutRef } from "react";

import {
  AlignJustify,
  Armchair,
  AtSign,
  Baby,
  BadgeDollarSign,
  Bandage,
  Banknote,
  BarChart3,
  Beer,
  Bell,
  Bike,
  BookOpen,
  Boxes,
  Briefcase,
  Building,
  Building2,
  Bus,
  Camera,
  Car,
  CircleHelp,
  Coffee,
  Coins,
  Cpu,
  CreditCard,
  Dices,
  Disc,
  Drama,
  Dumbbell,
  Flower2,
  Fuel,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Grape,
  Guitar,
  Hammer,
  Headphones,
  Home,
  House,
  Image,
  Landmark,
  Layers,
  Library,
  type LucideIcon,
  Luggage,
  Monitor,
  Newspaper,
  PaintRoller,
  Palette,
  PawPrint,
  Phone,
  PieChart,
  PiggyBank,
  Plane,
  Receipt,
  Scale,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Skull,
  Smartphone,
  Soup,
  Sparkles,
  Sprout,
  Stethoscope,
  StickyNote,
  Target,
  Ticket,
  TrendingUp,
  Trophy,
  Tv,
  User,
  UserCheck,
  Utensils,
  UtensilsCrossed,
  Wallet,
  Wifi,
  Wine,
  Wrench,
} from "lucide-react";

import { CategoryType } from "./external-provider-data";

export type ExternalProviderIconGroupId =
  | "finance"
  | "food"
  | "transport"
  | "living"
  | "tech"
  | "lifestyle"
  | "health"
  | "work";

export interface ExternalProviderIconGroup {
  id: ExternalProviderIconGroupId;
  label: string;
}

export const EXTERNAL_PROVIDER_ICON_GROUPS: readonly ExternalProviderIconGroup[] = [
  { id: "finance", label: "Finance" },
  { id: "food", label: "Food & Drink" },
  { id: "transport", label: "Transport" },
  { id: "living", label: "Home & Living" },
  { id: "tech", label: "Tech & Gadgets" },
  { id: "lifestyle", label: "Lifestyle" },
  { id: "health", label: "Health & Family" },
  { id: "work", label: "Work & Admin" },
] as const;

export interface ExternalProviderIconMeta {
  id: string;
  name: string;
  label: string;
  group: ExternalProviderIconGroupId;
  keywords: string[];
  icon: LucideIcon;
}

export const EXTERNAL_PROVIDER_ICONS: readonly ExternalProviderIconMeta[] = [
  // --- Finance (14) ---
  {
    id: "bank",
    name: "Bank",
    label: "Bank",
    group: "finance",
    keywords: ["bank", "banking", "finance", "institution", "account"],
    icon: Landmark,
  },
  {
    id: "barchart",
    name: "BarChart",
    label: "Bar Chart",
    group: "finance",
    keywords: ["barchart", "chart", "analytics", "statistics", "report", "stocks"],
    icon: BarChart3,
  },
  {
    id: "bonus",
    name: "Bonus",
    label: "Bonus",
    group: "finance",
    keywords: ["bonus", "reward", "premium", "extra", "gift", "incentive"],
    icon: Gift,
  },
  {
    id: "cards",
    name: "Cards",
    label: "Cards",
    group: "finance",
    keywords: ["cards", "payment", "bank", "accounts", "plastic"],
    icon: Layers,
  },
  {
    id: "card",
    name: "Card",
    label: "Card",
    group: "finance",
    keywords: ["card", "credit", "debit", "payment", "bank"],
    icon: CreditCard,
  },
  {
    id: "cash",
    name: "Cash",
    label: "Cash",
    group: "finance",
    keywords: ["cash", "money", "paper", "currency", "bills", "wallet"],
    icon: Banknote,
  },
  {
    id: "credit",
    name: "Credit",
    label: "Credit",
    group: "finance",
    keywords: ["credit", "loan", "borrow", "financing", "debt"],
    icon: CreditCard,
  },
  {
    id: "debt",
    name: "Debt",
    label: "Debt",
    group: "finance",
    keywords: ["debt", "loan", "liability", "scales", "borrow", "owe", "repay"],
    icon: Scale,
  },
  {
    id: "emoney",
    name: "Emoney",
    label: "E-Money / Crypto",
    group: "finance",
    keywords: ["emoney", "crypto", "digital", "bitcoin", "tokens", "electronic"],
    icon: Coins,
  },
  {
    id: "insurance",
    name: "Insurance",
    label: "Insurance",
    group: "finance",
    keywords: ["insurance", "shield", "policy", "security", "protection", "coverage"],
    icon: ShieldCheck,
  },
  {
    id: "investments",
    name: "Investments",
    label: "Investments",
    group: "finance",
    keywords: ["investments", "stocks", "growth", "yield", "returns", "portfolio", "wealth"],
    icon: TrendingUp,
  },
  {
    id: "piechart",
    name: "PieChart",
    label: "Pie Chart",
    group: "finance",
    keywords: ["piechart", "chart", "breakdown", "analytics", "budget", "stats"],
    icon: PieChart,
  },
  {
    id: "salary",
    name: "Salary",
    label: "Salary / Income",
    group: "finance",
    keywords: ["salary", "wage", "income", "paycheck", "job", "earnings"],
    icon: BadgeDollarSign,
  },
  {
    id: "savings",
    name: "Savings",
    label: "Savings",
    group: "finance",
    keywords: ["savings", "deposit", "piggy bank", "reserve", "accumulation"],
    icon: PiggyBank,
  },

  // --- Food & Drink (9) ---
  {
    id: "beerglass",
    name: "BeerGlass",
    label: "Beer Glass",
    group: "food",
    keywords: ["beerglass", "beer", "alcohol", "bar", "pub", "drink", "brew"],
    icon: Beer,
  },
  {
    id: "coffee",
    name: "Coffee",
    label: "Coffee",
    group: "food",
    keywords: ["coffee", "cafe", "espresso", "latte", "breakfast", "drink"],
    icon: Coffee,
  },
  {
    id: "eating",
    name: "Eating",
    label: "Eating Out",
    group: "food",
    keywords: ["eating", "restaurant", "dining", "dinner", "lunch", "food"],
    icon: UtensilsCrossed,
  },
  {
    id: "forkandknife",
    name: "ForkAndKnife",
    label: "Fork & Knife",
    group: "food",
    keywords: ["forkandknife", "fork", "knife", "utensils", "food", "dining", "meal", "kitchen"],
    icon: Utensils,
  },
  {
    id: "grapes",
    name: "Grapes",
    label: "Grapes / Fruit",
    group: "food",
    keywords: ["grapes", "fruit", "wine", "healthy", "food", "produce"],
    icon: Grape,
  },
  {
    id: "groceries",
    name: "Groceries",
    label: "Groceries",
    group: "food",
    keywords: ["groceries", "supermarket", "food", "market", "ingredients", "cart"],
    icon: ShoppingBasket,
  },
  {
    id: "ramen",
    name: "Ramen",
    label: "Ramen / Fast Food",
    group: "food",
    keywords: ["ramen", "soup", "noodles", "asian", "dinner", "takeout", "food"],
    icon: Soup,
  },
  {
    id: "shoppingcart",
    name: "ShoppingCart",
    label: "Shopping Cart",
    group: "food",
    keywords: ["shoppingcart", "supermarket", "groceries", "store", "buy", "food"],
    icon: ShoppingCart,
  },
  {
    id: "wineglass",
    name: "WineGlass",
    label: "Wine Glass",
    group: "food",
    keywords: ["wineglass", "wine", "alcohol", "drinks", "restaurant", "party", "bar"],
    icon: Wine,
  },

  // --- Transport (7) ---
  {
    id: "airplane",
    name: "Airplane",
    label: "Airplane",
    group: "transport",
    keywords: ["airplane", "fly", "plane", "travel", "flight", "trip"],
    icon: Plane,
  },
  {
    id: "bicycle",
    name: "Bicycle",
    label: "Bicycle",
    group: "transport",
    keywords: ["bicycle", "bike", "cycling", "ride", "transport"],
    icon: Bike,
  },
  {
    id: "car",
    name: "Car",
    label: "Car",
    group: "transport",
    keywords: ["car", "auto", "vehicle", "drive", "parking"],
    icon: Car,
  },
  {
    id: "fuel",
    name: "Fuel",
    label: "Fuel / Gas",
    group: "transport",
    keywords: ["fuel", "gas", "petrol", "diesel", "station", "refuel"],
    icon: Fuel,
  },
  {
    id: "globe",
    name: "Globe",
    label: "Globe / International",
    group: "transport",
    keywords: ["globe", "world", "foreign", "travel", "international"],
    icon: Globe,
  },
  {
    id: "transport",
    name: "Transport",
    label: "Transport / Transit",
    group: "transport",
    keywords: ["transport", "transit", "subway", "metro", "commute", "bus"],
    icon: Bus,
  },
  {
    id: "travelling",
    name: "Travelling",
    label: "Travelling / Vacation",
    group: "transport",
    keywords: ["travelling", "luggage", "travel", "vacation", "trip", "holiday", "journey"],
    icon: Luggage,
  },

  // --- Home & Living (12) ---
  {
    id: "city",
    name: "city",
    label: "City",
    group: "living",
    keywords: ["city", "urban", "metropolis", "rent", "apartment", "downtown"],
    icon: Building2,
  },
  {
    id: "flower",
    name: "Flower",
    label: "Flower",
    group: "living",
    keywords: ["flower", "garden", "floral", "plant", "gift", "nature"],
    icon: Flower2,
  },
  {
    id: "hammer",
    name: "Hammer",
    label: "Hammer / Repair",
    group: "living",
    keywords: ["hammer", "tools", "renovation", "construction", "diy", "repair"],
    icon: Hammer,
  },
  {
    id: "household",
    name: "Household",
    label: "Household",
    group: "living",
    keywords: ["household", "home", "domestic", "appliances", "family", "cleaning"],
    icon: Home,
  },
  {
    id: "house",
    name: "House",
    label: "House",
    group: "living",
    keywords: ["house", "home", "mortgage", "rent", "realty", "apartment"],
    icon: House,
  },
  {
    id: "paintroller",
    name: "PaintRoller",
    label: "Paint Roller / Decor",
    group: "living",
    keywords: ["paintroller", "paint", "renovation", "interior", "decor"],
    icon: PaintRoller,
  },
  {
    id: "pictureframe",
    name: "PictureFrame",
    label: "Picture Frame / Art",
    group: "living",
    keywords: ["pictureframe", "photo", "image", "art", "decor", "gallery", "wall"],
    icon: Image,
  },
  {
    id: "plant",
    name: "Plant",
    label: "Plant / Garden",
    group: "living",
    keywords: ["plant", "sprout", "botanical", "green", "flowers", "nature"],
    icon: Sprout,
  },
  {
    id: "property",
    name: "Property",
    label: "Property / Real Estate",
    group: "living",
    keywords: ["property", "real estate", "premises", "land", "asset", "building"],
    icon: Building,
  },
  {
    id: "spiderweb",
    name: "Spiderweb",
    label: "Storage / Attic",
    group: "living",
    keywords: ["spiderweb", "storage", "attic", "basement", "old", "boxes"],
    icon: Boxes,
  },
  {
    id: "wardrobe",
    name: "Wardrobe",
    label: "Furniture / Wardrobe",
    group: "living",
    keywords: ["wardrobe", "closet", "cabinet", "bedroom", "furniture", "interior"],
    icon: Armchair,
  },
  {
    id: "wrench",
    name: "Wrench",
    label: "Wrench / Maintenance",
    group: "living",
    keywords: ["wrench", "tools", "repair", "plumbing", "mechanic", "fix", "service"],
    icon: Wrench,
  },

  // --- Tech & Gadgets (8) ---
  {
    id: "at",
    name: "At",
    label: "At / Email",
    group: "tech",
    keywords: ["at", "email", "mail", "internet", "contact", "online"],
    icon: AtSign,
  },
  {
    id: "display",
    name: "display",
    label: "Display / Monitor",
    group: "tech",
    keywords: ["display", "screen", "monitor", "computer", "pc", "desktop"],
    icon: Monitor,
  },
  {
    id: "hitech",
    name: "Hitech",
    label: "Hi-Tech / Electronics",
    group: "tech",
    keywords: ["hitech", "gadgets", "hardware", "tech", "electronics", "chips", "cpu"],
    icon: Cpu,
  },
  {
    id: "internet",
    name: "Internet",
    label: "Internet / Wi-Fi",
    group: "tech",
    keywords: ["internet", "wifi", "broadband", "network", "online", "web"],
    icon: Wifi,
  },
  {
    id: "iphone",
    name: "Iphone",
    label: "Smartphone / iPhone",
    group: "tech",
    keywords: ["iphone", "smartphone", "mobile", "phone", "apple", "ios", "cellular"],
    icon: Smartphone,
  },
  {
    id: "ipod",
    name: "Ipod",
    label: "Audio / iPod",
    group: "tech",
    keywords: ["ipod", "audio", "music", "listening", "mp3", "sound", "headphones"],
    icon: Headphones,
  },
  {
    id: "phone",
    name: "Phone",
    label: "Phone / Calls",
    group: "tech",
    keywords: ["phone", "telephone", "call", "telecom", "cellular", "contact"],
    icon: Phone,
  },
  {
    id: "tv",
    name: "TV",
    label: "TV / Television",
    group: "tech",
    keywords: ["tv", "television", "streaming", "movies", "cable", "broadcast", "screen"],
    icon: Tv,
  },

  // --- Lifestyle (17) ---
  {
    id: "beauty",
    name: "Beauty",
    label: "Beauty",
    group: "lifestyle",
    keywords: ["beauty", "cosmetics", "salon", "spa", "makeup", "care", "sparkles"],
    icon: Sparkles,
  },
  {
    id: "books",
    name: "Books",
    label: "Books",
    group: "lifestyle",
    keywords: ["books", "library", "reading", "education", "study", "bookshelf"],
    icon: Library,
  },
  {
    id: "book",
    name: "Book",
    label: "Book",
    group: "lifestyle",
    keywords: ["book", "reading", "novel", "guide", "learn", "study"],
    icon: BookOpen,
  },
  {
    id: "camera",
    name: "Camera",
    label: "Camera",
    group: "lifestyle",
    keywords: ["camera", "photo", "photography", "video", "media", "picture"],
    icon: Camera,
  },
  {
    id: "controller",
    name: "Controller",
    label: "Gaming Controller",
    group: "lifestyle",
    keywords: ["controller", "gamepad", "games", "gaming", "play", "console"],
    icon: Gamepad2,
  },
  {
    id: "dice",
    name: "Dice",
    label: "Dice",
    group: "lifestyle",
    keywords: ["dice", "gambling", "casino", "games", "board games", "luck"],
    icon: Dices,
  },
  {
    id: "dramamasks",
    name: "DramaMasks",
    label: "Theater / Drama",
    group: "lifestyle",
    keywords: ["dramamasks", "theater", "acting", "culture", "entertainment", "cinema", "show"],
    icon: Drama,
  },
  {
    id: "entertainment",
    name: "Entertainment",
    label: "Entertainment",
    group: "lifestyle",
    keywords: ["entertainment", "ticket", "events", "movies", "concert", "fun", "amusement"],
    icon: Ticket,
  },
  {
    id: "gifts",
    name: "Gifts",
    label: "Gifts",
    group: "lifestyle",
    keywords: ["gifts", "presents", "holiday", "birthday", "celebration", "gift"],
    icon: Gift,
  },
  {
    id: "guitar",
    name: "Guitar",
    label: "Guitar / Music",
    group: "lifestyle",
    keywords: ["guitar", "music", "concert", "instrument", "band", "rock"],
    icon: Guitar,
  },
  {
    id: "hobbies",
    name: "Hobbies",
    label: "Hobbies / Art",
    group: "lifestyle",
    keywords: ["hobbies", "craft", "painting", "palette", "creative", "leisure", "art"],
    icon: Palette,
  },
  {
    id: "newspaper",
    name: "Newspaper",
    label: "Newspaper / News",
    group: "lifestyle",
    keywords: ["newspaper", "news", "press", "journal", "subscription", "media"],
    icon: Newspaper,
  },
  {
    id: "pets",
    name: "Pets",
    label: "Pets",
    group: "lifestyle",
    keywords: ["pets", "animals", "dog", "cat", "paw", "veterinary", "pet food"],
    icon: PawPrint,
  },
  {
    id: "poison",
    name: "Poison",
    label: "Bad Habits",
    group: "lifestyle",
    keywords: ["poison", "skull", "habits", "alcohol", "smoking", "vice", "danger"],
    icon: Skull,
  },
  {
    id: "recordplayer",
    name: "RecordPlayer",
    label: "Record Player / Vinyl",
    group: "lifestyle",
    keywords: ["recordplayer", "vinyl", "music", "retro", "album", "audio", "disc"],
    icon: Disc,
  },
  {
    id: "shoppingbag",
    name: "ShoppingBag",
    label: "Shopping Bag",
    group: "lifestyle",
    keywords: ["shoppingbag", "shopping", "clothing", "mall", "retail", "store", "goods"],
    icon: ShoppingBag,
  },
  {
    id: "tshirt",
    name: "TShirt",
    label: "Clothing / T-Shirt",
    group: "lifestyle",
    keywords: ["tshirt", "shirt", "clothing", "apparel", "wardrobe", "fashion", "wear"],
    icon: Shirt,
  },

  // --- Health & Family (7) ---
  {
    id: "bandaid",
    name: "BandAid",
    label: "Band-Aid / First Aid",
    group: "health",
    keywords: ["bandaid", "bandage", "medical", "health", "injury", "first aid"],
    icon: Bandage,
  },
  {
    id: "dumbells",
    name: "Dumbells",
    label: "Dumbbells / Fitness",
    group: "health",
    keywords: ["dumbells", "dumbbell", "gym", "workout", "exercise", "sport", "fitness"],
    icon: Dumbbell,
  },
  {
    id: "kids",
    name: "Kids",
    label: "Kids / Family",
    group: "health",
    keywords: ["kids", "children", "baby", "parenting", "toys", "childcare", "family"],
    icon: Baby,
  },
  {
    id: "man",
    name: "Man",
    label: "Man / Personal",
    group: "health",
    keywords: ["man", "person", "user", "clothing", "menswear", "grooming"],
    icon: User,
  },
  {
    id: "medical",
    name: "Medical",
    label: "Medical / Doctor",
    group: "health",
    keywords: ["medical", "doctor", "clinic", "hospital", "healthcare", "medicine", "stethoscope"],
    icon: Stethoscope,
  },
  {
    id: "sport",
    name: "Sport",
    label: "Sport / Fitness",
    group: "health",
    keywords: ["sport", "athletics", "competition", "training", "win", "achievement", "trophy"],
    icon: Trophy,
  },
  {
    id: "woman",
    name: "Woman",
    label: "Woman / Personal",
    group: "health",
    keywords: ["woman", "person", "user", "womenswear", "care", "family"],
    icon: UserCheck,
  },

  // --- Work & Admin (6) ---
  {
    id: "bars",
    name: "Bars",
    label: "Bars / Options",
    group: "work",
    keywords: ["bars", "options", "menu", "list", "settings", "align"],
    icon: AlignJustify,
  },
  {
    id: "business",
    name: "Business",
    label: "Business",
    group: "work",
    keywords: ["business", "company", "corporate", "office", "work", "job", "briefcase"],
    icon: Briefcase,
  },
  {
    id: "gradhat",
    name: "GradHat",
    label: "Graduation Hat",
    group: "work",
    keywords: ["gradhat", "graduation", "education", "degree", "college", "university", "course"],
    icon: GraduationCap,
  },
  {
    id: "miscellaneous",
    name: "Miscellaneous",
    label: "Miscellaneous",
    group: "work",
    keywords: ["miscellaneous", "other", "general", "extra", "various", "help"],
    icon: CircleHelp,
  },
  {
    id: "note",
    name: "Note",
    label: "Note / Memo",
    group: "work",
    keywords: ["note", "memo", "document", "paper", "stationery", "sticky note"],
    icon: StickyNote,
  },
  {
    id: "reminder",
    name: "Reminder",
    label: "Reminder / Alert",
    group: "work",
    keywords: ["reminder", "notification", "bell", "alarm", "clock", "alert"],
    icon: Bell,
  },
] as const;

export type ExternalProviderIconName = (typeof EXTERNAL_PROVIDER_ICONS)[number]["id"];

export const EXTERNAL_PROVIDER_ICON_MAP: Record<string, ExternalProviderIconMeta> = (() => {
  const map: Record<string, ExternalProviderIconMeta> = {};
  for (const meta of EXTERNAL_PROVIDER_ICONS) {
    map[meta.id.toLowerCase()] = meta as ExternalProviderIconMeta;
    map[meta.name.toLowerCase()] = meta as ExternalProviderIconMeta;
  }
  return map;
})();

export function getExternalProviderIconMeta(name?: string | null): ExternalProviderIconMeta | undefined {
  if (!name || typeof name !== "string") return undefined;
  return EXTERNAL_PROVIDER_ICON_MAP[name.trim().toLowerCase()];
}

/**
 * Resolves an icon component with fallback cascade:
 * 1. Matching ExternalProvider icon key
 * 2. CategoryType default fallback
 * 3. Generic CreditCard fallback
 */
export function resolveExternalProviderIcon(icon?: string | null, fallbackType?: number | null): LucideIcon {
  const meta = getExternalProviderIconMeta(icon);
  if (meta) {
    return meta.icon;
  }

  if (fallbackType !== undefined && fallbackType !== null) {
    const typeNum = Number(fallbackType);
    switch (typeNum) {
      case CategoryType.BankAccount:
        return Landmark;
      case CategoryType.Account:
        return Wallet;
      case CategoryType.DebtAccount:
        return Scale;
      case CategoryType.Income:
        return Banknote;
      case CategoryType.Expense:
        return Receipt;
      case CategoryType.Goal:
      case CategoryType.ClassicGoal:
        return Target;
      default:
        break;
    }
  }

  return CreditCard;
}

export interface ExternalProviderIconProps extends ComponentPropsWithoutRef<"svg"> {
  icon?: string | null;
  fallbackType?: number | null;
  className?: string;
}

export function ExternalProviderIcon({ icon, fallbackType, className, ...props }: ExternalProviderIconProps) {
  const IconComponent = resolveExternalProviderIcon(icon, fallbackType);
  return <IconComponent className={className} {...props} />;
}
