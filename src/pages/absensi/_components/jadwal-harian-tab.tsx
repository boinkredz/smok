import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
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
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty.tsx";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";

import AssignmentFormDialog from "./assignment-form-dialog.tsx";
import AbsensiFormDialog from "./absensi-form-dialog.tsx";
import { GenerateJadwalDialog } from "./generate-jadwal-dialog.tsx";
import { useRole } from "@/hooks/use-role.ts";
import type { AssignmentRow } from "../types/assig.ts";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const STATUS_CONFIG = {
  hadir: { label: "Hadir", cls: "bg-green-600 text-white" },
  terlambat: { label: "Terlambat", cls: "bg-yellow-500 text-white" },
  izin: { label: "Izin", cls: "bg-gray-500 text-white" },
  sakit: { label: "Sakit", cls: "bg-blue-500 text-white" },
  alpha: { label: "Alpha", cls: "bg-destructive text-white" },
} as const;

function todayString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function GeofenceIndicator({ row }: { row: AssignmentRow }) {
  const lokasi = row.absensi?.lokasiMasuk;

  if (!lokasi) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <MapPin className="size-3.5 cursor-help text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          GPS: {lokasi.lat.toFixed(5)}, {lokasi.lng.toFixed(5)}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function JadwalHarianTab() {
  // --- STATE RENTANG TANGGAL (pengganti selectedDate tunggal) ---
  const [tanggalMulaiDari, setTanggalMulaiDari] = useState(todayString());
  const [tanggalMulaiSampai, setTanggalMulaiSampai] = useState(todayString());

  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editAssignment, setEditAssignment] = useState<AssignmentRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [absensiTarget, setAbsensiTarget] = useState<AssignmentRow | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const { canManageOps } = useRole();

  async function loadAssignments() {
    try {
      setLoading(true);
      setLoadError("");

      const params = new URLSearchParams({
        tanggal_mulai_dari: tanggalMulaiDari,
        tanggal_mulai_sampai: tanggalMulaiSampai,
      });
      if (selectedReguId) params.set("reguId", selectedReguId);

      const response = await fetch(
        `${API_URL}/api/assignments?${params.toString()}`,
        { method: "GET", credentials: "include" },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message ?? "Gagal mengambil jadwal.");
      }

      const data = Array.isArray(result?.data)
        ? result.data
        : result?.data?.assignments ?? [];

      setAssignments(data);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Gagal mengambil jadwal.",
      );
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }

  type ReguOption = { id: number; nama: string };

    const [daftarRegu, setDaftarRegu] = useState<ReguOption[]>([]);
    const [selectedReguId, setSelectedReguId] = useState<string>("");

    useEffect(() => {
      async function loadRegu() {
        const response = await fetch(`${API_URL}/api/regu`, {
          credentials: "include",
        });
        const result = await response.json();
        if (response.ok) setDaftarRegu(result.data ?? []);
      }
      void loadRegu();
    }, []);

  useEffect(() => {
    void loadAssignments();
  }, [tanggalMulaiDari, tanggalMulaiSampai, selectedReguId]);

  // --- GESER RENTANG TANGGAL SEBAGAI SATU KESATUAN ---
  function changeDateRange(direction: number) {
    const dari = new Date(`${tanggalMulaiDari}T12:00:00`);
    const sampai = new Date(`${tanggalMulaiSampai}T12:00:00`);
    const panjangHari =
      Math.round((sampai.getTime() - dari.getTime()) / 86400000) + 1;

    dari.setDate(dari.getDate() + panjangHari * direction);
    sampai.setDate(sampai.getDate() + panjangHari * direction);

    setTanggalMulaiDari(format(dari, "yyyy-MM-dd"));
    setTanggalMulaiSampai(format(sampai, "yyyy-MM-dd"));
  }

  async function handleDelete() {
    if (!deleteId) {
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/assignments/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message ?? "Gagal menghapus jadwal.");
      }

      setAssignments((current) => current.filter((item) => item.id !== deleteId));
      toast.success("Jadwal berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus jadwal.",
      );
    } finally {
      setDeleteId(null);
    }
  }

  const isRentangHariIni =
    tanggalMulaiDari === todayString() && tanggalMulaiSampai === todayString();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => changeDateRange(-1)}>
            <ChevronLeft className="size-4" />
          </Button>

          <input
            type="date"
            value={tanggalMulaiDari}
            max={tanggalMulaiSampai}
            onChange={(e) => setTanggalMulaiDari(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
          />
          <span className="text-sm text-muted-foreground">s/d</span>
          <input
            type="date"
            value={tanggalMulaiSampai}
            min={tanggalMulaiDari}
            onChange={(e) => setTanggalMulaiSampai(e.target.value)}
            className="rounded-md border bg-transparent px-2 py-1 text-sm"
          />

          <Button variant="ghost" size="icon" onClick={() => changeDateRange(1)}>
            <ChevronRight className="size-4" />
          </Button>

          {!isRentangHariIni && (
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
          <Select value={selectedReguId} onValueChange={setSelectedReguId}>
  <SelectTrigger className="text-sm rounded-md border bg-transparent h-8 w-[190px] text-sm">
    <SelectValue placeholder="Semua Regu" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="semua">Semua Regu</SelectItem>
    <SelectItem value="tanpa-regu">Tanpa Regu (Back Office)</SelectItem>
    {daftarRegu.map((regu) => (
      <SelectItem key={regu.id} value={String(regu.id)}>
        {regu.nama}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
        </div>

        <div className="flex gap-2">
          {canManageOps && (
            <Button size="sm" variant="secondary" onClick={() => setGenerateOpen(true)}>
              <CalendarDays className="size-4" />
              Generate Jadwal
            </Button>
          )}

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setEditAssignment(null);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" />
            Jadwalkan Petugas
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-14 w-full" />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-md border p-4 text-sm text-destructive">
          {loadError}
        </div>
      ) : assignments.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>Belum ada jadwal</EmptyTitle>
            <EmptyDescription>
              Belum ada petugas yang dijadwalkan pada rentang tanggal ini.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => {
                setEditAssignment(null);
                setFormOpen(true);
              }}
            >
              Jadwalkan Petugas
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Petugas</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Site</TableHead>
                <TableHead>Absensi</TableHead>
                <TableHead>Foto</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {assignments.map((row) => {
                const absensi = row.absensi;
                const statusConfig = absensi ? STATUS_CONFIG[absensi.status] : null;

                return (
                  <TableRow key={row.id}>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(parseISO(row.tanggal), "dd MMM yyyy")}
                    </TableCell>

                    <TableCell>
                      <div className="font-medium">{row.officer?.nama ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.officer?.jabatan ?? "—"}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: row.shifts?.warnaTema ?? "#6B7280" }}
                        />
                        <span className="text-sm font-medium">
                          {row.shifts?.nama ?? "—"}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3" />
                        {row.jamMulai ?? "--:--"}–{row.jamSelesai ?? "--:--"}
                      </div>
                    </TableCell>

                    <TableCell className="text-sm text-muted-foreground">
                      {row.sites ? (
                        <Badge variant="secondary">{row.sites.name}</Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell>
                      {absensi && statusConfig ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Badge className={statusConfig.cls}>{statusConfig.label}</Badge>
                            <GeofenceIndicator row={row} />
                          </div>
                          {absensi.keterlambatanMenit ? (
                            <div className="text-xs text-muted-foreground">
                              +{absensi.keterlambatanMenit} menit
                            </div>
                          ) : null}
                          {absensi.waktuMasuk ? (
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(absensi.waktuMasuk), "HH:mm")}
                              {absensi.waktuKeluar
                                ? ` → ${format(new Date(absensi.waktuKeluar), "HH:mm")}`
                                : ""}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Belum dicatat</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <div className="flex gap-1">
                        {absensi?.fotoMasukUrl && (
                          <button type="button" onClick={() => setPhotoPreview(absensi.fotoMasukUrl!)}>
                            <img
                              src={absensi.fotoMasukUrl}
                              alt="Foto masuk"
                              className="size-8 cursor-pointer rounded border object-cover hover:opacity-80"
                            />
                          </button>
                        )}
                        {absensi?.fotoKeluarUrl && (
                          <button type="button" onClick={() => setPhotoPreview(absensi.fotoKeluarUrl!)}>
                            <img
                              src={absensi.fotoKeluarUrl}
                              alt="Foto keluar"
                              className="size-8 cursor-pointer rounded border object-cover hover:opacity-80"
                            />
                          </button>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => setAbsensiTarget(row)}
                        >
                          Absen
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => {
                            setEditAssignment(row);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
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

      <AssignmentFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditAssignment(null);
          void loadAssignments();
        }}
        defaultDate={tanggalMulaiDari}
        editAssignment={editAssignment}
      />

      {absensiTarget && (
        <AbsensiFormDialog
          open={true}
          onClose={() => {
            setAbsensiTarget(null);
            void loadAssignments();
          }}
          assignmentId={absensiTarget.id}
          siteId={absensiTarget.siteId ?? undefined}
          officerNama={absensiTarget.officer?.nama ?? "—"}
          shiftNama={absensiTarget.shiftNama ?? "—"}
          shiftJamMulai={absensiTarget.jamMulai ?? "00:00"}
          tanggal={absensiTarget.tanggal}
          existingAbsensi={absensiTarget.absensi}
        />
      )}

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
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

      {photoPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPhotoPreview(null)}
        >
          <img
            src={photoPreview}
            alt="Foto absensi"
            className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-xl"
          />
        </div>
      )}

      <GenerateJadwalDialog
        open={generateOpen}
        onOpenChange={(nilai) => {
          setGenerateOpen(nilai);
          if (!nilai) void loadAssignments();
        }}
        bulan={parseISO(tanggalMulaiDari).getMonth() + 1}
        tahun={parseISO(tanggalMulaiDari).getFullYear()}
      />
    </div>
  );
}