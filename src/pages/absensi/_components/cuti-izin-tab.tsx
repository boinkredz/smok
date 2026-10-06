import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Plane, HeartPulse, Upload, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
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
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useRole } from "@/hooks/use-role.ts";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Status = "pending" | "approved" | "rejected";
type Jenis = "cuti" | "sakit";

type CutiRequest = {
  id: number;
  jenis: Jenis;
  status: Status;
  tanggalMulai: string;
  tanggalSelesai: string;
  alasan: string;
  catatan?: string | null;
  officerNama?: string | null;
  suratSakitUrl?: string | null;
};

type Officer = {
  id: number;
  nama: string;
};

type Balance = {
  jatahTotal: number;
  terpakai: number;
  sisa: number;
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(options?.headers ?? {}),
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ?? result?.error ?? "Terjadi kesalahan server.",
    );
  }

  return result?.data ?? result;
}

function statusLabel(status: Status) {
  if (status === "approved") return "Disetujui";
  if (status === "rejected") return "Ditolak";
  return "Menunggu";
}

function statusClass(status: Status) {
  if (status === "approved") {
    return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
  }

  if (status === "rejected") {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
  }

  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
}

export default function CutiIzinTab() {
  const { role, level } = useRole();

  const currentRole = String(role ?? level ?? "").toLowerCase();

  const isManager =
    currentRole.includes("admin") ||
    currentRole.includes("manager") ||
    currentRole.includes("manajer") ||
    currentRole.includes("supervisor") ||
    currentRole.includes("personalia") ||
    currentRole.includes("operasional") ||
    currentRole.includes("hr");

  const [tab, setTab] = useState<Status>("pending");
  const [requests, setRequests] = useState<CutiRequest[]>([]);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  async function loadData() {
    try {
      setLoading(true);

      const endpoint = isManager
        ? `/api/cuti?status=${tab}`
        : "/api/cuti/me";

      const [requestData, balanceData] = await Promise.all([
        request<CutiRequest[]>(endpoint),
        request<Balance>("/api/cuti/balance"),
      ]);

      setRequests(Array.isArray(requestData) ? requestData : []);
      setBalance(balanceData);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memuat data cuti.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [isManager, tab]);

  async function handleAction(
    id: number,
    action: "approve" | "reject",
  ) {
    const catatan = window.prompt("Catatan, opsional:") ?? "";

    try {
      await request(`/api/cuti/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify({
          catatan: catatan.trim() || undefined,
        }),
      });

      toast.success(
        action === "approve"
          ? "Pengajuan berhasil disetujui."
          : "Pengajuan berhasil ditolak.",
      );

      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memproses pengajuan.",
      );
    }
  }

  return (
    <div className="space-y-4">
      {!isManager && balance && (
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold">{balance.jatahTotal}</div>
            <div className="text-xs text-muted-foreground">
              Jatah Total
            </div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">
              {balance.terpakai}
            </div>
            <div className="text-xs text-muted-foreground">Terpakai</div>
          </div>

          <div className="rounded-lg border bg-card p-3 text-center">
            <div className="text-2xl font-bold text-green-600">
              {balance.sisa}
            </div>
            <div className="text-xs text-muted-foreground">Sisa Cuti</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide">
          {isManager ? "Pengajuan Cuti dan Sakit" : "Pengajuan Saya"}
        </h3>

        <Button size="sm" onClick={() => setFormOpen(true)}>
          <Plus className="mr-1 size-4" />
          Ajukan
        </Button>
      </div>

      {isManager && (
        <div className="flex gap-2">
          {(["pending", "approved", "rejected"] as Status[]).map(
            (status) => (
              <Button
                key={status}
                size="sm"
                variant={tab === status ? "default" : "outline"}
                onClick={() => setTab(status)}
              >
                {statusLabel(status)}
              </Button>
            ),
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-28 w-full" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="rounded-lg border p-8 text-center">
          <Plane className="mx-auto mb-2 size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Belum ada pengajuan cuti atau sakit.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map((item) => {
            const start = new Date(`${item.tanggalMulai}T12:00:00`);
            const end = new Date(`${item.tanggalSelesai}T12:00:00`);
            const days =
              Math.round(
                (end.getTime() - start.getTime()) / 86_400_000,
              ) + 1;

            return (
              <div key={item.id} className="space-y-2 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      {item.jenis === "cuti" ? (
                        <Plane className="size-4 text-blue-500" />
                      ) : (
                        <HeartPulse className="size-4 text-red-500" />
                      )}

                      <span className="font-medium">
                        {item.jenis === "cuti" ? "Cuti" : "Sakit"}
                        {item.officerNama && ` — ${item.officerNama}`}
                      </span>

                      <Badge className={statusClass(item.status)}>
                        {statusLabel(item.status)}
                      </Badge>

                      <Badge variant="secondary">
                        {days} hari
                      </Badge>
                    </div>

                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.tanggalMulai} s/d {item.tanggalSelesai}
                    </p>

                    <p className="mt-1 text-sm">{item.alasan}</p>

                    {item.catatan && (
                      <p className="mt-1 text-xs text-primary">
                        Catatan: {item.catatan}
                      </p>
                    )}
                  </div>

                  {item.suratSakitUrl && (
                    <a
                      href={item.suratSakitUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline"
                    >
                      Surat Sakit
                    </a>
                  )}
                </div>

                {isManager && item.status === "pending" && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleAction(item.id, "approve")}
                    >
                      Setujui
                    </Button>

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(item.id, "reject")}
                    >
                      Tolak
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CutiRequestForm
        open={formOpen}
        isManager={isManager}
        onClose={() => {
          setFormOpen(false);
          void loadData();
        }}
      />
    </div>
  );
}

function CutiRequestForm({
  open,
  isManager,
  onClose,
}: {
  open: boolean;
  isManager: boolean;
  onClose: () => void;
}) {
  const today = format(new Date(), "yyyy-MM-dd");
  const fileRef = useRef<HTMLInputElement>(null);

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [jenis, setJenis] = useState<Jenis>("cuti");
  const [officerId, setOfficerId] = useState("self");
  const [tanggalMulai, setTanggalMulai] = useState(today);
  const [tanggalSelesai, setTanggalSelesai] = useState(today);
  const [alasan, setAlasan] = useState("");
  const [suratFile, setSuratFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !isManager) return;

    request<Officer[]>("/api/officers?status=aktif")
      .then((data) => setOfficers(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Gagal memuat daftar petugas."));
  }, [open, isManager]);

  async function submit() {
    if (!alasan.trim()) {
      toast.error("Alasan wajib diisi.");
      return;
    }

    if (tanggalSelesai < tanggalMulai) {
      toast.error("Tanggal selesai tidak valid.");
      return;
    }

    if (jenis === "sakit" && !suratFile && !isManager) {
      toast.error("Surat sakit wajib diupload.");
      return;
    }

    try {
      setLoading(true);

      let suratSakitUrl: string | undefined;

      if (suratFile) {
        const formData = new FormData();
        formData.append("file", suratFile);

        const upload = await request<{ url: string }>(
          "/api/cuti/upload",
          {
            method: "POST",
            body: formData,
          },
        );

        suratSakitUrl = upload.url;
      }

      await request("/api/cuti", {
        method: "POST",
        body: JSON.stringify({
          jenis,
          officerId:
            isManager && officerId !== "self"
              ? Number(officerId)
              : undefined,
          tanggalMulai,
          tanggalSelesai,
          alasan: alasan.trim(),
          suratSakitUrl,
        }),
      });

      toast.success("Pengajuan berhasil dikirim.");
      setAlasan("");
      setSuratFile(null);
      setJenis("cuti");
      setOfficerId("self");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengajukan cuti.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan Cuti atau Izin Sakit</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isManager && (
            <div className="space-y-1.5">
              <Label>Petugas</Label>
              <Select value={officerId} onValueChange={setOfficerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih petugas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="self">Diri sendiri</SelectItem>
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
          )}

          <div className="space-y-1.5">
            <Label>Jenis Pengajuan</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={jenis === "cuti" ? "default" : "outline"}
                onClick={() => setJenis("cuti")}
              >
                <Plane className="mr-2 size-4" />
                Cuti
              </Button>

              <Button
                type="button"
                variant={jenis === "sakit" ? "default" : "outline"}
                onClick={() => setJenis("sakit")}
              >
                <HeartPulse className="mr-2 size-4" />
                Sakit
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tanggal Mulai</Label>
              <Input
                type="date"
                value={tanggalMulai}
                onChange={(e) => setTanggalMulai(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Tanggal Selesai</Label>
              <Input
                type="date"
                min={tanggalMulai}
                value={tanggalSelesai}
                onChange={(e) => setTanggalSelesai(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Alasan</Label>
            <Textarea
              rows={3}
              value={alasan}
              placeholder="Jelaskan alasan pengajuan..."
              onChange={(e) => setAlasan(e.target.value)}
            />
          </div>

          {jenis === "sakit" && (
            <div className="space-y-1.5">
              <Label>
                Surat Sakit {!isManager && "*"}
              </Label>

              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-dashed p-3 text-left"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="size-4" />
                <span className="text-sm text-muted-foreground">
                  {suratFile?.name ?? "Pilih foto atau PDF surat sakit"}
                </span>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) =>
                  setSuratFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>

          <Button onClick={submit} disabled={loading}>
            {loading ? "Mengirim..." : "Kirim Pengajuan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}