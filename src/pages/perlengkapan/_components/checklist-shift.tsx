import { useEffect, useState, type ElementType } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ClipboardCheck,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

type Kondisi = "baik" | "rusak" | "hilang";

type Assignment = {
  assignmentId: number | string;
  siteId: number | string;
  tanggal: string;
  shiftNama: string;
};

type Perlengkapan = {
  id: number | string;
  nama: string;
  jumlahStandar: number;
  aktif: boolean;
};

type ItemState = {
  kondisi: Kondisi;
  jumlahTersedia: string;
  keterangan: string;
};

const KONDISI: Record<
  Kondisi,
  { label: string; icon: ElementType; color: string }
> = {
  baik: { label: "Baik", icon: CheckCircle2, color: "text-green-600" },
  rusak: { label: "Rusak", icon: AlertTriangle, color: "text-yellow-600" },
  hilang: { label: "Hilang", icon: XCircle, color: "text-red-600" },
};

async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options?.body ? { "Content-Type": "application/json" } : {}),
      ...options?.headers,
    },
    ...options,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message ?? "Terjadi kesalahan pada server");
  }

  return (result?.data ?? result) as T;
}

export default function ChecklistShift() {
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    async function loadAssignment() {
      try {
        const data = await request<Assignment | null>(
          `${API_URL}/api/perlengkapan/today-assignment`,
        );
        setAssignment(data);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat assignment",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadAssignment();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((item) => (
          <Skeleton key={item} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (!assignment?.siteId) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardCheck />
          </EmptyMedia>
          <EmptyTitle>Tidak ada jadwal hari ini</EmptyTitle>
          <EmptyDescription>
            Anda belum memiliki assignment shift atau site.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <h3 className="text-lg font-semibold">
          Checklist berhasil dikirim
        </h3>
        <p className="text-sm text-muted-foreground">
          Data checklist telah tersimpan.
        </p>
      </div>
    );
  }

  return (
    <ChecklistForm
      assignment={assignment}
      onSubmitted={() => setSubmitted(true)}
    />
  );
}

function ChecklistForm({
  assignment,
  onSubmitted,
}: {
  assignment: Assignment;
  onSubmitted: () => void;
}) {
  const [alat, setAlat] = useState<Perlengkapan[]>([]);
  const [sudahDiisi, setSudahDiisi] = useState(false);
  const [items, setItems] = useState<Record<string, ItemState>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const [alatData, cekData] = await Promise.all([
          request<Perlengkapan[]>(
            `${API_URL}/api/perlengkapan/master?siteId=${assignment.siteId}`,
          ),
          request<unknown>(
            `${API_URL}/api/perlengkapan/cek?shiftAssignmentId=${assignment.assignmentId}`,
          ),
        ]);

        setAlat(Array.isArray(alatData) ? alatData : []);
        setSudahDiisi(Boolean(cekData));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat data perlengkapan",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadData();
  }, [assignment]);

  function getItem(id: string): ItemState {
    return (
      items[id] ?? {
        kondisi: "baik",
        jumlahTersedia: "1",
        keterangan: "",
      }
    );
  }

  function updateItem(
    id: string,
    field: keyof ItemState,
    value: string,
  ) {
    setItems((previous) => ({
      ...previous,
      [id]: { ...getItem(id), [field]: value },
    }));
  }

  async function handleSubmit() {
    const activeAlat = alat.filter((item) => item.aktif);

    setSubmitting(true);

    try {
      await request(`${API_URL}/api/perlengkapan/cek`, {
        method: "POST",
        body: JSON.stringify({
          shiftAssignmentId: assignment.assignmentId,
          siteId: assignment.siteId,
          tanggal: assignment.tanggal,
          items: activeAlat.map((alatItem) => {
            const item = getItem(String(alatItem.id));

            return {
              perlengkapanId: alatItem.id,
              kondisi: item.kondisi,
              jumlahTersedia: Number(item.jumlahTersedia) || 0,
              keterangan: item.keterangan || null,
            };
          }),
        }),
      });

      toast.success("Checklist berhasil dikirim");
      onSubmitted();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengirim checklist",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (sudahDiisi) {
    return (
      <div className="py-12 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-12 text-green-500" />
        <h3 className="font-semibold">Checklist sudah diisi</h3>
      </div>
    );
  }

  const activeAlat = alat.filter((item) => item.aktif);

  if (activeAlat.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ClipboardCheck />
          </EmptyMedia>
          <EmptyTitle>Belum ada alat terdaftar</EmptyTitle>
          <EmptyDescription>
            Admin belum mendaftarkan alat untuk site ini.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-secondary/50 px-4 py-3 text-sm">
        <b>{assignment.shiftNama}</b>
        <span className="mx-2">•</span>
        {format(new Date(assignment.tanggal), "EEEE, d MMMM yyyy", {
          locale: idLocale,
        })}
      </div>

      {activeAlat.map((alatItem) => {
        const id = String(alatItem.id);
        const item = getItem(id);
        const ConfigIcon = KONDISI[item.kondisi].icon;

        return (
          <div key={id} className="space-y-3 rounded-lg border p-4">
            <div className="flex justify-between">
              <div>
                <b>{alatItem.nama}</b>
                <p className="text-xs text-muted-foreground">
                  Standar: {alatItem.jumlahStandar} unit
                </p>
              </div>
              <ConfigIcon className={KONDISI[item.kondisi].color} />
            </div>

            <Label>Kondisi</Label>
            <div className="flex gap-2">
              {(["baik", "rusak", "hilang"] as Kondisi[]).map((kondisi) => (
                <Button
                  key={kondisi}
                  type="button"
                  variant={item.kondisi === kondisi ? "default" : "outline"}
                  onClick={() => updateItem(id, "kondisi", kondisi)}
                >
                  {KONDISI[kondisi].label}
                </Button>
              ))}
            </div>

            <Label>Jumlah tersedia</Label>
            <Input
              type="number"
              min={0}
              value={item.jumlahTersedia}
              onChange={(event) =>
                updateItem(id, "jumlahTersedia", event.target.value)
              }
            />

            {item.kondisi !== "baik" && (
              <Textarea
                placeholder="Jelaskan kondisi atau lokasi terakhir"
                value={item.keterangan}
                onChange={(event) =>
                  updateItem(id, "keterangan", event.target.value)
                }
              />
            )}
          </div>
        );
      })}

      <Button
        className="w-full"
        disabled={submitting}
        onClick={handleSubmit}
      >
        {submitting ? "Mengirim..." : "Kirim Checklist"}
      </Button>
    </div>
  );
}