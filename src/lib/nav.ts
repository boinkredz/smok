import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Fingerprint,
  MapPin,
  Settings,
  ShieldAlert,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DatabaseRole } from "@/hooks/use-role";

export type NavItem = {
  label: string;
  to: string;
  icon: LucideIcon;
  group?: string;
  showInBottomNav?: boolean;
  roles?: ReadonlyArray<DatabaseRole>;
};

export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  {
    label: "Dashboard",
    to: "/",
    icon: BarChart3,
    showInBottomNav: true,
  },

  {
    label: "Petugas",
    to: "/petugas",
    icon: Users,
    showInBottomNav: true,
    roles: ["Super Admin", "HR"], // "SOC Manager" dihapus, sesuai kebijakan personalia
  },

  {
    label: "Absen Mandiri",
    to: "/absen-mandiri",
    icon: Fingerprint,
    showInBottomNav: true,
  },

  {
    label: "Jadwal Shift",
    to: "/absensi",
    icon: CalendarClock,
    roles: [
      "Super Admin",
      "Chief Security Officer (CSO)",
      "HR",
      "SOC Manager",
      "Danru",
      "Wadanru",
      "Anggota Regu",
    ],
  },

  {
    label: "Arus Kas",
    to: "/keuangan",
    icon: Wallet,
  },

  {
    label: "Patroli",
    to: "/patroli",
    icon: MapPin,
    showInBottomNav: true,
    roles: [
      "Super Admin",
      "SOC Manager",
      "Chief Security Officer (CSO)",
      "Danru",
      "Wadanru",
      "Supervisor",
      "Anggota Regu",
    ],
  },

  {
    label: "Insiden & B.A",
    to: "/insiden",
    icon: ShieldAlert,
    showInBottomNav: true,
    roles: [
      "Super Admin",
      "SOC Manager",
      "Chief Security Officer (CSO)",
      "Danru",
      "Wadanru",
      "Supervisor",
      "Anggota Regu",
    ],
  },

  {
    label: "Perlengkapan",
    to: "/perlengkapan",
    icon: ClipboardCheck,
    roles: [
      "Super Admin",
      "SOC Manager",
      "Chief Security Officer (CSO)",
      "Danru",
      "Wadanru",
      "Supervisor",
      "Anggota Regu",
    ],
  },

  {
    label: "Operasional",
    to: "/master/site",
    icon: Building2,
    group: "Master Data",
    roles: ["Super Admin", "SOC Manager", "Chief Security Officer (CSO)"],
  },

  {
    label: "Geo Fence",
    to: "/master/geofence",
    icon: MapPin,
    group: "Master Data",
    roles: ["Super Admin", "SOC Manager", "Chief Security Officer (CSO)"],
  },

  {
    label: "Divisi",
    to: "/master/jabatan",
    icon: Briefcase,
    group: "Master Data",
    roles: ["Super Admin", "Chief Security Officer (CSO)"],
  },

  {
    label: "Users Roles",
    to: "/pengaturan/peran",
    icon: Settings,
    group: "Pengaturan",
    roles: ["Super Admin", "Chief Security Officer (CSO)"],
  },
];