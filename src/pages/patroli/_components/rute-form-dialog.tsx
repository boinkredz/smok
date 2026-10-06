import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const NO_SITE = "none";

const schema = z.object({
  nama: z.string().min(1, "Nama rute wajib diisi"),
  siteId: z.string(),
  estimasiMenit: z
    .number()
    .min(1, "Estimasi minimal 1 menit"),
  keterangan: z.string().optional(),
  aktif: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type Site = {
  id: string;
  kode: string;
  nama: string;
};

export type RuteEditData = {
  id: string;
  nama: string;
  siteId?: string | null;
  estimasiMenit: number;
  keterangan?: string | null;
  aktif: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editRute?: RuteEditData | null;
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

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ??
        result?.error ??
        "Permintaan ke server gagal.",
    );
  }

  return result?.data ?? result;
}

export default function RuteFormDialog({
  open,
  onClose,
  editRute,
}: Props) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingSites, setLoadingSites] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: "",
      siteId: NO_SITE,
      estimasiMenit: 30,
      keterangan: "",
      aktif: true,
    },
  });

  useEffect(() => {
    if (!open) return;

    async function loadSites() {
      try {
        setLoadingSites(true);

        const result = await request<Site[]>(
          "/api/sites?aktifOnly=true",
        );

        setSites(result ?? []);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat daftar site.",
        );
      } finally {
        setLoadingSites(false);
      }
    }

    void loadSites();
  }, [open]);

  useEffect(() => {
    if (editRute) {
      form.reset({
        nama: editRute.nama,
        siteId: editRute.siteId ?? NO_SITE,
        estimasiMenit: editRute.estimasiMenit,
        keterangan: editRute.keterangan ?? "",
        aktif: editRute.aktif,
      });
    } else {
      form.reset({
        nama: "",
        siteId: NO_SITE,
        estimasiMenit: 30,
        keterangan: "",
        aktif: true,
      });
    }
  }, [editRute, open, form]);

  async function onSubmit(data: FormData) {
    const payload = {
      nama: data.nama.trim(),
      siteId: data.siteId === NO_SITE ? null : data.siteId,
      estimasiMenit: data.estimasiMenit,
      keterangan: data.keterangan?.trim() || null,
      aktif: data.aktif,
    };

    try {
      if (editRute) {
        await request(`/api/patroli/rute/${editRute.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        toast.success("Rute diperbarui.");
      } else {
        await request("/api/patroli/rute", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success("Rute ditambahkan.");
      }

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan rute.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editRute
              ? "Edit Rute Patroli"
              : "Tambah Rute Patroli"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Rute</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Rute A – Gedung Utama"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>

                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingSites}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih site..." />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      <SelectItem value={NO_SITE}>
                        Tanpa Site
                      </SelectItem>

                      {sites.map((site) => (
                        <SelectItem
                          key={site.id}
                          value={site.id}
                        >
                          {site.kode} — {site.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="estimasiMenit"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Estimasi Durasi (menit)
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={1}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(
                          Number(event.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="keterangan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Opsional..."
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="aktif"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="cursor-pointer"
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Rute aktif
                  </FormLabel>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Batal
              </Button>

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting
                  ? "Menyimpan..."
                  : editRute
                    ? "Simpan"
                    : "Tambah"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}