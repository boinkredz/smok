import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { request } from "@/lib/api.ts";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";

const schema = z.object({
  officerId: z.string().min(1, "Pilih petugas"),
  ruteId: z.string().min(1, "Pilih rute"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  jamMulaiRencana: z.string().min(1, "Jam mulai wajib diisi"),
  jamSelesaiRencana: z.string().min(1, "Jam selesai wajib diisi"),
  catatan: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

// id bertipe string sebab kolom BigInt pada Prisma diserialisasi
// menjadi string oleh backend, bukan number.
type Officer = { id: string; nama: string; jabatan: string };
type Rute = {
  id: string;
  site_id: number;
  nama: string;
  durasi_target_menit: number | null;
};

export type PenugasanEditData = {
  id: number;
  officer_id: number | null;
  rute_id: string | null;
  site_id: number | null;
  tanggal: string;
  jam_mulai_rencana: string | null;
  jam_selesai_rencana: string | null;
  catatan: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultTanggal: string;
  editPenugasan?: PenugasanEditData | null;
  onSuccess?: () => void;
};

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Memakai UTC agar konsisten dengan penyimpanan basis data dan
// menghindari pergeseran zona waktu lokal peramban.
function toTimeInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const jam = String(d.getUTCHours()).padStart(2, "0");
  const menit = String(d.getUTCMinutes()).padStart(2, "0");
  return `${jam}:${menit}`;
}

// PENTING: menggabungkan tanggal formulir dengan jam yang dipilih,
// BUKAN memakai tanggal epoch "1970-01-01" secara statis. Backend
// (Prisma) menolak "new Date('HH:MM')" saja karena bukan format
// DateTime ISO 8601 yang lengkap dan valid.
function toTimeIsoValue(tanggal: string, time: string): string {
  return `${tanggal}T${time}:00.000Z`;
}

function extractArray<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && Array.isArray((payload as any).data)) {
    return (payload as any).data as T[];
  }
  return [];
}

export default function PenugasanFormDialog({
  open,
  onClose,
  defaultTanggal,
  editPenugasan,
  onSuccess,
}: Props) {
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [rutes, setRutes] = useState<Rute[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      officerId: "",
      ruteId: "",
      tanggal: defaultTanggal,
      jamMulaiRencana: "08:00",
      jamSelesaiRencana: "09:00",
      catatan: "",
    },
  });

  useEffect(() => {
  if (!open) return;
  const controller = new AbortController();

  const fetchOptions = async () => {
    setLoadingOptions(true);
    try {
      const [officerRes, ruteRes] = await Promise.all([
        request<unknown>("/api/officers?status=aktif", { signal: controller.signal }),
        request<unknown>("/api/patroli/rute?aktifOnly=true", { signal: controller.signal }),
      ]);
      setOfficers(extractArray<Officer>(officerRes));
      setRutes(extractArray<Rute>(ruteRes));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("Gagal memuat data petugas atau rute");
    } finally {
      setLoadingOptions(false);
    }
  };

  fetchOptions();
  return () => controller.abort();
}, [open]);

  useEffect(() => {
    if (editPenugasan) {
      form.reset({
        officerId: editPenugasan.officer_id?.toString() ?? "",
        ruteId: editPenugasan.rute_id ?? "",
        tanggal: toDateInputValue(editPenugasan.tanggal),
        jamMulaiRencana: toTimeInputValue(editPenugasan.jam_mulai_rencana),
        jamSelesaiRencana: toTimeInputValue(editPenugasan.jam_selesai_rencana),
        catatan: editPenugasan.catatan ?? "",
      });
    } else {
      form.reset({
        officerId: "",
        ruteId: "",
        tanggal: defaultTanggal,
        jamMulaiRencana: "08:00",
        jamSelesaiRencana: "09:00",
        catatan: "",
      });
    }
  }, [editPenugasan, defaultTanggal, form, open]);

  const onSubmit = async (data: FormData) => {
    // Perbandingan memakai String(r.id) sebab id bertipe BigInt pada
    // Prisma diserialisasi menjadi string oleh backend.
    const ruteTerpilih = rutes.find((r) => String(r.id) === data.ruteId);
    if (!ruteTerpilih) {
      toast.error("Rute yang dipilih tidak valid");
      return;
    }
    if (!ruteTerpilih.site_id) {
      toast.error("Rute terpilih tidak memiliki site_id yang valid");
      return;
    }

    const payload = {
      tanggal: data.tanggal,
      site_id: ruteTerpilih.site_id,
      officer_id: Number(data.officerId),
      rute_id: data.ruteId,
      jam_mulai_rencana: toTimeIsoValue(data.tanggal, data.jamMulaiRencana),
      jam_selesai_rencana: toTimeIsoValue(data.tanggal, data.jamSelesaiRencana),
      catatan: data.catatan || null,
    };

    try {
      if (editPenugasan) {
        await request(`/api/patroli/tugas/${editPenugasan.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Penugasan diperbarui");
      } else {
        await request("/api/patroli/tugas", {
          method: "POST",
          body: JSON.stringify({ ...payload, status: "BELUM_DIMULAI" }),
        });
        toast.success("Penugasan ditambahkan");
      }
      onSuccess?.();
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal menyimpan penugasan";
      toast.error(message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editPenugasan ? "Edit Penugasan Patroli" : "Jadwalkan Patroli"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="officerId" render={({ field }) => (
              <FormItem>
                <FormLabel>Petugas</FormLabel>
                <Select
  onValueChange={field.onChange}
  value={field.value}
  disabled={loadingOptions}
  modal={false}
>
  <FormControl>
    <SelectTrigger>
      <SelectValue placeholder="Pilih petugas..." />
    </SelectTrigger>
  </FormControl>
  <SelectContent className="z-[1100]">
    {officers.map((o) => (
      <SelectItem key={o.id} value={String(o.id)}>
        {o.nama} — {o.jabatan}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="ruteId" render={({ field }) => (
              <FormItem>
                <FormLabel>Rute Patroli</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                  disabled={loadingOptions}
                  modal={false}
                >
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Pilih rute..." /></SelectTrigger>
                  </FormControl>
                  <SelectContent className="z-[1100]">
                    {rutes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.nama} ({r.durasi_target_menit ?? "-"} menit)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="tanggal" render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-3">
              <FormField control={form.control} name="jamMulaiRencana" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Mulai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="jamSelesaiRencana" render={({ field }) => (
                <FormItem>
                  <FormLabel>Jam Selesai</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="catatan" render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan</FormLabel>
                <FormControl><Textarea placeholder="Opsional..." rows={2} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting || loadingOptions}>
                {editPenugasan ? "Simpan" : "Jadwalkan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}