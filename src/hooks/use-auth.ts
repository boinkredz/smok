import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { login as loginApi } from "@/services/auth.api";

export function usePermission(kodeIzin: string): boolean {
  const { user } = useAuth(); // ← disesuaikan dengan nama hook sesungguhnya, menunggu konfirmasi
  return user?.permissions?.includes(kodeIzin) ?? false;
}

export function useHasAnyPermission(daftarKodeIzin: string[]): boolean {
  const { user } = useAuth();
  if (!user) return false;
  return daftarKodeIzin.some((kode) => user.permissions.includes(kode));
}

export type LocalUser = {
  id: number;
  name: string;
  email: string;
  roleId: number | null;
  role: string;
  level: number;
  reguId: string | null;        // ← turut ditambahkan, mengingat sudah terbukti ada di payload
  permissions: string[];        // ← wajib ditambahkan
};

type LoginResult = {
  user?: {
    id?: number | string;
    name?: string | null;
    nama?: string | null;
    email?: string | null;
    roleId?: number | string | null;
    role?: string | { name?: string | null } | null;
    roleName?: string | null;
    level?: number | string | null;
    reguId?: string | null;
    permissions?: string[] | null;   // ← wajib ditambahkan
  };
};

const STORAGE_KEY = "smok_user";

function getStoredUser(): LocalUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const value = window.localStorage.getItem(
    STORAGE_KEY,
  );

  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value);

    if (
      !parsed ||
      typeof parsed.id !== "number" ||
      !parsed.email
    ) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed as LocalUser;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function normalizeUser(
  result: LoginResult,
): LocalUser {
  const source = result.user;

  if (!source?.id || !source.email) {
    throw new Error(
      "Response login tidak memiliki data user yang valid.",
    );
  }

  const roleValue =
    typeof source.role === "object"
      ? source.role?.name
      : source.role;

  const role = String(
    source.roleName ??
      roleValue ??
      "",
  )
    .trim()
    .toLowerCase();

  return {
    id: Number(source.id),
    name: String(
      source.name ??
        source.nama ??
        "",
    ),
    email: String(source.email),
    roleId:
      source.roleId === null ||
      source.roleId === undefined
        ? null
        : Number(source.roleId),
    role,
    level:
      source.level === null ||
      source.level === undefined
        ? 0
        : Number(source.level),
      reguId: source.reguId != null ? String(source.reguId) : null,
      permissions: Array.isArray(source.permissions) ? source.permissions : [],
  };
}


export function useUser() {
  const [user, setUser] =
    useState<LocalUser | null>(null);

  useEffect(() => {
    setUser(getStoredUser());

    const handleStorage = () => {
      setUser(getStoredUser());
    };

    window.addEventListener(
      "storage",
      handleStorage,
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage,
      );
    };
  }, []);

  return user;
}

export function useAuth() {
  const user = useUser();
  const [isLoading, setIsLoading] =
    useState(false);

  const login = useCallback(
    async (
      email: string,
      password: string,
    ) => {
      setIsLoading(true);

      try {
        const result =
          (await loginApi(
            email,
            password,
          )) as LoginResult;

        const normalizedUser =
          normalizeUser(result);

        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(normalizedUser),
        );

        window.location.reload();
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(
      STORAGE_KEY,
    );

    window.location.reload();
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    login,
    logout,
  };
}