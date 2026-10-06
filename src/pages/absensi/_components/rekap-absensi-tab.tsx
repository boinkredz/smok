import { useEffect, useState } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Download,
  CalendarDays,
  UserCheck,
  Clock,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";

import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
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
import StatCard from "@/components/stat-card.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type RekapRow = {
  officerId: string | number;
  nama: string;
  jabatan: string;
  lokasiTugas: string;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  alpha: number;
  total: number;
};

type RekapResponse = {
  data?: RekapRow[];
  rows?: RekapRow[];
  message?: string;
};

function Badge2({
  count,
  cls,
}: {
  count: number;
  cls: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {count}
    </span>
  );
}

function downloadExcel(
  rows: RekapRow[],
  mulai: string,
  selesai: string,
) {
  const data = rows.map((row) => ({
    Nama: row.nama,
    Jabatan: row.jabatan,
    Penempatan: row.lokasiTugas,
    Hadir: row.hadir,
    Terlambat: row.terlambat,
    Izin: row.izin,
    Sakit: row.sakit,
    Alpha: row.alpha,
    "Total Hari Dicatat": row.total,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    worksheet,
    "Rekap Absensi",
  );

  const columns = Object.keys(data[0] ?? {}).map((key) => ({
    wch:
      Math.max(
        key.length,
        ...data.map((row) =>
          String(row[key as keyof typeof row] ?? "").length,
        ),
      ) + 2,
  }));

  worksheet["!cols"] = columns;

  XLSX.writeFile(
    workbook,
    `Rekap_Absensi_${mulai}_${selesai}.xlsx`,
  );
}

export default function RekapAbsensiTab() {
  const today = format(new Date(), "yyyy-MM-dd");
  const firstOfMonth = format(
    startOfMonth(new Date()),
    "yyyy-MM-dd",
  );

  const [mulai, setMulai] = useState(firstOfMonth);
  const [selesai, setSelesai] = useState(today);
  const [data, setData] = useState<RekapRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mulai || !selesai) return;

    if (mulai > selesai) {
      setError("Tanggal mulai tidak boleh melebihi tanggal selesai.");
      setData([]);
      return;
    }

    const controller = new AbortController();

    async function loadRekap() {
      setData(null);
      setError(null);

      try {
        const params = new URLSearchParams({
          tanggalMulai: mulai,
          tanggalSelesai: selesai,
        });

        const response = await fetch(
          `${API_URL}/api/absensi/rekap?${params.toString()}`,
          {
            method: "GET",
            credentials: "include",
            signal: controller.signal,
          },
        );

        const result: RekapResponse = await response.json();

        if (!response.ok) {
          throw new Error(
            result.message || "Gagal mengambil rekap absensi.",
          );
        }

        setData(result.data ?? result.rows ?? []);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setData([]);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengambil rekap absensi.",
        );
      }
    }

    void loadRekap();

    return () => controller.abort();
  }, [mulai, selesai]);

  const rows = data ?? [];

  const totalHadir = rows.reduce(
    (sum, row) => sum + row.hadir,
    0,
  );
  const totalTerlambat = rows.reduce(
    (sum, row) => sum + row.terlambat,
    0,
  );
  const totalAlpha = rows.reduce(
    (sum, row) => sum + row.alpha,
    0,
  );
  const totalSemua = rows.reduce(
    (sum, row) => sum + row.total,
    0,
  );

  const displayRange =
    mulai && selesai
      ? `${format(
          new Date(`${mulai}T12:00:00`),
          "d MMM",
          { locale: idLocale },
        )} – ${format(
          new Date(`${selesai}T12:00:00`),
          "d MMM yyyy",
          { locale: idLocale },
        )}`
      : "—";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Dari tanggal
          </label>
          <Input
            type="date"
            value={mulai}
            onChange={(event) => setMulai(event.target.value)}
            className="h-8 w-40 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Sampai tanggal
          </label>
          <Input
            type="date"
            value={selesai}
            onChange={(event) => setSelesai(event.target.value)}
            className="h-8 w-40 text-sm"
          />
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMulai(firstOfMonth);
              setSelesai(today);
            }}
          >
            Bulan Ini
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setMulai(
                format(subDays(new Date(), 6), "yyyy-MM-dd"),
              );
              setSelesai(today);
            }}
          >
            7 Hari
          </Button>

          {data && data.length > 0 && (
            <Button
              size="sm"
              onClick={() => downloadExcel(data, mulai, selesai)}
            >
              <Download className="mr-1.5 size-4" />
              Download Excel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data === null ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-[86px] w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Tercatat"
            value={totalSemua}
            icon={CalendarDays}
          />
          <StatCard
            label="Hadir"
            value={totalHadir}
            icon={UserCheck}
            tone="accent"
          />
          <StatCard
            label="Terlambat"
            value={totalTerlambat}
            icon={Clock}
          />
          <StatCard
            label="Alpha"
            value={totalAlpha}
            icon={AlertTriangle}
            tone="danger"
          />
        </div>
      )}

      <div>
        <div className="mb-2 text-sm text-muted-foreground">
          Periode:{" "}
          <span className="font-medium text-foreground">
            {displayRange}
          </span>

          {data && (
            <span className="ml-2">
              · {data.length} petugas
            </span>
          )}
        </div>

        {data === null ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>Tidak ada data absensi</EmptyTitle>
              <EmptyDescription>
                Belum ada catatan absensi pada periode ini.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead>Penempatan</TableHead>
                  <TableHead className="text-center">Hadir</TableHead>
                  <TableHead className="text-center">
                    Terlambat
                  </TableHead>
                  <TableHead className="text-center">Izin</TableHead>
                  <TableHead className="text-center">Sakit</TableHead>
                  <TableHead className="text-center">Alpha</TableHead>
                  <TableHead className="text-center">Total</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.officerId}>
                    <TableCell className="font-medium">
                      {row.nama}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.jabatan}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.lokasiTugas}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge2
                        count={row.hadir}
                        cls="bg-green-100 text-green-700"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge2
                        count={row.terlambat}
                        cls="bg-yellow-100 text-yellow-700"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge2
                        count={row.izin}
                        cls="bg-blue-100 text-blue-700"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge2
                        count={row.sakit}
                        cls="bg-purple-100 text-purple-700"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      {row.alpha > 0 ? (
                        <Badge variant="destructive">
                          {row.alpha}
                        </Badge>
                      ) : (
                        <Badge2
                          count={0}
                          cls="bg-muted text-muted-foreground"
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-center font-semibold">
                      {row.total}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}