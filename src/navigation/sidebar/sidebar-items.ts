import {
  ArrowLeftRight,
  Banknote,
  Calendar,
  ChartBar,
  CheckSquare,
  Compass,
  Fingerprint,
  FolderOpen,
  Forklift,
  Gauge,
  GraduationCap,
  HeartPulse,
  Kanban,
  LayoutDashboard,
  ListTodo,
  Lock,
  type LucideIcon,
  Mail,
  MessageSquare,
  Package,
  Palmtree,
  PiggyBank,
  ReceiptText,
  Scale,
  Server,
  ShoppingBag,
  SquareArrowUpRight,
  Tags,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";

export type NavBadge = "new" | "updated" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Family Budget",
    items: [
      {
        id: "family-budget-accounts",
        title: "Accounts & Transactions",
        url: "/dashboard/family-budget",
        icon: Wallet,
      },
      {
        id: "family-budget-overview",
        title: "Budget Overview",
        url: "/dashboard/family-budget/budget-overview",
        icon: PiggyBank,
      },
      {
        id: "family-budget-income",
        title: "Income & Taxes",
        url: "/dashboard/family-budget/income",
        icon: Banknote,
      },
      {
        id: "family-budget-offer-comparator",
        title: "Offer Comparator",
        url: "/dashboard/family-budget/offer-comparator",
        icon: Scale,
      },
      {
        id: "family-budget-fx-inflation",
        title: "FX & Inflation",
        url: "/dashboard/family-budget/fx-inflation",
        icon: ArrowLeftRight,
      },
      {
        id: "family-budget-lifestyle",
        title: "Lifestyle & Tags",
        icon: Compass,
        subItems: [
          {
            id: "family-budget-lifestyle-explorer",
            title: "Tag & Category Explorer",
            url: "/dashboard/family-budget/lifestyle",
            icon: Tags,
          },
          {
            id: "family-budget-lifestyle-trips",
            title: "Trips & Concerts",
            url: "/dashboard/family-budget/lifestyle/trips-concerts",
            icon: Palmtree,
          },
          {
            id: "family-budget-lifestyle-health",
            title: "Health & Sport",
            url: "/dashboard/family-budget/lifestyle/health-sport",
            icon: HeartPulse,
          },
          {
            id: "family-budget-lifestyle-learning",
            title: "Learning",
            url: "/dashboard/family-budget/lifestyle/learning",
            icon: GraduationCap,
          },
        ],
      },
    ],
  },
  {
    id: 2,
    label: "Dashboards",
    items: [
      {
        id: "default",
        title: "Default",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "crm",
        title: "CRM",
        url: "/dashboard/crm",
        icon: ChartBar,
      },
      {
        id: "finance",
        title: "Finance",
        url: "/dashboard/finance",
        icon: Banknote,
      },
      {
        id: "analytics",
        title: "Analytics",
        url: "/dashboard/analytics",
        icon: Gauge,
      },
      {
        id: "productivity",
        title: "Productivity",
        url: "/dashboard/productivity",
        icon: ListTodo,
      },
      {
        id: "ecommerce",
        title: "E-commerce",
        url: "/dashboard/ecommerce",
        icon: ShoppingBag,
      },
      {
        id: "academy",
        title: "Academy",
        url: "/dashboard/academy",
        icon: GraduationCap,
      },
      {
        id: "logistics",
        title: "Logistics",
        url: "/dashboard/logistics",
        icon: Forklift,
      },
      {
        id: "infrastructure",
        title: "Infrastructure",
        url: "/dashboard/infrastructure",
        icon: Server,
      },
      {
        id: "file-manager",
        title: "File Manager",
        url: "/dashboard/file-manager",
        icon: FolderOpen,
      },
      {
        id: "patient-monitoring",
        title: "Patient Monitoring",
        url: "/dashboard/patient-monitoring",
        icon: HeartPulse,
      },
    ],
  },
  {
    id: 3,
    label: "Pages",
    items: [
      {
        id: "products",
        title: "Products",
        url: "/dashboard/products",
        icon: Package,
        badge: "new",
      },
      {
        id: "email",
        title: "Email",
        url: "/dashboard/mail",
        icon: Mail,
      },
      {
        id: "chat",
        title: "Chat",
        url: "/dashboard/chat",
        icon: MessageSquare,
      },
      {
        id: "calendar",
        title: "Calendar",
        url: "/dashboard/calendar",
        icon: Calendar,
      },
      {
        id: "kanban",
        title: "Kanban",
        url: "/dashboard/kanban",
        icon: Kanban,
        badge: "updated",
      },
      {
        id: "tasks",
        title: "Tasks",
        url: "/dashboard/tasks",
        icon: CheckSquare,
      },
      {
        id: "invoice",
        title: "Invoice",
        url: "/dashboard/invoice",
        icon: ReceiptText,
      },
      {
        id: "profile",
        title: "Profile",
        url: "/dashboard/profile",
        icon: UserRound,
      },
      {
        id: "users",
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
      },
      {
        id: "roles",
        title: "Roles",
        url: "/dashboard/roles",
        icon: Lock,
      },
      {
        id: "authentication",
        title: "Authentication",
        icon: Fingerprint,
        subItems: [
          { id: "auth-login-v1", title: "Login v1", url: "/auth/v1/login", newTab: true },
          { id: "auth-login-v2", title: "Login v2", url: "/auth/v2/login", newTab: true },
          { id: "auth-register-v1", title: "Register v1", url: "/auth/v1/register", newTab: true },
          { id: "auth-register-v2", title: "Register v2", url: "/auth/v2/register", newTab: true },
        ],
      },
    ],
  },
  {
    id: 4,
    label: "Legacy",
    items: [
      {
        id: "legacy-dashboards",
        title: "Dashboards",
        subItems: [
          { id: "legacy-default", title: "Default V1", url: "/dashboard/default-v1" },
          { id: "legacy-crm", title: "CRM V1", url: "/dashboard/crm-v1" },
          { id: "legacy-finance", title: "Finance V1", url: "/dashboard/finance-v1" },
          { id: "legacy-analytics", title: "Analytics V1", url: "/dashboard/analytics-v1" },
        ],
      },
    ],
  },
  {
    id: 5,
    label: "Misc",
    items: [
      {
        id: "others",
        title: "Others",
        url: "/dashboard/coming-soon",
        icon: SquareArrowUpRight,
        badge: "soon",
        disabled: true,
      },
    ],
  },
];
