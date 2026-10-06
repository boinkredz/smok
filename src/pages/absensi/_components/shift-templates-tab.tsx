import { useEffect, useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
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
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";
import type { ShiftRow } from "./shift.types.ts";

import ShiftFormDialog from "./shift-form-dialog.tsx";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3000";

type ShiftResponse = {
  data?: ShiftRow[];
  shifts?: ShiftRow[];
};

export default function ShiftTemplatesTab() {
  const [shifts, setShifts] = useState<ShiftRow[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editShift, setEditShift] = useState<ShiftRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | number | null>(null);

  async function loadShifts() {
    try {
      setShifts(null);

      const response = await fetch(`${API_URL}/api/shifts`, {
        credentials: "include",
      });

      const result: ShiftResponse = await response.json();

      if (!response.ok) {
        throw new Error("Gagal mengambil data shift.");
      }

      setShifts(result.data ?? result.shifts ?? []);
    } catch (error) {
      setShifts([]);
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data shift.",
      );
    }
  }

  useEffect(() => {
    void loadShifts();
  }, []);

  async function handleDelete() {
    if (deleteId === null) return;

    try {
      const response = await fetch(
        `${API_URL}/api/shifts/${deleteId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message || "Gagal menghapus shift.",
        );
      }

      toast.success("Shift berhasil dihapus");
      setDeleteId(null);
      await loadShifts();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus shift.",
      );
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Template Shift
        </h2>

        <Button
          size="sm"
          onClick={() => {
            setEditShift(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" />
          Tambah Shift
        </Button>
      </div>

      {shifts === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : shifts.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarClock />
            </EmptyMedia>
            <EmptyTitle>Belum ada shift</EmptyTitle>
            <EmptyDescription>
              Buat template shift terlebih dahulu.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => {
                setEditShift(null);
                setFormOpen(true);
              }}
            >
              Tambah Shift
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift</TableHead>
                <TableHead>Jam Kerja</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {shifts.map((shift) => (
                <TableRow key={shift.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            shift.warnaTema || "#6B7280",
                        }}
                      />
                      <span className="font-medium">
                        {shift.nama}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">
                      {shift.jamMulai}–{shift.jamSelesai}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-sm text-muted-foreground">
                    {shift.keterangan || "—"}
                  </TableCell>

                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditShift(shift);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(shift.id)}
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

      <ShiftFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditShift(null);
          void loadShifts();
        }}
        editShift={editShift}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}