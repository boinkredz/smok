import {
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  FileText,
  Lock,
  RefreshCw,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type RekapId = string | number;

type Breakdown = {
  gajiPokok: number;
  tunjangan: number;
  bonusBackup: number;
  jumlahBackup: number;
  dendaTerlambat: number;
  menitTerlambat: number;
  cicilanKasbon: number;
  bpjs: number;
  pajak: number;
  potonganManual: number;
  tambahanManual: number;
};

type RekapGaji = {
  id: RekapId;
  status: "draft" | "final" | string;
  totalPemasukan: number;
  totalPotongan: number;
  gajiBersih: number;
  officerNama?: string | null;
  breakdown: Breakdown;
};

type ApiResult<T = unknown> = {
  data?: T;
  message?: string;
  sukses?: number;
  gagal?: number;
};

export default function RekapGajiTab({
  periode,
}: {
  periode: string;
}) {
const { canManageFinance } = useRole();
const isFinance = canManageFinance;

  const [rekaps, setRekaps] = useState<RekapGaji[] | null>(
    isFinance ? null : [],
  );
  const [myRekap, setMyRekap] = useState<RekapGaji | null>(null);
  const [loadingGenerate, setLoadingGenerate] = useState(false);
  const [confirmFinalisasi, setConfirmFinalisasi] =
    useState<RekapId | null>(null);
  const [expandedId, setExpandedId] = useState<RekapId | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState<string | null>(
    null,
  );

  const loadRekap = useCallback(async () => {
    const path = isFinance
      ? `/api/keuangan/rekap?periode=${encodeURIComponent(periode)}`
      : `/api/keuangan/rekap/me?periode=${encodeURIComponent(periode)}`;

    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
    });

    const result: ApiResult<RekapGaji[] | RekapGaji | null> =
      await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Gagal mengambil rekap gaji.");
    }

    if (isFinance) {
      setRekaps((result.data as RekapGaji[]) ?? []);
    } else {
      setMyRekap((result.data as RekapGaji | null) ?? null);
    }
  }, [isFinance, periode]);

  useEffect(() => {
    void loadRekap().catch((error) => {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data rekap gaji.",
      );

      if (isFinance) setRekaps([]);
      else setMyRekap(null);
    });
  }, [loadRekap, isFinance]);

  async function request(
    path: string,
    method: "POST" | "PATCH",
    body?: unknown,
  ) {
    const response = await fetch(`${API_URL}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const result: ApiResult = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.message || "Operasi gagal.");
    }

    return result;
  }

  async function handleGenerateAll() {
    setLoadingGenerate(true);

    try {
      const result = await request(
        "/api/keuangan/rekap/generate-all",
        "POST",
        { periode },
      );

      toast.success(
        `Generate selesai: ${result.sukses ?? 0} sukses, ${
          result.gagal ?? 0
        } gagal`,
      );

      await loadRekap();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal generate rekap.",
      );
    } finally {
      setLoadingGenerate(false);
    }
  }

  async function handleFinalisasi(id: RekapId) {
    setActionLoading(String(id));

    try {
      await request(
        `/api/keuangan/rekap/${id}/finalisasi`,
        "PATCH",
      );

      toast.success("Rekap berhasil difinalisasi");
      await loadRekap();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal finalisasi.",
      );
    } finally {
      setActionLoading(null);
      setConfirmFinalisasi(null);
    }
  }

  async function handleBatalFinalisasi(id: RekapId) {
    setActionLoading(`${id}_batal`);

    try {
      await request(
        `/api/keuangan/rekap/${id}/batal-finalisasi`,
        "PATCH",
      );

      toast.success("Finalisasi berhasil dibatalkan");
      await loadRekap();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal membatalkan finalisasi.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  if (!isFinance) {
    if (myRekap === null) {
      return (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Slip gaji belum tersedia</EmptyTitle>
            <EmptyDescription>
              Rekap gaji periode ini belum digenerate.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <RekapCard
        rekap={myRekap}
        expanded
        showOfficerName={false}
        onToggle={() => undefined}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Rekap Gaji — {periode}
        </h3>

        <Button
          size="sm"
          onClick={handleGenerateAll}
          disabled={loadingGenerate}
        >
          <RefreshCw
            className={`mr-1 size-4 ${
              loadingGenerate ? "animate-spin" : ""
            }`}
          />
          {loadingGenerate ? "Memproses..." : "Generate Semua"}
        </Button>
      </div>

      {rekaps === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : rekaps.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Belum ada rekap</EmptyTitle>
            <EmptyDescription>
              Klik Generate Semua untuk membuat rekap gaji.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={handleGenerateAll}
              disabled={loadingGenerate}
            >
              Generate Semua
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {rekaps.map((rekap) => (
            <RekapCard
              key={rekap.id}
              rekap={rekap}
              expanded={expandedId === rekap.id}
              showOfficerName
              onToggle={() =>
                setExpandedId(
                  expandedId === rekap.id ? null : rekap.id,
                )
              }
              extraActions={
                <div className="mt-3 flex gap-2">
                  {rekap.status === "draft" ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        setConfirmFinalisasi(rekap.id)
                      }
                      disabled={actionLoading === String(rekap.id)}
                    >
                      <Lock className="mr-1 size-3.5" />
                      Finalisasi
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        handleBatalFinalisasi(rekap.id)
                      }
                      disabled={
                        actionLoading === `${rekap.id}_batal`
                      }
                    >
                      <Unlock className="mr-1 size-3.5" />
                      Batal Finalisasi
                    </Button>
                  )}
                </div>
              }
            />
          ))}
        </div>
      )}

      <AlertDialog
        open={confirmFinalisasi !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmFinalisasi(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Finalisasi Rekap Gaji?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Setelah difinalisasi, rekap tidak dapat diubah kecuali
              finalisasi dibatalkan oleh admin.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmFinalisasi !== null) {
                  void handleFinalisasi(confirmFinalisasi);
                }
              }}
            >
              Finalisasi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RekapCard({
  rekap,
  expanded,
  showOfficerName,
  onToggle,
  extraActions,
}: {
  rekap: RekapGaji;
  expanded: boolean;
  showOfficerName: boolean;
  onToggle: () => void;
  extraActions?: ReactNode;
}) {
  const b = rekap.breakdown;

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30"
      >
        <div className="space-y-0.5">
          {showOfficerName && (
            <div className="font-medium">
              {rekap.officerNama || "Tanpa nama"}
            </div>
          )}

          <div className="text-sm font-semibold text-green-600">
            {formatRupiah(rekap.gajiBersih)}
          </div>

          <div className="text-xs text-muted-foreground">
            +{formatRupiah(rekap.totalPemasukan)} / -
            {formatRupiah(rekap.totalPotongan)}
          </div>
        </div>

        <Badge
          variant={rekap.status === "final" ? "default" : "secondary"}
        >
          {rekap.status === "final" && (
            <CheckCircle2 className="mr-1 size-3" />
          )}
          {rekap.status === "final" ? "Final" : "Draft"}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-3 border-t px-4 pb-4 pt-3">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
            <DetailRow label="Gaji Pokok" value={formatRupiah(b.gajiPokok)} />
            <DetailRow label="Tunjangan" value={formatRupiah(b.tunjangan)} />
            <DetailRow
              label={`Bonus Backup (${b.jumlahBackup}x)`}
              value={formatRupiah(b.bonusBackup)}
            />
            {b.tambahanManual > 0 && (
              <DetailRow
                label="Tambahan Manual"
                value={formatRupiah(b.tambahanManual)}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 border-t pt-2 text-sm">
            <DetailRow
              label={`Denda Terlambat (${b.menitTerlambat} mnt)`}
              value={formatRupiah(b.dendaTerlambat)}
              deduction
            />
            <DetailRow
              label="Cicilan Kasbon"
              value={formatRupiah(b.cicilanKasbon)}
              deduction
            />
            <DetailRow
              label="BPJS"
              value={formatRupiah(b.bpjs)}
              deduction
            />
            <DetailRow
              label="Pajak"
              value={formatRupiah(b.pajak)}
              deduction
            />
            {b.potonganManual > 0 && (
              <DetailRow
                label="Potongan Manual"
                value={formatRupiah(b.potonganManual)}
                deduction
              />
            )}
          </div>

          <div className="flex justify-between border-t pt-2 font-semibold">
            <span>Gaji Bersih</span>
            <span className="text-green-600">
              {formatRupiah(rekap.gajiBersih)}
            </span>
          </div>

          {extraActions}
        </div>
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  deduction,
}: {
  label: string;
  value: string;
  deduction?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={deduction ? "text-red-500" : "text-foreground"}>
        {deduction ? "−" : ""}
        {value}
      </span>
    </div>
  );
}