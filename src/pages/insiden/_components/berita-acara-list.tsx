import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { id } from "date-fns/locale";
import { Plus, FileText, Trash2 } from "lucide-react";
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

import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";
import type { JenisInsiden } from "@convex/schema/insiden";

import BeritaAcaraFormDialog from "./berita-acara-form-dialog.tsx";
import BeritaAcaraDetailDialog from "./berita-acara-detail-dialog.tsx";

type BeritaAcara = {
  id: number;
  nomorBa: string;
  lokasiGedung: string;
  tanggal: string;
  jenisInsiden: string;
  petugasNama: string;
};

export default function BeritaAcaraList() {
  const { isSuperAdmin } = useRole();

  const [data, setData] = useState<BeritaAcara[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const limit = 20;

  async function loadBeritaAcara(reset = false) {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : data.length;

      const response = await fetch(
        `/api/insiden/berita-acara?limit=${limit}&offset=${offset}`,
        {
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw new Error("Gagal mengambil data berita acara");
      }

      const result = await response.json();

      const items: BeritaAcara[] = result.data ?? result.items ?? result;

      setData((previous) => (reset ? items : [...previous, ...items]));
      setHasMore(items.length === limit);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil berita acara",
      );
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    void loadBeritaAcara(true);
  }, []);

  async function handleDelete(id: number, event: React.MouseEvent) {
    event.stopPropagation();

    if (!window.confirm("Hapus Berita Acara ini?")) {
      return;
    }

    try {
      const response = await fetch(`/api/berita-acara/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? "Gagal menghapus berita acara");
      }

      setData((previous) => previous.filter((item) => item.id !== id));
      toast.success("Berita Acara berhasil dihapus");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus",
      );
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Buat Berita Acara
        </Button>
      </div>

      {data.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileText />
            </EmptyMedia>
            <EmptyTitle>Belum ada Berita Acara</EmptyTitle>
            <EmptyDescription>
              Buat berita acara pertama untuk mencatat insiden.
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <Button size="sm" onClick={() => setShowForm(true)}>
              Buat Berita Acara
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="space-y-3">
          {data.map((ba) => (
            <Card
              key={ba.id}
              className="cursor-pointer transition-colors hover:bg-accent/30"
              onClick={() => setSelectedId(ba.id)}
            >
              <CardContent className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-semibold">
                      {ba.nomorBa}
                    </span>

                    <Badge variant="secondary">
                      {JENIS_INSIDEN_LABELS[
                        ba.jenisInsiden as JenisInsiden
                      ] ?? ba.jenisInsiden}
                    </Badge>
                  </div>

                  <div className="mt-1 truncate text-sm text-muted-foreground">
                    {ba.lokasiGedung} —{" "}
                    {format(parseISO(ba.tanggal), "d MMM yyyy", {
                      locale: id,
                    })}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Petugas: {ba.petugasNama}
                  </div>
                </div>

                {isSuperAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(event) => void handleDelete(ba.id, event)}
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
              className="w-full"
              disabled={loadingMore}
              onClick={() => void loadBeritaAcara(false)}
            >
              {loadingMore ? "Memuat..." : "Muat lebih banyak"}
            </Button>
          )}
        </div>
      )}

      <BeritaAcaraFormDialog
        open={showForm}
        onClose={() => {
          setShowForm(false);
          void loadBeritaAcara(true);
        }}
      />

      {selectedId !== null && (
        <BeritaAcaraDetailDialog
          baId={String(selectedId)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}