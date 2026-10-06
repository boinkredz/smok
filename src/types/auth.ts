export type RoleId =
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8;

export type DatabaseRole =
  | "Admin"
  | "SOC Manager"
  | "CSO"
  | "Payroll/HR Admin"
  | "Danru"
  | "Wadanru"
  | "Analyst"
  | "Guard";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  roleId: RoleId;
  role: DatabaseRole;
  level: number;
};