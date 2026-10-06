import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MapPin, Loader2, QrCode } from "lucide-react";

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
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const schema = z.object({
  nama: z.string().trim().min(1, "Nama checkpoint wajib diisi"),
  urutan: z.number().min(1, "Urutan minimal 1"),
  deskripsi: z.string().optional(),
  lat: z.string().optional(),
  lng: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type CheckpointEditData = {
  id: string;
  nama: string;
  urutan: number;
  deskripsi?: string | null;
  koordinat?: {
    lat: number;
    lng: number;
  } | null;
  qrCode: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  ruteId: string;
  defaultUrutan: number;
  editCheckpoint?: CheckpointEditData | null;
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
        "Gagal menyimpan checkpoint.",
    );
  }

  return result?.data ?? result;
}

export default function CheckpointFormDialog({
  open,
  onClose,
  ruteId,
  defaultUrutan,
  editCheckpoint,
}: Props) {
  const [locating, setLocating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: "",
      urutan: defaultUrutan,
      deskripsi: "",
      lat: "",
      lng: "",
    },
  });

  useEffect(() => {
    if (editCheckpoint) {
      form.reset({
        nama: editCheckpoint.nama,
        urutan: editCheckpoint.urutan,
        deskripsi: editCheckpoint.deskripsi ?? "",
        lat: editCheckpoint.koordinat
          ? String(editCheckpoint.koordinat.lat)
          : "",
        lng: editCheckpoint.koordinat
          ? String(editCheckpoint.koordinat.lng)
          : "",
      });
    } else {
      form.reset({
        nama: "",
        urutan: defaultUrutan,
        deskripsi: "",
        lat: "",
        lng: "",
      });
    }
  }, [editCheckpoint, defaultUrutan, open, form]);

  function fillGps() {
    if (!navigator.geolocation) {
      toast.error("Perangkat tidak mendukung GPS.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue(
          "lat",
          position.coords.latitude.toFixed(6),
        );
        form.setValue(
          "lng",
          position.coords.longitude.toFixed(6),
        );
        setLocating(false);
        toast.success("Koordinat GPS terisi.");
      },
      () => {
        setLocating(false);
        toast.error(
          "Gagal mengambil lokasi. Izinkan akses lokasi pada browser.",
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  }

  function parseKoordinat(data: FormData) {
    const lat = data.lat?.trim();
    const lng = data.lng?.trim();

    if (!lat || !lng) return null;

    const latNumber = Number(lat);
    const lngNumber = Number(lng);

    if (
      !Number.isFinite(latNumber) ||
      !Number.isFinite(lngNumber) ||
      latNumber < -90 ||
      latNumber > 90 ||
      lngNumber < -180 ||
      lngNumber > 180
    ) {
      throw new Error("Koordinat latitude atau longitude tidak valid.");
    }

    return {
      lat: latNumber,
      lng: lngNumber,
    };
  }

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        nama: data.nama.trim(),
        urutan: data.urutan,
        deskripsi: data.deskripsi?.trim() || null,
        koordinat: parseKoordinat(data),
      };

      if (editCheckpoint) {
        await request(
          `/api/patroli/checkpoint/${editCheckpoint.id}`,
          {
            method: "PUT",
            body: JSON.stringify(payload),
          },
        );

        toast.success("Checkpoint diperbarui.");
      } else {
        await request(
          `/api/patroli/rute/${ruteId}/checkpoints`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );

        toast.success("Checkpoint ditambahkan.");
      }

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan checkpoint.",
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
            {editCheckpoint
              ? "Edit Checkpoint"
              : "Tambah Checkpoint"}
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
                  <FormLabel>Nama Checkpoint</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Pintu masuk utama"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="urutan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Urutan</FormLabel>
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
              name="deskripsi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deskripsi</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Opsional..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <FormLabel>Koordinat (opsional)</FormLabel>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 cursor-pointer gap-1 text-xs"
                  onClick={fillGps}
                  disabled={locating}
                >
                  {locating ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <MapPin className="size-3" />
                  )}
                  Isi dari GPS
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="lat"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Latitude"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lng"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          placeholder="Longitude"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground">
              <QrCode className="mt-0.5 size-4 shrink-0" />
              <span>
                {editCheckpoint
                  ? "Kode QR unik sudah dibuat otomatis dan tidak dapat diubah."
                  : "Kode QR unik akan dibuat otomatis setelah checkpoint disimpan."}
              </span>
            </div>

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
                  : editCheckpoint
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