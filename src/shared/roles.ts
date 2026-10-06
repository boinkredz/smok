export const ROLES = [
  "admin",
  "finance",
  "hr",
  "supervisor",
  "danru",
  "anggota",
  "petugas",
] as const;

export type Role = (typeof ROLES)[number];

export const DEVICE_LOCKED_ROLES: ReadonlyArray<Role> = [
  "danru",
  "anggota",
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  finance: "Finance",
  hr: "HR",
  supervisor: "Supervisor",
  danru: "Danru",
  anggota: "Anggota",
  petugas: "Petugas",
};