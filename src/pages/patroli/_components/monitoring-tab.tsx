import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Clock, MapPin, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Input } from "@/components/ui/input.tsx";
import { request } from "@/lib/api.ts";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  BELUM_DIMULAI: { label: "Dijadwalkan", cls: "bg-secondary text-secondary-foreground" },
  BERLANGSUNG:   { label: "Berlangsung", cls: "bg-blue-600 text-white" },
  SELESAI:       { label: "Selesai", cls: "bg-green-600 text-white" },
  DIBATALKAN:    { label: "Dibatalkan", cls: "bg-destructive text-white" },
};

type TugasRow = {
  id: number;
  tanggal: string;
  jam_mulai_rencana: string | null;
  jam_selesai_rencana: string | null;
  status: string;
  nama_petugas: string | null;
  jabatan_petugas?: string | null;
  nama_rute: string | null;
  total_checkpoint: number;
  checkpoints_dikunjungi: number;
};

function todayString() {
  return format(new Date(), "yyyy-MM-dd");
}

function formatJam(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return format(d, "HH:mm");
}

function firstDayOfMonth(): string {
  const d = new Date();
  return format(new Date(d.getFullYear(), d.getMonth(), 1), "yyyy-MM-dd");
}

export default function MonitoringTab() {
  const navigate = useNavigate();
  const today = todayString();

  const [tugasHariIni, setTugasHariIni] = useState<TugasRow[] | undefined>(undefined);
  const [historyTugas, setHistoryTugas] = useState<TugasRow[] | undefined>(undefined);

  // Filter rentang tanggal untuk History Patroli
  const [tanggalMulaiDari, setTanggalMulaiDari] = useState(firstDayOfMonth());
  const [tanggalMulaiSampai, setTanggalMulaiSampai] = useState(today);

  useEffect(() => {
    request<TugasRow[]>(`/api/patroli/tugas?tanggal=${today}`)
      .then(setTugasHariIni)
      .catch(() => setTugasHariIni([]));
  }, [today]);

  useEffect(() => {
    if (!tanggalMulaiDari || !tanggalMulaiSampai) return;
    request<TugasRow[]>(
      `/api/patroli/tugas?tanggal_mulai_dari=${tanggalMulaiDari}&tanggal_mulai_sampai=${tanggalMulaiSampai}`
    )
      .then(setHistoryTugas)
      .catch(() => setHistoryTugas([]));
  }, [tanggalMulaiDari, tanggalMulaiSampai]);

  return (
    <div className="space-y-6">
      {/* Live Status */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 animate-pulse" />
          Patroli Hari Ini — <span className="font-normal text-muted-foreground capitalize">{format(new Date(), "EEEE, d MMM yyyy", { locale: idLocale })}</span>
        </h2>

        {tugasHariIni === undefined ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : tugasHariIni.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            Tidak ada tugas patroli hari ini
          </div>
        ) : (
          <div className="space-y-2">
            {tugasHariIni.map((row) => {
              const sc = STATUS_CONFIG[row.status] ?? { label: row.status, cls: "bg-secondary" };
              const pct = row.total_checkpoint > 0
                ? Math.round((row.checkpoints_dikunjungi / row.total_checkpoint) * 100)
                : 0;

              return (
                <div key={row.id} className="rounded-lg border p-4 flex flex-wrap items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{row.nama_petugas ?? "—"}</span>
                      <Badge className={sc.cls}>{sc.label}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{row.nama_rute ?? "—"}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {formatJam(row.jam_mulai_rencana)}–{formatJam(row.jam_selesai_rencana)}
                      </span>
                    </div>
                    {row.total_checkpoint > 0 && (
                      <div className="flex items-center gap-2 pt-1">
                        <Progress value={pct} className="h-1.5 flex-1" />
                        <span className="text-xs text-muted-foreground shrink-0">{row.checkpoints_dikunjungi}/{row.total_checkpoint}</span>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="sm" className="cursor-pointer shrink-0" onClick={() => navigate(`/patroli/tugas/${row.id}`)}>
                    Detail
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Peta GPS — DINONAKTIFKAN SEMENTARA */}
      <div>
        <h2 className="font-semibold mb-3 flex items-center gap-2">
          <MapPin className="size-4" /> Lokasi GPS Petugas Aktif
        </h2>
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          Fitur pelacakan GPS real-time memerlukan konfirmasi kolom koordinat pada schema.prisma.
        </div>
      </div>

      {/* History dengan filter rentang tanggal */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-semibold flex items-center gap-2">
            <Calendar className="size-4" /> History Patroli
          </h2>
          <div className="flex items-center gap-2">
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
          </div>
        </div>

        {historyTugas === undefined ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : historyTugas.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            Tidak ada riwayat patroli pada rentang tanggal ini
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tanggal</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Petugas</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Rute</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Progress</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {historyTugas.map((row) => {
                  const sc = STATUS_CONFIG[row.status] ?? { label: row.status, cls: "bg-secondary" };
                  const pct = row.total_checkpoint > 0
                    ? Math.round((row.checkpoints_dikunjungi / row.total_checkpoint) * 100)
                    : 0;
                  return (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => navigate(`/patroli/tugas/${row.id}`)}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        format(new Date(row.tanggal.slice(0, 10) + "T12:00:00"), "d MMM yyyy")
                      </td>
                      <td className="px-4 py-3">
                        <div>{row.nama_petugas ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{row.jabatan_petugas ?? ""}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{row.nama_rute ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 w-20" />
                          <span className="text-xs text-muted-foreground">{row.checkpoints_dikunjungi}/{row.total_checkpoint}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className={sc.cls}>{sc.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}