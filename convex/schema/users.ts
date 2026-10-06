import { defineTable } from "convex/server";
import { v } from "convex/values";

export const ROLES = [
  "admin",
  "finance",
  "hr",
  "supervisor",
  "danru",
  "anggota",
  "petugas", // Legacy role
] as const;

export type Role = (typeof ROLES)[number];

export const roleValidator = v.union(
  v.literal("admin"),
  v.literal("finance"),
  v.literal("hr"),
  v.literal("supervisor"),
  v.literal("danru"),
  v.literal("anggota"),
  v.literal("petugas"),
);

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

export const users = defineTable({
  tokenIdentifier: v.string(),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
  role: v.optional(roleValidator),
}).index("by_token", ["tokenIdentifier"]);