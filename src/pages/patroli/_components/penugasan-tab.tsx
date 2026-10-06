import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2, Clock, ClipboardList,
} from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table.tsx";
import {
  Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";

// PenugasanEditData WAJIB diekspor dari penugasan-form-dialog.tsx
// (export interface PenugasanEditData { ... }).
import PenugasanFormDialog from "./penugasan-form-dialog";
import type { PenugasanEditData } from "./penugasan-form-dialog";

function getApiUrl() {
  return (import.meta.env.VITE_API_URL || "http://localhost:3000").replace(/\/+$/, "");
}

type TugasRow = {
  id: number;
  officer_id: number;
  rute_id: number;
  site_id: number;
  tanggal: string;
  jam_mulai_rencana: string;
  jam_selesai_rencana: string;
  status: "BELUM_DIMULAI" | "SEDANG_BERLANGSUNG" | "SELESAI" | "DIBATALKAN";
  catatan?: string | null;
  nama_petugas?: string | null;
  jabatan_petugas?: string | null;
  nama_rute?: string | null;
  kode_rute?: string | null;
  total_checkpoints?: number | null;
  checkpoints_dikunjungi?: number | null;
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  BELUM_DIMULAI: { label: "Belum Dimulai", cls: "bg-secondary text-secondary-foreground" },
  SEDANG_BERLANGSUNG: { label: "Berlangsung", cls: "bg-blue-600 text-white" },
  SELESAI: { label: "Selesai", cls: "bg-green-600 text-white" },
  DIBATALKAN: { label: "Dibatalkan", cls: "bg-destructive text-white" },
};

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

/**
 * Mengonversi string DateTime ISO (misalnya "1970-01-01T21:16:00.000Z")
 * menjadi format jam "HH:mm". Menggunakan timeZone "UTC" karena jam
 * disimpan pada backend apa adanya tanpa konversi zona waktu.
 * Mengembalikan "—" apabila nilai tidak tersedia atau tidak valid.
 */
function formatJam(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

export default function PenugasanTab() {
  const navigate = useNavigate();

  // Filter rentang tanggal — konsisten dengan monitoring-tab.tsx,
  // menggantikan navigasi tanggal tunggal sebelumnya.
  const [tanggalMulaiDari, setTanggalMulaiDari] = useState(todayString());
  const [tanggalMulaiSampai, setTanggalMulaiSampai] = useState(todayString());

  const [tugas, setTugas] = useState<TugasRow[] | undefined>(undefined);
  const [error, setError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editPenugasan, setEditPenugasan] = useState<PenugasanEditData | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const fetchTugas = useCallback(async () => {
    try {
      setError("");
      const apiUrl = getApiUrl();

      // Endpoint dikonsolidasikan ke GET /api/patroli/tugas.
      // Endpoint /api/patroli/tugas/range TIDAK LAGI DIPAKAI.
      const params = new URLSearchParams({
        tanggal_mulai_dari: tanggalMulaiDari,
        tanggal_mulai_sampai: tanggalMulaiSampai,
      });

      const response = await fetch(
        `${apiUrl}/api/patroli/tugas?${params.toString()}`,
        { method: "GET", credentials: "include", cache: "no-store" },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          (result && result.message) || `Gagal mengambil data. HTTP ${response.status}`,
        );
      }

      const rows: TugasRow[] = Array.isArray(result) ? result : result?.data ?? [];
      setTugas(rows);
    } catch (err) {
      setTugas([]);
      setError(err instanceof Error ? err.message : "Gagal mengambil data tugas patroli");
    }
  }, [tanggalMulaiDari, tanggalMulaiSampai]);

  useEffect(() => {
    void fetchTugas();
  }, [fetchTugas]);

  const geserRentang = (delta: number) => {
    const geser = (tgl: string) => {
      const d = new Date(tgl + "T12:00:00");
      d.setDate(d.getDate() + delta);
      return format(d, "yyyy-MM-dd");
    };
    setTanggalMulaiDari((prev) => geser(prev));
    setTanggalMulaiSampai((prev) => geser(prev));
  };

  const isHariIni = tanggalMulaiDari === todayString() && tanggalMulaiSampai === todayString();

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const apiUrl = getApiUrl();

      const response = await fetch(`${apiUrl}/api/patroli/tugas/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error((result && result.message) || "Gagal menghapus penugasan");
      }

      toast.success("Penugasan dihapus");
      setTugas((current) => current?.filter((item) => item.id !== deleteId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setDeleteId(null);
    }
  };

  const openEdit = (row: TugasRow) => {
    setEditPenugasan({
      id: row.id,
      officer_id: row.officer_id,
      rute_id: row.rute_id != null ? String(row.rute_id) : null,
      site_id: row.site_id,
      tanggal: row.tanggal.slice(0, 10),
      // Dikonversi ke "HH:mm" agar sesuai dengan <input type="time">
      // pada penugasan-form-dialog.tsx.
      jam_mulai_rencana: formatJam(row.jam_mulai_rencana),
      jam_selesai_rencana: formatJam(row.jam_selesai_rencana),
      catatan: row.catatan ?? null,
    });
    setFormOpen(true);
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => geserRentang(-1)}>
            <ChevronLeft className="size-4" />
          </Button>

          <Input
            type="date"
            value={tanggalMulaiDari}
            onChange={(e) => setTanggalMulaiDari(e.target.value)}
            className="w-40"
          />
          <span className="text-muted-foreground text-sm">s/d</span>
          <Input
            type="date"
            value={tanggalMulaiSampai}
            onChange={(e) => setTanggalMulaiSampai(e.target.value)}
            className="w-40"
          />

          <Button variant="ghost" size="icon" onClick={() => geserRentang(1)}>
            <ChevronRight className="size-4" />
          </Button>

          {!isHariIni && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setTanggalMulaiDari(todayString());
                setTanggalMulaiSampai(todayString());
              }}
            >
              Hari Ini
            </Button>
          )}
        </div>

        <Button
          size="sm"
          onClick={() => { setEditPenugasan(null); setFormOpen(true); }}
        >
          <Plus className="size-4" /> Jadwalkan Patroli
        </Button>
      </div>

      {error && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void fetchTugas()}>
            Coba Lagi
          </Button>
        </div>
      )}

      {tugas === undefined ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : tugas.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><ClipboardList /></EmptyMedia>
            <EmptyTitle>Belum ada jadwal patroli</EmptyTitle>
            <EmptyDescription>
              Belum ada tugas patroli dijadwalkan pada rentang tanggal ini.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={() => { setEditPenugasan(null); setFormOpen(true); }}>
              Jadwalkan Patroli
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Petugas</TableHead>
                <TableHead>Rute</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Jam Rencana</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {tugas.map((row) => {
                const sc = STATUS_CONFIG[row.status] ?? {
                  label: row.status,
                  cls: "bg-secondary text-secondary-foreground",
                };

                const total = row.total_checkpoints ?? 0;
                const dikunjungi = row.checkpoints_dikunjungi ?? 0;
                const pct = total > 0 ? Math.round((dikunjungi / total) * 100) : 0;

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.nama_petugas ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.jabatan_petugas ?? ""}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-medium text-sm">{row.nama_rute ?? "—"}</div>
                      {row.kode_rute && (
                        <div className="text-xs text-muted-foreground">{row.kode_rute}</div>
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap text-sm">
                     {format(new Date(row.tanggal.slice(0, 10) + "T12:00:00"), "d MMM yyyy")}
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="size-3" />
                        {formatJam(row.jam_mulai_rencana)}–{formatJam(row.jam_selesai_rencana)}
                      </div>
                    </TableCell>

                    <TableCell>
                      {total > 0 ? (
                        <div className="min-w-[100px] space-y-1">
                          <Progress value={pct} className="h-1.5" />
                          <div className="text-xs text-muted-foreground">
                            {dikunjungi}/{total} checkpoint
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <Badge className={sc.cls}>{sc.label}</Badge>
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="h-7 cursor-pointer gap-1 text-xs"
                          onClick={() => navigate(`/patroli/tugas/${row.id}`)}
                        >
                          Mulai
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 cursor-pointer"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="size-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 cursor-pointer text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(row.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PenugasanFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditPenugasan(null); }}
        defaultTanggal={tanggalMulaiDari}
        editPenugasan={editPenugasan}
        onSuccess={() => void fetchTugas()}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Penugasan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}