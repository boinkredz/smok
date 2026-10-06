const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export type LoginResponse = {
  status: string;
  message: string;
  user: {
    id: string | number;
    email: string;
    name?: string | null;
    role?: string | null;
  };
};

export type LoginErrorResponse = {
  status?: string;
  message?: string;
  detail?: string;
};

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email: email.trim().toLowerCase(),
      password,
    }),
  });

  const contentType =
    response.headers.get("content-type") ?? "";

  const data: LoginErrorResponse | LoginResponse =
    contentType.includes("application/json")
      ? await response.json()
      : {
          message: await response.text(),
        };

  if (!response.ok) {
    const errorData = data as LoginErrorResponse;

    throw new Error(
      errorData.detail ||
        errorData.message ||
        `Login gagal dengan kode ${response.status}`,
    );
  }

  const loginData = data as LoginResponse;

  if (!loginData.user) {
    throw new Error("Respons login dari server tidak valid");
  }

  return loginData;
}

export async function logout(): Promise<void> {
  const response = await fetch(`${API_URL}/auth/logout`, {
    method: "POST",
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Logout gagal");
  }
}