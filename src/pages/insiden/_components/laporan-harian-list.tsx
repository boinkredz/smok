import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent,
} from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Plus,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { useRole } from "@/hooks/use-role.ts";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

import LaporanHarianFormDialog from "./laporan-harian-form-dialog.tsx";
import LaporanHarianDetailPanel from "./laporan-harian-detail-panel.tsx";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type LaporanHarian = {
  id: number;
  tanggal: string;
  shift: string;
  statusKehadiran: "lengkap" | "tidak_lengkap";
  lokasiGedung: string;
  namaPembuat: string;
  personilHadir: number;
  personilHarusnya: number;
};

type ListResponse = {
  data: LaporanHarian[];
  pagination?: {
    page: number;
    limit: number;
    hasMore: boolean;
  };
};

export default function LaporanHarianList() {
  const { isSuperAdmin, canManageOps } = useRole();

  const [results, setResults] = useState<LaporanHarian[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const loadReports = useCallback(
    async (pageNumber: number, append = false) => {
      try {
        if (append) {
          setLoadingMore(true);
        } else {
          setLoading(true);
        }

        const response = await fetch(
          `/api/laporan-harian?page=${pageNumber}&limit=20`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const result: ListResponse & { message?: string } =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result.message ?? "Gagal mengambil laporan harian",
          );
        }

        setResults((previous) =>
          append
            ? [...previous, ...(result.data ?? [])]
            : result.data ?? [],
        );

        setPage(pageNumber);
        setHasMore(result.pagination?.hasMore ?? false);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil laporan harian",
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadReports(1);
  }, [loadReports]);

  const handleDelete = async (
    laporanId: number,
    event: MouseEvent<HTMLButtonElement>,
  ) => {
    event.stopPropagation();

    if (!window.confirm("Hapus Laporan Harian ini?")) {
      return;
    }

    try {
      const response = await fetch(
        `/api/laporan-harian/${laporanId}`,
        {
          method: "DELETE",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ?? "Gagal menghapus laporan",
        );
      }

      setResults((previous) =>
        previous.filter((item) => item.id !== laporanId),
      );

      if (selectedId === laporanId) {
        setSelectedId(null);
      }

      toast.success("Laporan Harian dihapus");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus laporan",
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-20 w-full"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {canManageOps && (
        <div className="flex justify-end">
          <Button
            className="cursor-pointer"
            onClick={() => setShowForm(true)}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Buat Laporan Harian
          </Button>
        </div>
      )}

      {results.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ClipboardList />
            </EmptyMedia>
            <EmptyTitle>
              Belum ada Laporan Harian
            </EmptyTitle>
            <EmptyDescription>
              Buat laporan harian untuk mencatat kondisi shift.
            </EmptyDescription>
          </EmptyHeader>

          {canManageOps && (
            <EmptyContent>
              <Button
                size="sm"
                className="cursor-pointer"
                onClick={() => setShowForm(true)}
              >
                Buat Laporan
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {results.map((laporan) => (
            <Card
              key={laporan.id}
              className="cursor-pointer transition-colors hover:bg-accent/40"
              onClick={() => setSelectedId(laporan.id)}
            >
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {format(
                        new Date(laporan.tanggal),
                        "d MMM yyyy",
                        { locale: id },
                      )}
                    </span>

                    <Badge variant="secondary">
                      {laporan.shift}
                    </Badge>

                    <Badge
                      variant={
                        laporan.statusKehadiran === "lengkap"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {laporan.statusKehadiran === "lengkap"
                        ? "Lengkap"
                        : "Tidak Lengkap"}
                    </Badge>
                  </div>

                  <div className="mt-1 truncate text-sm text-muted-foreground">
                    {laporan.lokasiGedung} —{" "}
                    {laporan.namaPembuat}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Personil: {laporan.personilHadir}/
                    {laporan.personilHarusnya}
                  </div>
                </div>

                {isSuperAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 cursor-pointer"
                    onClick={(event) =>
                      void handleDelete(
                        laporan.id,
                        event,
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}

          {hasMore && (
            <Button
              variant="secondary"
              className="w-full cursor-pointer"
              disabled={loadingMore}
              onClick={() =>
                void loadReports(page + 1, true)
              }
            >
              {loadingMore
                ? "Memuat..."
                : "Muat lebih banyak"}
            </Button>
          )}
        </div>
      )}

      <LaporanHarianFormDialog
        open={showForm}
        onClose={() => {
          setShowForm(false);
          void loadReports(1);
        }}
      />

      {selectedId !== null && (
        <LaporanHarianDetailPanel
          laporanId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}