import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";
import {
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserMinus,
  UserRound,
  Users,
  Plane,
} from "lucide-react";

import PageHeader from "@/components/page-header.tsx";
import StatCard from "@/components/stat-card.tsx";
import { useRole } from "@/hooks/use-role.ts";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import {
  Card,
  CardContent,
} from "@/components/ui/card.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

import OfficerFormDialog from "./_components/officer-form-dialog.tsx";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

export type Officer = {
  id: number;
  userId: number | null;
  nama: string;
  nik: string;
  jabatan: string;
  lokasiTugas: string;
  telepon: string | null;
  email: string | null;
  status: "aktif" | "cuti" | "nonaktif";
  tanggalMasuk: string | null;
  catatan: string | null;
  supervisorId: number | null;
  danruId: number | null;
  facePhotoUrl: string | null;
  faceEnrolledAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type OfficerApi = {
  id?: number;
  userId?: number | null;

  nama?: string;
  name?: string;

  nik?: string;
  employee_number?: string;

  jabatan?: string;
  position?: string;

  lokasiTugas?: string;
  lokasi_tugas?: string;

  telepon?: string | null;
  phone?: string | null;

  email?: string | null;

  status?: "aktif" | "cuti" | "nonaktif";
  is_active?: boolean;

  tanggalMasuk?: string | null;
  catatan?: string | null;

  supervisorId?: number | null;
  danruId?: number | null;

  facePhotoUrl?: string | null;
  faceEnrolledAt?: string | null;

  createdAt?: string;
  updatedAt?: string;
};

type OfficerResponse =
  | OfficerApi[]
  | {
      data?: OfficerApi[];
      officers?: OfficerApi[];
      message?: string;
    };

const STATUS_STYLE: Record<string, string> = {
  aktif: "bg-chart-3/20 text-foreground",
  cuti: "bg-accent/25 text-foreground",
  nonaktif: "bg-muted text-muted-foreground",
};

const STATUS_LABEL: Record<string, string> = {
  aktif: "Aktif",
  cuti: "Cuti",
  nonaktif: "Nonaktif",
};

function normalizeRole(role: unknown): string {
  return String(role ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-");
}

function normalizeOfficer(item: OfficerApi): Officer {
  let status: Officer["status"] = "nonaktif";

  if (
    item.status === "aktif" ||
    item.status === "cuti" ||
    item.status === "nonaktif"
  ) {
    status = item.status;
  } else if (item.is_active === true) {
    status = "aktif";
  }

  return {
    id: Number(item.id ?? 0),
    userId: item.userId ?? null,

    nama: item.nama ?? item.name ?? "-",

    nik:
      item.nik ??
      item.employee_number ??
      "-",

    jabatan:
      item.jabatan ??
      item.position ??
      "-",

    lokasiTugas:
      item.lokasiTugas ??
      item.lokasi_tugas ??
      "-",

    telepon:
      item.telepon ??
      item.phone ??
      null,

    email: item.email ?? null,

    status,

    tanggalMasuk:
      item.tanggalMasuk ??
      null,

    catatan:
      item.catatan ??
      null,

    supervisorId:
      item.supervisorId ??
      null,

    danruId:
      item.danruId ??
      null,

    facePhotoUrl:
      item.facePhotoUrl ??
      null,

    faceEnrolledAt:
      item.faceEnrolledAt ??
      null,

    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function getRows(result: OfficerResponse): OfficerApi[] {
  if (Array.isArray(result)) {
    return result;
  }

  return result.data ?? result.officers ?? [];
}

export default function PetugasPage() {
  const { isSuperAdmin, isHr } = useRole();

/*
 * Hak kelola data petugas (tambah/ubah): hanya Super Admin dan HR.
 * SENGAJA TIDAK memakai canManagePersonnel dari use-role.ts,
 * sebab bendera tersebut turut menyertakan Finance, yang menurut
 * kebijakan modul ini secara eksplisit dilarang.
 */
const canManage = isSuperAdmin || isHr;

/*
 * Hak hapus data petugas dibatasi hanya untuk Super Admin sebagai
 * lapisan pertahanan berlapis (defense in depth), mengingat
 * penghapusan bersifat permanen dan tidak dapat dibatalkan.
 * TODO: konfirmasi apakah HR turut diizinkan menghapus.
 */
const isAdmin = isSuperAdmin;

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Officer | null>(null);
  const [deleting, setDeleting] = useState<Officer | null>(null);

  const loadOfficers = useCallback(async () => {
    try {
      setLoading(true);

      const response = await fetch(
        `${API_URL}/api/officers`,
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const result =
        (await response.json()) as OfficerResponse;

      if (!response.ok) {
        let message =
          "Gagal mengambil data petugas.";

        if (
          !Array.isArray(result) &&
          result.message
        ) {
          message = result.message;
        }

        throw new Error(message);
      }

      const rows = getRows(result);

      setOfficers(
        rows.map(normalizeOfficer),
      );
    } catch (error) {
      console.error(
        "GET /api/officers error:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memuat data petugas.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOfficers();
  }, [loadOfficers]);

  const stats = useMemo(
    () => ({
      total: officers.length,

      aktif: officers.filter(
        (item) => item.status === "aktif",
      ).length,

      cuti: officers.filter(
        (item) => item.status === "cuti",
      ).length,

      nonaktif: officers.filter(
        (item) => item.status === "nonaktif",
      ).length,
    }),
    [officers],
  );

  const filtered = useMemo(() => {
    const keyword = search
      .trim()
      .toLowerCase();

    if (!keyword) {
      return officers;
    }

    return officers.filter((officer) =>
      [
        officer.nama,
        officer.nik,
        officer.jabatan,
        officer.lokasiTugas,
        officer.telepon ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [officers, search]);

  const openCreateForm = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEditForm = (officer: Officer) => {
    setEditing(officer);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleting) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/officers/${deleting.id}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ??
            "Gagal menghapus petugas.",
        );
      }

      toast.success(
        "Petugas berhasil dihapus.",
      );

      setDeleting(null);

      await loadOfficers();
    } catch (error) {
      console.error(
        "DELETE /api/officers error:",
        error,
      );

      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus petugas.",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Petugas"
        description="Kelola identitas, jabatan, dan penempatan personel keamanan."
        action={
          canManage ? (
            <Button onClick={openCreateForm}>
              <Plus className="size-4" />
              Tambah Petugas
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map(
            (_, index) => (
              <Skeleton
                key={index}
                className="h-[86px] w-full"
              />
            ),
          )
        ) : (
          <>
            <StatCard
              label="Total petugas"
              value={stats.total}
              icon={Users}
            />

            <StatCard
              label="Aktif"
              value={stats.aktif}
              icon={UserCheck}
              tone="accent"
            />

            <StatCard
              label="Cuti"
              value={stats.cuti}
              icon={Plane}
            />

            <StatCard
              label="Nonaktif"
              value={stats.nonaktif}
              icon={UserMinus}
              tone="danger"
            />
          </>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

        <Input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Cari nama, NIK, jabatan, atau lokasi"
          className="max-w-md pl-9"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map(
            (_, index) => (
              <Skeleton
                key={index}
                className="h-48 w-full"
              />
            ),
          )}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UserRound />
            </EmptyMedia>

            <EmptyTitle>
              {officers.length === 0
                ? "Belum ada data petugas"
                : "Tidak ada hasil"}
            </EmptyTitle>

            <EmptyDescription>
              {officers.length === 0
                ? "Tambahkan personel keamanan pertama."
                : "Coba ubah kata kunci pencarian Anda."}
            </EmptyDescription>
          </EmptyHeader>

          {canManage && officers.length === 0 && (
            <EmptyContent>
              <Button onClick={openCreateForm}>
                Tambah Petugas
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {filtered.map((officer) => (
            <Card key={officer.id}>
              <CardContent className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {officer.nama}
                    </div>

                    <div className="font-mono text-xs text-muted-foreground">
                      {officer.nik}
                    </div>
                  </div>

                  <Badge
                    className={
                      STATUS_STYLE[
                        officer.status
                      ]
                    }
                  >
                    {
                      STATUS_LABEL[
                        officer.status
                      ]
                    }
                  </Badge>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <UserRound className="size-4 shrink-0" />

                    <span className="truncate">
                      {officer.jabatan}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" />

                    <span className="truncate">
                      {officer.lokasiTugas}
                    </span>
                  </div>

                  {officer.telepon && (
                    <div className="flex items-center gap-2">
                      <Phone className="size-4 shrink-0" />

                      <span className="truncate">
                        {officer.telepon}
                      </span>
                    </div>
                  )}
                </div>

                {canManage && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        openEditForm(officer);
                      }}
                    >
                      <Pencil className="size-4" />
                      Ubah
                    </Button>

                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleting(officer);
                        }}
                      >
                        <Trash2 className="size-4" />
                        Hapus
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <OfficerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        officer={editing}
        onSaved={loadOfficers}
      />

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus petugas ini?
            </AlertDialogTitle>

            <AlertDialogDescription>
              Data{" "}
              <strong>{deleting?.nama}</strong>{" "}
              akan dihapus permanen dan tidak
              dapat dikembalikan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>
              Batal
            </AlertDialogCancel>

            <AlertDialogAction
              onClick={handleDelete}
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}