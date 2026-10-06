import { useAuth } from "@/hooks/use-auth";

export type DatabaseRole =
  | "Super Admin"
  | "SOC Manager"
  | "Chief Security Officer (CSO)"
  | "Finance"
  | "HR"
  | "Danru"
  | "Wadanru"
  | "Supervisor"
  | "Anggota Regu";

export type RoleLevel = number | null;

type AuthUser = {
  id?: string | number;
  userId?: string | number;
  name?: string | null;
  nama?: string | null;
  email?: string | null;
  role?: string | null;
  roleId?: string | number | null;
  level?: number | string | null;
  reguId?: string | null;
};

function normalizeRole(value: string | null | undefined): DatabaseRole | null {
  if (!value) return null;

  const role = value.trim().toLowerCase();

  switch (role) {
    case "super admin":
      return "Super Admin";

    case "soc manager":
      return "SOC Manager";

    case "chief security officer (cso)":
    case "cso":
      return "Chief Security Officer (CSO)";

    case "finance":
      return "Finance";

    case "hr":
      return "HR";

    case "danru":
      return "Danru";

    case "wadanru":
      return "Wadanru";

    case "supervisor":
      return "Supervisor";

    case "anggota regu":
    case "guard":
      return "Anggota Regu";

    default:
      return null;
  }
}

function normalizeLevel(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const level = Number(value);

  return Number.isFinite(level) ? level : null;
}

export function useRole() {
  const auth = useAuth();

  const user = auth.user as AuthUser | null | undefined;
  const isLoading = auth.isLoading;

  const role = normalizeRole(user?.role);
  const level = normalizeLevel(user?.level);

  const isSuperAdmin = role === "Super Admin";

  /*
   * Hak akses operasional.
   * Supervisor SENGAJA TIDAK disertakan, sebab perannya
   * terbatas pada validasi laporan, bukan operasional langsung.
   */
  const canManageOps =
    isSuperAdmin ||
    role === "SOC Manager";

  /*
   * Hak akses keuangan.
   * Finance dan HR memiliki cakupan identik.
   */
  const canManageFinance =
    isSuperAdmin ||
    role === "Finance" ||
    role === "HR";

  const canManageKasbon = canManageFinance;

  /*
   * Hak akses personalia.
   * Finance dan HR memiliki cakupan identik.
   */
  const canManagePersonnel =
    isSuperAdmin ||
    role === "Finance" ||
    role === "HR";

  /*
   * Mengelola/memvalidasi absensi SELURUH regu.
   * Supervisor tercakup di sini (validasi laporan lintas regu).
   * Finance SENGAJA TIDAK disertakan (tidak berurusan dengan absensi).
   */
  const canManageAllAttendance =
    isSuperAdmin ||
    role === "Supervisor" ||
    role === "SOC Manager" ||
    role === "Chief Security Officer (CSO)" ||
    role === "HR";

  /*
   * Mengelola absensi HANYA regu miliknya sendiri.
   * Wajib disandingkan dengan penyaringan `reguId` di backend.
   */
  const canManageOwnRegu =
    role === "Danru" ||
    role === "Wadanru";

  /*
   * Role yang menggunakan absensi mandiri.
   */
  const canUseSelfAttendance =
    role === "Danru" ||
    role === "Wadanru" ||
    role === "Anggota Regu";

  return {
    user,

    userId: user?.id ?? user?.userId ?? null,
    roleId: user?.roleId ?? null,
    reguId: user?.reguId ?? null,

    role,
    level,

    isLoading,
    isAuthenticated: Boolean(user),

    isSuperAdmin,
    isSocManager: role === "SOC Manager",
    isCso: role === "Chief Security Officer (CSO)",
    isFinance: role === "Finance",
    isHr: role === "HR",
    isDanru: role === "Danru",
    isWadanru: role === "Wadanru",
    isSupervisor: role === "Supervisor",
    isAnggotaRegu: role === "Anggota Regu",

    canManageOps,
    canManageFinance,
    canManageKasbon,
    canManagePersonnel,
    canManageAllAttendance,
    canManageOwnRegu,
    canUseSelfAttendance,
  };
}