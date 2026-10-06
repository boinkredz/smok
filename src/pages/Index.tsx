import { useAuth } from "@/hooks/use-auth";

export default function Index() {
  const { user } = useAuth();

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">
          Dashboard
        </h1>

        <p className="mt-2 text-muted-foreground">
          Selamat datang, {user?.name ?? "Pengguna"}.
        </p>

        <div className="mt-6 rounded-lg border bg-card p-6">
          <p className="text-sm text-muted-foreground">
            Dashboard PostgreSQL sedang dalam proses migrasi.
          </p>

          {user && (
            <div className="mt-4 space-y-1 text-sm">
              <p>
                <strong>Email:</strong> {user.email}
              </p>
              <p>
                <strong>Role:</strong> {user.role}
              </p>
              <p>
                <strong>Role ID:</strong> {user.roleId}
              </p>
              <p>
                <strong>Level:</strong> {user.level}
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}