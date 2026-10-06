import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
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
} from "@/components/ui/empty.tsx";
import { useRole } from "@/hooks/use-role.ts";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type SwapStatus = "pending" | "approved" | "rejected";

type SwapRequest = {
  id: number;
  status: SwapStatus;
  alasan?: string | null;
  requesterNama: string;
  targetNama: string;
  requesterTanggal: string;
  targetTanggal: string;
  requesterShiftNama: string;
  targetShiftNama: string;
};

type Officer = {
  id: number;
  nama: string;
};

type Assignment = {
  id: number;
  tanggal: string;
  shiftNama: string;
};

const STATUS_CONFIG: Record<
  SwapStatus,
  {
    label: string;
    color: string;
    icon: typeof Clock;
  }
> = {
  pending: {
    label: "Menunggu",
    color: "bg-yellow-100 text-yellow-800",
    icon: Clock,
  },
  approved: {
    label: "Disetujui",
    color: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Ditolak",
    color: "bg-red-100 text-red-800",
    icon: XCircle,
  },
};

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(result.message || "Terjadi kesalahan pada server");
  }

  return result;
}

export default function TukarShiftTab() {
  

  const { canManageOps } = useRole();

  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  async function loadSwaps() {
    setLoading(true);

    try {
      const scope = canManageOps ? "all" : "mine";

      const result = await apiFetch<{ data: SwapRequest[] }>(
        `/api/shifts/swap-requests?scope=${scope}`,
      );

      setSwaps(result.data || []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil permintaan tukar shift",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSwaps();
  }, [canManageOps]);

  async function updateStatus(
    id: number,
    status: "approve" | "reject",
  ) {
    setActionLoading(id);

    try {
      await apiFetch(`/api/shifts/swap-requests/${id}/${status}`, {
        method: "PATCH",
      });

      toast.success(
        status === "approve"
          ? "Tukar shift disetujui"
          : "Tukar shift ditolak",
      );

      await loadSwaps();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memproses permintaan",
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {canManageOps
            ? "Semua Permintaan Tukar Shift"
            : "Permintaan Tukar Shift Saya"}
        </h3>

        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1 size-4" />
          Ajukan Tukar Shift
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-20 w-full" />
          ))}
        </div>
      ) : swaps.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ArrowLeftRight />
            </EmptyMedia>
            <EmptyTitle>Belum ada permintaan</EmptyTitle>
            <EmptyDescription>
              Permintaan tukar shift akan muncul di sini
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-2">
          {swaps.map((swap) => {
            const config = STATUS_CONFIG[swap.status];
            const StatusIcon = config.icon;

            return (
              <div
                key={swap.id}
                className="rounded-lg border bg-card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {swap.requesterNama}
                      </span>

                      <ArrowLeftRight className="size-3.5 text-muted-foreground" />

                      <span className="text-sm font-medium">
                        {swap.targetNama}
                      </span>

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${config.color}`}
                      >
                        {config.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {swap.requesterTanggal} ({swap.requesterShiftNama})
                      </span>
                      <span>↔</span>
                      <span>
                        {swap.targetTanggal} ({swap.targetShiftNama})
                      </span>
                    </div>

                    {swap.alasan && (
                      <p className="text-xs text-muted-foreground">
                        Alasan: {swap.alasan}
                      </p>
                    )}
                  </div>

                  <StatusIcon className="mt-0.5 size-4 shrink-0 opacity-70" />
                </div>

                {canManageOps && swap.status === "pending" && (
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      disabled={actionLoading === swap.id}
                      onClick={() => updateStatus(swap.id, "approve")}
                    >
                      {actionLoading === swap.id ? "..." : "Setujui"}
                    </Button>

                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actionLoading === swap.id}
                      onClick={() => updateStatus(swap.id, "reject")}
                    >
                      {actionLoading === swap.id ? "..." : "Tolak"}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SwapRequestForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          void loadSwaps();
        }}
      />
    </div>
  );
}

function SwapRequestForm({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [myOfficerId, setMyOfficerId] = useState<number | null>(null);
  const [myAssignments, setMyAssignments] = useState<Assignment[]>([]);
  const [targetAssignments, setTargetAssignments] = useState<Assignment[]>([]);

  const [myAssignmentId, setMyAssignmentId] = useState("");
  const [targetOfficerId, setTargetOfficerId] = useState("");
  const [targetAssignmentId, setTargetAssignmentId] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const endDate = new Date(Date.now() + 30 * 86400000)
    .toISOString()
    .slice(0, 10);

  useEffect(() => {
    if (!open) return;

    async function loadFormData() {
      try {
        const [officerResult, meResult] = await Promise.all([
          apiFetch<{ data: Officer[] }>("/api/officers?status=aktif"),
          apiFetch<{ data: { id: number } }>("/api/officers/me"),
        ]);

        setOfficers(officerResult.data || []);
        setMyOfficerId(meResult.data.id);

        const assignments = await apiFetch<{ data: Assignment[] }>(
          `/api/shifts/assignments?officerId=${meResult.data.id}&tanggalMulai=${today}&tanggalSelesai=${endDate}`,
        );

        setMyAssignments(assignments.data || []);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data jadwal",
        );
      }
    }

    void loadFormData();
  }, [open]);

  useEffect(() => {
    if (!targetOfficerId) {
      setTargetAssignments([]);
      return;
    }

    async function loadTargetAssignments() {
      try {
        const result = await apiFetch<{ data: Assignment[] }>(
          `/api/shifts/assignments?officerId=${targetOfficerId}&tanggalMulai=${today}&tanggalSelesai=${endDate}`,
        );

        setTargetAssignments(result.data || []);
      } catch {
        toast.error("Gagal mengambil jadwal petugas tujuan");
      }
    }

    void loadTargetAssignments();
  }, [targetOfficerId]);

  async function handleSubmit() {
    if (!myAssignmentId || !targetAssignmentId) {
      toast.error("Pilih jadwal yang ingin ditukar");
      return;
    }

    setLoading(true);

    try {
      await apiFetch("/api/shifts/swap-requests", {
        method: "POST",
        body: JSON.stringify({
          requesterAssignmentId: Number(myAssignmentId),
          targetAssignmentId: Number(targetAssignmentId),
          alasan: alasan.trim() || null,
        }),
      });

      toast.success("Permintaan tukar shift berhasil diajukan");

      setMyAssignmentId("");
      setTargetOfficerId("");
      setTargetAssignmentId("");
      setAlasan("");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengajukan tukar shift",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan Tukar Shift</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Jadwal saya</Label>
            <Select value={myAssignmentId} onValueChange={setMyAssignmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih jadwal saya..." />
              </SelectTrigger>
              <SelectContent>
                {myAssignments.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.tanggal} — {item.shiftNama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Petugas tujuan</Label>
            <Select
              value={targetOfficerId}
              onValueChange={(value) => {
                setTargetOfficerId(value);
                setTargetAssignmentId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih petugas..." />
              </SelectTrigger>
              <SelectContent>
                {officers
                  .filter((officer) => officer.id !== myOfficerId)
                  .map((officer) => (
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

          {targetOfficerId && (
            <div className="space-y-1.5">
              <Label>Jadwal petugas tujuan</Label>
              <Select
                value={targetAssignmentId}
                onValueChange={setTargetAssignmentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jadwal tujuan..." />
                </SelectTrigger>
                <SelectContent>
                  {targetAssignments.map((item) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.tanggal} — {item.shiftNama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Alasan</Label>
            <Textarea
              rows={3}
              value={alasan}
              placeholder="Jelaskan alasan tukar shift..."
              onChange={(event) => setAlasan(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Mengajukan..." : "Ajukan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}