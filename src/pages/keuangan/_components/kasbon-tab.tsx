import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, CreditCard, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type KasbonStatus = "aktif" | "lunas";

type Kasbon = {
  id: string | number;
  jumlah: number;
  sisa: number;
  cicilanPerBulan: number;
  tanggalPinjam: string;
  keterangan?: string | null;
  status: KasbonStatus;
  officerNama?: string | null;
};

type Officer = {
  id: string | number;
  nama: string;
};

type ApiResponse<T> = {
  data?: T;
  message?: string;
};

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
    ...options,
  });

  const result: ApiResponse<T> = await response
    .json()
    .catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Permintaan gagal.");
  }

  return result.data as T;
}

export default function KasbonTab() {
  const { canManageFinance, isLoading: roleLoading } = useRole();

  const isFinance = canManageFinance;

  const [statusFilter, setStatusFilter] = useState<
    "aktif" | "lunas" | ""
  >("");

  const [rows, setRows] = useState<Kasbon[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [payTarget, setPayTarget] = useState<Kasbon | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payLoading, setPayLoading] = useState(false);

  const loadKasbon = useCallback(async () => {
    const path = isFinance
  ? `/api/keuangan/kasbon${statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : ""}`
  : "/api/keuangan/kasbon/me";

    try {
      const data = await apiRequest<Kasbon[]>(path);
      setRows(data || []);
    } catch (error) {
      setRows([]);
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data kasbon.",
      );
    }
  }, [isFinance, statusFilter]);

  useEffect(() => {
    if (!roleLoading) {
      void loadKasbon();
    }
  }, [loadKasbon, roleLoading]);

  async function handleBayar() {
    if (!payTarget || !payAmount) {
      toast.error("Masukkan jumlah pembayaran.");
      return;
    }

    const amount = Number(payAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Jumlah pembayaran tidak valid.");
      return;
    }

    if (amount > payTarget.sisa) {
      toast.error("Pembayaran melebihi sisa kasbon.");
      return;
    }

    setPayLoading(true);

    try {
      await apiRequest(
        `/api/keuangan/kasbon/${payTarget.id}/pembayaran`,
        {
          method: "POST",
          body: JSON.stringify({
            jumlahBayar: amount,
          }),
        },
      );

      toast.success("Pembayaran kasbon berhasil dicatat.");
      setPayTarget(null);
      setPayAmount("");
      await loadKasbon();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan pembayaran.",
      );
    } finally {
      setPayLoading(false);
    }
  }

  if (roleLoading) {
    return <Skeleton className="h-48 w-full" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {isFinance && (
          <div className="flex gap-2">
            {(["", "aktif", "lunas"] as const).map((status) => (
              <Button
                key={status}
                size="sm"
                variant={
                  statusFilter === status ? "default" : "secondary"
                }
                onClick={() => setStatusFilter(status)}
              >
                {status === ""
                  ? "Semua"
                  : status === "aktif"
                    ? "Aktif"
                    : "Lunas"}
              </Button>
            ))}
          </div>
        )}

        {isFinance && (
          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 size-4" />
            Tambah Kasbon
          </Button>
        )}
      </div>

      {rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CreditCard />
            </EmptyMedia>
            <EmptyTitle>Tidak ada kasbon</EmptyTitle>
            <EmptyDescription>
              {statusFilter
                ? `Tidak ada kasbon ${statusFilter}.`
                : "Belum ada kasbon tercatat."}
            </EmptyDescription>
          </EmptyHeader>

          {isFinance && (
            <EmptyContent>
              <Button size="sm" onClick={() => setShowForm(true)}>
                Tambah Kasbon
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((kasbon) => {
            const lunas =
              kasbon.jumlah > 0
                ? Math.round(
                    ((kasbon.jumlah - kasbon.sisa) /
                      kasbon.jumlah) *
                      100,
                  )
                : 100;

            return (
              <div
                key={kasbon.id}
                className="space-y-3 rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {isFinance && (
                      <div className="font-medium">
                        {kasbon.officerNama || "Tanpa nama"}
                      </div>
                    )}

                    <div className="text-xs text-muted-foreground">
                      Pinjam: {kasbon.tanggalPinjam}
                    </div>

                    {kasbon.keterangan && (
                      <div className="text-xs text-muted-foreground">
                        {kasbon.keterangan}
                      </div>
                    )}
                  </div>

                  <Badge
                    variant={
                      kasbon.status === "aktif"
                        ? "secondary"
                        : "default"
                    }
                  >
                    {kasbon.status === "lunas" && (
                      <CheckCircle2 className="mr-1 size-3" />
                    )}
                    {kasbon.status === "aktif" ? "Aktif" : "Lunas"}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-xs text-muted-foreground">
                      Pinjam
                    </div>
                    <div className="font-medium">
                      {formatRupiah(kasbon.jumlah)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Sisa
                    </div>
                    <div className="font-medium text-red-500">
                      {formatRupiah(kasbon.sisa)}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground">
                      Cicilan/Bulan
                    </div>
                    <div className="font-medium">
                      {formatRupiah(kasbon.cicilanPerBulan)}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Terlunasi</span>
                    <span>{lunas}%</span>
                  </div>

                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(0, lunas))}%`,
                      }}
                    />
                  </div>
                </div>

                {isFinance && kasbon.status === "aktif" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setPayTarget(kasbon);
                      setPayAmount(
                        String(kasbon.cicilanPerBulan),
                      );
                    }}
                  >
                    Catat Pembayaran
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isFinance && (
        <AddKasbonDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          onSaved={loadKasbon}
        />
      )}

      <Dialog
        open={payTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayTarget(null);
            setPayAmount("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Catat Pembayaran Kasbon</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Sisa utang:{" "}
              <strong>
                {formatRupiah(payTarget?.sisa ?? 0)}
              </strong>
            </div>

            <div className="space-y-1.5">
              <Label>Jumlah Bayar (Rp)</Label>
              <Input
                type="number"
                min="1"
                value={payAmount}
                onChange={(event) =>
                  setPayAmount(event.target.value)
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPayTarget(null)}
            >
              Batal
            </Button>

            <Button
              onClick={() => void handleBayar()}
              disabled={payLoading}
            >
              {payLoading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddKasbonDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [officerId, setOfficerId] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [cicilan, setCicilan] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    void apiRequest<Officer[]>("/api/officers?status=aktif")
      .then((data) => setOfficers(data || []))
      .catch((error) => {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil daftar petugas.",
        );
      });
  }, [open]);

  async function handleSubmit() {
    const nominal = Number(jumlah);
    const cicilanBulanan = Number(cicilan);

    if (!officerId || !jumlah || !cicilan) {
      toast.error("Lengkapi data kasbon.");
      return;
    }

    if (
      !Number.isFinite(nominal) ||
      !Number.isFinite(cicilanBulanan) ||
      nominal <= 0 ||
      cicilanBulanan <= 0 ||
      cicilanBulanan > nominal
    ) {
      toast.error("Nominal kasbon atau cicilan tidak valid.");
      return;
    }

    setLoading(true);

    try {
      await apiRequest("/api/keuangan/kasbon", {
        method: "POST",
        body: JSON.stringify({
          officerId,
          jumlah: nominal,
          cicilanPerBulan: cicilanBulanan,
          tanggalPinjam: tanggal,
          keterangan: keterangan || null,
        }),
      });

      toast.success("Kasbon berhasil ditambahkan.");
      onClose();
      setOfficerId("");
      setJumlah("");
      setCicilan("");
      setTanggal(today);
      setKeterangan("");
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan kasbon.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Kasbon</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Petugas</Label>
            <Select value={officerId} onValueChange={setOfficerId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih petugas..." />
              </SelectTrigger>

              <SelectContent>
                {officers.map((officer) => (
                  <SelectItem
                    key={officer.id}
                    value={String(officer.id)}
                  >
                    {officer.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Jumlah Pinjam (Rp)</Label>
              <Input
                type="number"
                min="1"
                value={jumlah}
                onChange={(event) =>
                  setJumlah(event.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Cicilan/Bulan (Rp)</Label>
              <Input
                type="number"
                min="1"
                value={cicilan}
                onChange={(event) =>
                  setCicilan(event.target.value)
                }
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Tanggal Pinjam</Label>
            <Input
              type="date"
              value={tanggal}
              onChange={(event) => setTanggal(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Keterangan</Label>
            <Textarea
              rows={2}
              value={keterangan}
              onChange={(event) =>
                setKeterangan(event.target.value)
              }
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>

          <Button
            onClick={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}