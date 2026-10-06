import { useEffect, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  QrCode,
  MapPinned,
  Flag,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
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
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";

import CheckpointFormDialog, {
  type CheckpointEditData,
} from "./checkpoint-form-dialog.tsx";
import QrDialog from "./qr-dialog.tsx";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const NO_ROUTE = "none";

type RouteRow = {
  id: string;
  nama: string;
};

type CheckpointRow = {
  id: string;
  ruteId: string;
  nama: string;
  urutan: number;
  deskripsi?: string | null;
  koordinat?: {
    lat: number;
    lng: number;
  } | null;
  qrCode: string;
};

type ApiResponse<T> = {
  data?: T;
  message?: string;
  error?: string;
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  const result =
    (await response.json().catch(() => null)) as
      | ApiResponse<T>
      | T
      | null;

  if (!response.ok) {
    const errorMessage =
      result &&
      typeof result === "object" &&
      "message" in result
        ? result.message
        : "Permintaan ke server gagal.";

    throw new Error(errorMessage || "Permintaan ke server gagal.");
  }

  if (
    result &&
    typeof result === "object" &&
    "data" in result
  ) {
    return result.data as T;
  }

  return result as T;
}

export default function CheckpointTab() {
  const [ruteId, setRuteId] = useState<string | null>(null);
  const [rutes, setRutes] = useState<RouteRow[]>([]);
  const [checkpoints, setCheckpoints] = useState<
    CheckpointRow[]
  >([]);

  const [loadingRutes, setLoadingRutes] = useState(true);
  const [loadingCheckpoints, setLoadingCheckpoints] =
    useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editCp, setEditCp] =
    useState<CheckpointEditData | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<{
    nama: string;
    qrCode: string;
  } | null>(null);

  async function loadRutes() {
    try {
      setLoadingRutes(true);

      const data = await request<RouteRow[]>(
        "/api/patroli/rute",
      );

      setRutes(data ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memuat daftar rute.",
      );
    } finally {
      setLoadingRutes(false);
    }
  }

  async function loadCheckpoints(selectedRuteId: string) {
    try {
      setLoadingCheckpoints(true);

      const data = await request<CheckpointRow[]>(
        `/api/patroli/rute/${selectedRuteId}/checkpoints`,
      );

      setCheckpoints(data ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal memuat checkpoint.",
      );
      setCheckpoints([]);
    } finally {
      setLoadingCheckpoints(false);
    }
  }

  useEffect(() => {
    void loadRutes();
  }, []);

  useEffect(() => {
    if (ruteId) {
      void loadCheckpoints(ruteId);
    } else {
      setCheckpoints([]);
    }
  }, [ruteId]);

  async function handleDelete() {
    if (!deleteId) return;

    try {
      await request(`/api/patroli/checkpoint/${deleteId}`, {
        method: "DELETE",
      });

      setCheckpoints((current) =>
        current.filter((checkpoint) => checkpoint.id !== deleteId),
      );

      toast.success("Checkpoint dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus checkpoint.",
      );
    } finally {
      setDeleteId(null);
    }
  }

  function openAdd() {
    setEditCp(null);
    setFormOpen(true);
  }

  function openEdit(checkpoint: CheckpointRow) {
    setEditCp({
      id: checkpoint.id,
      nama: checkpoint.nama,
      urutan: checkpoint.urutan,
      deskripsi: checkpoint.deskripsi ?? "",
      koordinat: checkpoint.koordinat ?? undefined,
      qrCode: checkpoint.qrCode,
    });

    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditCp(null);

    if (ruteId) {
      void loadCheckpoints(ruteId);
    }
  }

  const nextUrutan = checkpoints.length + 1;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Select
          value={ruteId ?? NO_ROUTE}
          onValueChange={(value) =>
            setRuteId(value === NO_ROUTE ? null : value)
          }
          disabled={loadingRutes}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Pilih rute patroli..." />
          </SelectTrigger>

          <SelectContent>
            <SelectItem value={NO_ROUTE}>
              Pilih rute patroli...
            </SelectItem>

            {rutes.map((rute) => (
              <SelectItem key={rute.id} value={rute.id}>
                {rute.nama}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          onClick={openAdd}
          disabled={!ruteId}
          className="cursor-pointer"
        >
          <Plus className="size-4" />
          Tambah Checkpoint
        </Button>
      </div>

      {!ruteId ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MapPinned />
            </EmptyMedia>
            <EmptyTitle>
              Pilih rute terlebih dahulu
            </EmptyTitle>
            <EmptyDescription>
              Pilih rute patroli untuk melihat dan mengelola
              checkpoint-nya.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : loadingCheckpoints ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-12 w-full"
            />
          ))}
        </div>
      ) : checkpoints.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Flag />
            </EmptyMedia>
            <EmptyTitle>
              Belum ada checkpoint
            </EmptyTitle>
            <EmptyDescription>
              Tambahkan checkpoint untuk rute ini.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">No</TableHead>
                <TableHead>Nama Checkpoint</TableHead>
                <TableHead>Koordinat</TableHead>
                <TableHead>Kode QR</TableHead>
                <TableHead className="w-40 text-right" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {checkpoints.map((checkpoint) => (
                <TableRow key={checkpoint.id}>
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className="text-[10px]"
                    >
                      #{checkpoint.urutan}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="font-medium">
                      {checkpoint.nama}
                    </div>

                    {checkpoint.deskripsi && (
                      <div className="line-clamp-1 text-xs text-muted-foreground">
                        {checkpoint.deskripsi}
                      </div>
                    )}
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {checkpoint.koordinat
                      ? `${checkpoint.koordinat.lat.toFixed(
                          5,
                        )}, ${checkpoint.koordinat.lng.toFixed(5)}`
                      : "Belum diset"}
                  </TableCell>

                  <TableCell>
                    <code className="text-xs text-muted-foreground">
                      {checkpoint.qrCode.slice(0, 8)}…
                    </code>
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 cursor-pointer gap-1 px-2 text-xs"
                        onClick={() =>
                          setQrTarget({
                            nama: checkpoint.nama,
                            qrCode: checkpoint.qrCode,
                          })
                        }
                      >
                        <QrCode className="size-4" />
                        QR
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 cursor-pointer"
                        onClick={() => openEdit(checkpoint)}
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 cursor-pointer text-destructive hover:text-destructive"
                        onClick={() =>
                          setDeleteId(checkpoint.id)
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {ruteId && (
        <CheckpointFormDialog
          open={formOpen}
          onClose={handleFormClose}
          ruteId={ruteId}
          defaultUrutan={nextUrutan}
          editCheckpoint={editCp}
        />
      )}

      <QrDialog
        open={Boolean(qrTarget)}
        onClose={() => setQrTarget(null)}
        checkpoint={qrTarget}
      />

      <AlertDialog
        open={Boolean(deleteId)}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Hapus Checkpoint?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>

            <AlertDialogAction
              onClick={() => void handleDelete()}
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