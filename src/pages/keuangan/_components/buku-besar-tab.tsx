import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button.tsx";
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

type Officer = {
  id: string | number;
  nama: string;
};

type Transaksi = {
  id: string | number;
  tanggal: string;
  tipe: "pemasukan" | "pengeluaran";
  kategori: string;
  jumlah: number;
  keterangan?: string | null;
  officerNama?: string | null;
};

async function request<T>(
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

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Permintaan gagal.");
  }

  return result.data ?? result;
}

export default function BukuBesarTab({
  periode,
}: {
  periode: string;
}) {
  const { canManageFinance, isLoading: roleLoading } = useRole();
  const isFinance = canManageFinance;

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [rows, setRows] = useState<Transaksi[] | null>(null);
  const [filterOfficer, setFilterOfficer] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<
    string | number | null
  >(null);

  const loadOfficers = useCallback(async () => {
    if (!isFinance) return;

    try {
      const data = await request<Officer[]>(
        "/api/officers?status=aktif",
      );
      setOfficers(data || []);
    } catch {
      toast.error("Gagal mengambil daftar petugas.");
    }
  }, [isFinance]);

  const loadTransactions = useCallback(async () => {
    if (roleLoading) return;

    try {
      const query = new URLSearchParams({ periode });

      if (isFinance && filterOfficer) {
        query.set("officerId", filterOfficer);
      }

      const endpoint = isFinance
        ? `/api/keuangan/transaksi?${query.toString()}`
        : `/api/keuangan/transaksi/me?${query.toString()}`;

      const data = await request<Transaksi[]>(endpoint);
      setRows(data || []);
    } catch (error) {
      setRows([]);

      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil transaksi.",
      );
    }
  }, [filterOfficer, isFinance, periode, roleLoading]);

  useEffect(() => {
    void loadOfficers();
  }, [loadOfficers]);

  useEffect(() => {
    void loadTransactions();
  }, [loadTransactions]);

  async function handleDelete() {
    if (!deleteTarget) return;

    try {
      await request(
        `/api/keuangan/transaksi/${deleteTarget}`,
        { method: "DELETE" },
      );

      toast.success("Transaksi dihapus.");
      setDeleteTarget(null);
      await loadTransactions();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus transaksi.",
      );
    }
  }

  const totalPemasukan =
    rows
      ?.filter((r) => r.tipe === "pemasukan")
      .reduce((sum, r) => sum + Number(r.jumlah), 0) ?? 0;

  const totalPengeluaran =
    rows
      ?.filter((r) => r.tipe === "pengeluaran")
      .reduce((sum, r) => sum + Number(r.jumlah), 0) ?? 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="size-4 text-green-500" />
            <span className="text-xs text-muted-foreground">
              Total Pemasukan
            </span>
          </div>
          <div className="font-semibold text-green-600">
            {formatRupiah(totalPemasukan)}
          </div>
        </div>

        <div className="rounded-lg border bg-card p-3">
          <div className="mb-1 flex items-center gap-2">
            <TrendingDown className="size-4 text-red-500" />
            <span className="text-xs text-muted-foreground">
              Total Pengeluaran
            </span>
          </div>
          <div className="font-semibold text-red-600">
            {formatRupiah(totalPengeluaran)}
          </div>
        </div>
      </div>

      {isFinance && (
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterOfficer || "all"}
            onValueChange={(value) =>
              setFilterOfficer(value === "all" ? "" : value)
            }
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua petugas" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">Semua petugas</SelectItem>

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

          <Button
            size="sm"
            className="ml-auto"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1 size-4" />
            Tambah Transaksi
          </Button>
        </div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <TrendingUp />
            </EmptyMedia>
            <EmptyTitle>Belum ada transaksi</EmptyTitle>
            <EmptyDescription>
              Transaksi periode ini akan muncul di sini.
            </EmptyDescription>
          </EmptyHeader>

          {isFinance && (
            <EmptyContent>
              <Button size="sm" onClick={() => setShowForm(true)}>
                Tambah
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Tanggal</th>
                {isFinance && (
                  <th className="px-3 py-2 text-left">Petugas</th>
                )}
                <th className="px-3 py-2 text-left">Kategori</th>
                <th className="px-3 py-2 text-right">Debit</th>
                <th className="px-3 py-2 text-right">Kredit</th>
                {isFinance && <th className="w-8 px-3 py-2" />}
              </tr>
            </thead>

            <tbody className="divide-y">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {row.tanggal}
                  </td>

                  {isFinance && (
                    <td className="px-3 py-2">
                      {row.officerNama || "-"}
                    </td>
                  )}

                  <td className="px-3 py-2 capitalize">
                    {row.kategori.replace(/_/g, " ")}
                    {row.keterangan
                      ? ` — ${row.keterangan}`
                      : ""}
                  </td>

                  <td className="px-3 py-2 text-right font-medium text-green-600">
                    {row.tipe === "pemasukan"
                      ? formatRupiah(row.jumlah)
                      : ""}
                  </td>

                  <td className="px-3 py-2 text-right font-medium text-red-600">
                    {row.tipe === "pengeluaran"
                      ? formatRupiah(row.jumlah)
                      : ""}
                  </td>

                  {isFinance && (
                    <td className="px-3 py-2">
                      {row.kategori === "manual" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-7"
                          onClick={() =>
                            setDeleteTarget(row.id)
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isFinance && (
        <AddTransaksiDialog
          open={showForm}
          onClose={() => setShowForm(false)}
          periode={periode}
          officers={officers}
          onSaved={loadTransactions}
        />
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus transaksi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddTransaksiDialog({
  open,
  onClose,
  periode,
  officers,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  periode: string;
  officers: Officer[];
  onSaved: () => Promise<void>;
}) {
  const today = format(new Date(), "yyyy-MM-dd");

  const [officerId, setOfficerId] = useState("");
  const [tanggal, setTanggal] = useState(today);
  const [tipe, setTipe] = useState<
    "pemasukan" | "pengeluaran"
  >("pemasukan");
  const [kategori, setKategori] = useState("manual");
  const [jumlah, setJumlah] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    const amount = Number(jumlah);

    if (!officerId || !jumlah || !Number.isFinite(amount)) {
      toast.error("Lengkapi data transaksi.");
      return;
    }

    if (amount <= 0) {
      toast.error("Jumlah harus lebih besar dari nol.");
      return;
    }

    setLoading(true);

    try {
      await request("/api/keuangan/transaksi", {
        method: "POST",
        body: JSON.stringify({
          officerId,
          tanggal,
          tipe,
          kategori,
          jumlah: amount,
          keterangan: keterangan || null,
          periode,
        }),
      });

      toast.success("Transaksi ditambahkan.");
      setOfficerId("");
      setJumlah("");
      setKeterangan("");
      onClose();
      await onSaved();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan transaksi.",
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
          <DialogTitle>Tambah Transaksi Manual</DialogTitle>
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
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={tanggal}
                onChange={(event) =>
                  setTanggal(event.target.value)
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tipe</Label>
              <Select
                value={tipe}
                onValueChange={(value) =>
                  setTipe(
                    value as "pemasukan" | "pengeluaran",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="pemasukan">
                    Pemasukan
                  </SelectItem>
                  <SelectItem value="pengeluaran">
                    Pengeluaran
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Jumlah (Rp)</Label>
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