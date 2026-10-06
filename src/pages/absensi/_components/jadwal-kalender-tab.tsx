import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { cn } from "@/lib/utils.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet.tsx";
import { Checkbox } from "@/components/ui/checkbox.tsx";
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

import AssignmentFormDialog from "./assignment-form-dialog.tsx";
import type { AssignmentRow } from "../types/assig.ts";

const API_URL = import.meta.env.VITE_API_URL ?? "";

type Site = {
  id: number;
  name: string;
  kode?: string;
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ??
        result?.error ??
        "Terjadi kesalahan pada server.",
    );
  }

  return result?.data ?? result;
}

function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }

  return [];
}

export default function JadwalKalenderTab() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [siteFilter, setSiteFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editAssignment, setEditAssignment] =
    useState<AssignmentRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const rangeStart = format(calStart, "yyyy-MM-dd");
  const rangeEnd = format(calEnd, "yyyy-MM-dd");

  const [showLibur, setShowLibur] = useState(true);
  const [showMasuk, setShowMasuk] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);

      const siteQuery =
        siteFilter !== "all"
          ? `&siteId=${encodeURIComponent(siteFilter)}`
          : "";

      const [siteResult, assignmentResult] = await Promise.all([
        request<unknown>("/api/sites?aktifOnly=true"),
        request<unknown>(
          `/api/assignments?tanggal_mulai_dari=${rangeStart}&tanggal_mulai_sampai=${rangeEnd}${siteQuery}`,
        ),
      ]);

      setSites(extractArray<Site>(siteResult));
      setAssignments(extractArray<AssignmentRow>(assignmentResult));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data jadwal.",
      );
    } finally {
      setLoading(false);
    }
  }, [rangeStart, rangeEnd, siteFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const calDays = eachDayOfInterval({
    start: calStart,
    end: calEnd,
  });

  const byDate = useMemo(() => {
    const grouped: Record<string, AssignmentRow[]> = {};

    for (const assignment of assignments) {
      const key = assignment.tanggal.slice(0, 10);

      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(assignment);
    }

    return grouped;
  }, [assignments]);

  const filteredByDate = useMemo(() => {
  const grouped: Record<string, AssignmentRow[]> = {};

  for (const [tanggal, list] of Object.entries(byDate)) {
    const filtered = list.filter((assignment) => {
      const KODE_LIBUR = ["O", "C"]; // sesuaikan dengan hasil query
      const isLibur = KODE_LIBUR.includes(assignment.shifts?.kode ?? "");
      if (isLibur && !showLibur) return false;
      if (!isLibur && !showMasuk) return false;
      return true;
    });

    if (filtered.length > 0) {
      grouped[tanggal] = filtered;
    }
  }

  return grouped;
}, [byDate, showLibur, showMasuk]);

  const selectedAssignments = selectedDate
    ? byDate[selectedDate] ?? []
    : [];

  async function handleDelete() {
    if (deleteId === null) return;

    try {
      await request(`/api/assignments/${deleteId}`, {
        method: "DELETE",
      });

      toast.success("Jadwal berhasil dihapus.");
      setDeleteId(null);
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus jadwal.",
      );
    }
  }

  function openCreateForm(date?: string) {
    setSelectedDate(date ?? selectedDate);
    setEditAssignment(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditAssignment(null);
    void loadData();
  }

  const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setCurrentMonth((month) => subMonths(month, 1))
            }
          >
            <ChevronLeft className="size-4" />
          </Button>

          <span className="min-w-[160px] text-center text-sm font-semibold capitalize">
            {format(currentMonth, "MMMM yyyy", {
              locale: idLocale,
            })}
          </span>

          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              setCurrentMonth((month) => addMonths(month, 1))
            }
          >
            <ChevronRight className="size-4" />
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Bulan Ini
          </Button>
        </div>
        
        <div className="flex items-center gap-4 ml-4">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showMasuk} onCheckedChange={(v) => setShowMasuk(Boolean(v))} />
          Jadwal Masuk
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={showLibur} onCheckedChange={(v) => setShowLibur(Boolean(v))} />
          Hari Libur
        </label>
      </div>

        <div className="flex items-center gap-2">
          <Select value={siteFilter} onValueChange={setSiteFilter}>
            <SelectTrigger className="h-8 w-[160px] text-xs">
              <SelectValue placeholder="Semua Site" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="all">Semua Site</SelectItem>

              {sites.map((site) => (
                <SelectItem key={site.id} value={String(site.id)}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" onClick={() => openCreateForm()}>
            <Plus className="mr-1 size-4" />
            Jadwalkan
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {calDays.map((day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              const dayAssignments = filteredByDate[dateStr] ?? [];
              const inMonth = isSameMonth(day, currentMonth);
              const today = isToday(day);

              return (
                <div
                  key={dateStr}
                  onClick={() =>
                    setSelectedDate(
                      selectedDate === dateStr ? null : dateStr,
                    )
                  }
                  className={cn(
                    "min-h-[90px] cursor-pointer border-b border-r p-1.5 transition-colors",
                    !inMonth && "bg-muted/20 opacity-50",
                    selectedDate === dateStr && "bg-accent/10",
                    "hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium",
                      today && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </div>

                  <div className="space-y-0.5">
                    {dayAssignments.slice(0, 3).map((assignment) => (
                      <div
                        key={assignment.id}
                        className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white"
                        style={{
                          backgroundColor:
                            assignment.shifts?.warnaTema ?? "#6B7280",
                        }}
                      >
                        {assignment.officer?.nama?.split(" ")[0] ?? "Petugas"}
                        {assignment.shifts?.nama ?? "Shift"} ·{" "}
                        {assignment.shifts?.jamMulai ?? "--:--"}–
                        {assignment.shifts?.jamSelesai ?? "--:--"}
                      </div>
                    ))}

                    {dayAssignments.length > 3 && (
                      <div className="pl-1 text-[10px] text-muted-foreground">
                        +{dayAssignments.length - 3} lagi
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Sheet
        open={!!selectedDate}
        onOpenChange={(value) => {
          if (!value) setSelectedDate(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="capitalize">
              {selectedDate
                ? format(
                    parseISO(`${selectedDate}T00:00:00`),
                    "EEEE, d MMMM yyyy",
                    { locale: idLocale },
                  )
                : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedAssignments.length} petugas dijadwalkan
              </span>

              <Button
                size="sm"
                onClick={() => openCreateForm(selectedDate ?? undefined)}
              >
                <Plus className="mr-1 size-4" />
                Tambah
              </Button>
            </div>

            {selectedAssignments.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada jadwal pada hari ini.
              </p>
            ) : (
              selectedAssignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="space-y-1 rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {assignment.officer?.nama ?? "Petugas tidak tersedia"}
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={() => {
                          setEditAssignment(assignment);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive"
                        onClick={() => setDeleteId(assignment.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  <Badge variant="secondary" className="text-xs">
                    {assignment.shifts?.nama ?? "Shift"} ·{" "}
                    {assignment.shifts?.jamMulai ?? "--:--"}–
                    {assignment.shifts?.jamSelesai ?? "--:--"}
                  </Badge>

                  {assignment.catatan && (
                    <p className="text-xs text-muted-foreground">
                      {assignment.catatan}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AssignmentFormDialog
        open={formOpen}
        onClose={closeForm}
        defaultDate={
          selectedDate ??
          format(new Date(), "yyyy-MM-dd")
        }
        editAssignment={editAssignment}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(value) => {
          if (!value) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
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