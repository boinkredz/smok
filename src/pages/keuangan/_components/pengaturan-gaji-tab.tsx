import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Settings, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";

import { useRole } from "@/hooks/use-role.ts";
import { formatRupiah } from "@/lib/utils.ts";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type Officer = {
  id: string | number;
  nama: string;
};

type KomponenGaji = {
  officerId: string | number;
  gajiPokok: number;
  tunjangan: number;
  bonusBackup: number;
  dendaPerMenit: number;
  bpjsPersen: number;
  pajakPersen: number;
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

export default function PengaturanGajiTab() {
  const { canManageFinance, isLoading: roleLoading } = useRole();

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [komponenList, setKomponenList] = useState<KomponenGaji[]>([]);
  const [editTarget, setEditTarget] = useState<{
    officerId: string | number;
    nama: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!canManageFinance) return;

    setLoading(true);

    try {
      const [officerData, komponenData] = await Promise.all([
        request<Officer[]>("/api/officers?status=aktif"),
        request<KomponenGaji[]>("/api/keuangan/komponen-gaji"),
      ]);

      setOfficers(officerData || []);
      setKomponenList(komponenData || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data komponen gaji.",
      );
    } finally {
      setLoading(false);
    }
  }, [canManageFinance]);

  useEffect(() => {
    if (!roleLoading) void loadData();
  }, [loadData, roleLoading]);

  if (!canManageFinance) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Hanya Admin dan Payroll/HR Admin yang dapat mengatur komponen gaji.
      </div>
    );
  }

  if (loading || roleLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  const komponenMap = new Map(
    komponenList.map((item) => [String(item.officerId), item]),
  );

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Atur komponen gaji setiap petugas. Klik ikon edit untuk mengubah.
      </div>

      {officers.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Settings />
            </EmptyMedia>
            <EmptyTitle>Tidak ada petugas aktif</EmptyTitle>
            <EmptyDescription>
              Tambahkan petugas terlebih dahulu.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left">Petugas</th>
                <th className="px-3 py-2 text-right">Gaji Pokok</th>
                <th className="hidden px-3 py-2 text-right sm:table-cell">
                  Tunjangan
                </th>
                <th className="hidden px-3 py-2 text-right md:table-cell">
                  Bonus Backup
                </th>
                <th className="hidden px-3 py-2 text-right md:table-cell">
                  BPJS
                </th>
                <th className="w-10 px-3 py-2" />
              </tr>
            </thead>

            <tbody className="divide-y">
              {officers.map((officer) => {
                const item = komponenMap.get(String(officer.id));

                return (
                  <tr key={officer.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium">
                      {officer.nama}
                    </td>

                    <td className="px-3 py-2 text-right">
                      {item ? (
                        formatRupiah(item.gajiPokok)
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Belum diset
                        </span>
                      )}
                    </td>

                    <td className="hidden px-3 py-2 text-right sm:table-cell">
                      {item ? formatRupiah(item.tunjangan) : "-"}
                    </td>

                    <td className="hidden px-3 py-2 text-right md:table-cell">
                      {item ? formatRupiah(item.bonusBackup) : "-"}
                    </td>

                    <td className="hidden px-3 py-2 text-right md:table-cell">
                      {item ? `${item.bpjsPersen}%` : "-"}
                    </td>

                    <td className="px-3 py-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        onClick={() =>
                          setEditTarget({
                            officerId: officer.id,
                            nama: officer.nama,
                          })
                        }
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editTarget && (
        <KomponenFormDialog
          officerId={editTarget.officerId}
          officerNama={editTarget.nama}
          existing={komponenMap.get(String(editTarget.officerId))}
          onClose={() => setEditTarget(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}

function KomponenFormDialog({
  officerId,
  officerNama,
  existing,
  onClose,
  onSaved,
}: {
  officerId: string | number;
  officerNama: string;
  existing?: KomponenGaji;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [gajiPokok, setGajiPokok] = useState(String(existing?.gajiPokok ?? ""));
  const [tunjangan, setTunjangan] = useState(String(existing?.tunjangan ?? ""));
  const [bonusBackup, setBonusBackup] = useState(String(existing?.bonusBackup ?? ""));
  const [dendaPerMenit, setDendaPerMenit] = useState(String(existing?.dendaPerMenit ?? ""));
  const [bpjsPersen, setBpjsPersen] = useState(String(existing?.bpjsPersen ?? 2));
  const [pajakPersen, setPajakPersen] = useState(String(existing?.pajakPersen ?? 0));
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!gajiPokok || Number(gajiPokok) <= 0) {
      toast.error("Gaji pokok wajib diisi.");
      return;
    }

    setSaving(true);

    try {
      await request("/api/keuangan/komponen-gaji", {
        method: "PUT",
        body: JSON.stringify({
          officerId,
          gajiPokok: Number(gajiPokok),
          tunjangan: Number(tunjangan) || 0,
          bonusBackup: Number(bonusBackup) || 0,
          dendaPerMenit: Number(dendaPerMenit) || 0,
          bpjsPersen: Number(bpjsPersen) || 0,
          pajakPersen: Number(pajakPersen) || 0,
        }),
      });

      toast.success("Komponen gaji disimpan.");
      await onSaved();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan komponen gaji.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Komponen Gaji — {officerNama}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Gaji Pokok (Rp)" value={gajiPokok} onChange={setGajiPokok} full />
          <Field label="Tunjangan (Rp)" value={tunjangan} onChange={setTunjangan} />
          <Field label="Bonus Backup/Shift (Rp)" value={bonusBackup} onChange={setBonusBackup} />
          <Field label="Denda per menit (Rp)" value={dendaPerMenit} onChange={setDendaPerMenit} />
          <Field label="BPJS (%)" value={bpjsPersen} onChange={setBpjsPersen} />
          <Field label="Pajak (%)" value={pajakPersen} onChange={setPajakPersen} />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={() => void handleSubmit()} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  full = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "col-span-2" : ""}`}>
      <Label>{label}</Label>
      <Input
        type="number"
        min="0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}