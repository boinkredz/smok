import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

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
import { Badge } from "@/components/ui/badge.tsx";
import { Separator } from "@/components/ui/separator.tsx";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const STATUS_OPTIONS = [
  { value: "hadir", label: "Hadir" },
  { value: "terlambat", label: "Terlambat" },
  { value: "izin", label: "Izin" },
  { value: "sakit", label: "Sakit" },
  {
    value: "alpha",
    label: "Alpha (Absen Tanpa Keterangan)",
  },
] as const;

const schema = z.object({
  status: z.enum([
    "hadir",
    "terlambat",
    "izin",
    "sakit",
    "alpha",
  ]),
  waktuMasuk: z.string().optional(),
  waktuKeluar: z.string().optional(),
  keterlambatanMenit: z.number().optional(),
  alasan: z
    .string()
    .min(5, "Alasan wajib diisi minimal 5 karakter"),
  keterangan: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export type ExistingAbsensi = {
  status: "hadir" | "terlambat" | "izin" | "sakit" | "alpha";
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  keterlambatanMenit?: number | null;
  keterangan?: string | null;
  fotoMasukUrl?: string | null;
  fotoKeluarUrl?: string | null;
  lokasiMasuk?: {
    lat: number;
    lng: number;
  } | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  assignmentId: number;
  siteId?: number | null;
  officerNama: string;
  shiftNama: string;
  shiftJamMulai: string;
  tanggal: string;
  existingAbsensi?: ExistingAbsensi | null;
};

function isoToLocalTime(value?: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return format(date, "HH:mm");
}

function localTimeToIso(dateValue: string, timeValue: string): string {
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);

  const date = new Date(
    year,
    month - 1,
    day,
    hour,
    minute,
    0,
    0,
  );

  return date.toISOString();
}

function hitungKeterlambatan(
  tanggal: string,
  jamMulai: string,
  waktuMasuk: string,
): number {
  const [year, month, day] = tanggal.split("-").map(Number);
  const [startHour, startMinute] = jamMulai
    .split(":")
    .map(Number);

  const jadwal = new Date(
    year,
    month - 1,
    day,
    startHour,
    startMinute,
    0,
    0,
  );

  const waktuMasukDate = new Date(
    localTimeToIso(tanggal, waktuMasuk),
  );

  return Math.max(
    0,
    Math.round(
      (waktuMasukDate.getTime() - jadwal.getTime()) / 60000,
    ),
  );
}

async function getErrorMessage(response: Response): Promise<string> {
  try {
    const result = await response.json();

    return (
      result?.message ??
      result?.error ??
      "Terjadi kesalahan pada server."
    );
  } catch {
    return "Terjadi kesalahan pada server.";
  }
}

export default function AbsensiFormDialog({
  open,
  onClose,
  assignmentId,
  officerNama,
  shiftNama,
  shiftJamMulai,
  tanggal,
  existingAbsensi,
}: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      status: "hadir",
      waktuMasuk: "",
      waktuKeluar: "",
      keterlambatanMenit: undefined,
      alasan: "",
      keterangan: "",
    },
  });

  useEffect(() => {
    if (existingAbsensi) {
      form.reset({
        status: existingAbsensi.status,
        waktuMasuk: isoToLocalTime(
          existingAbsensi.waktuMasuk,
        ),
        waktuKeluar: isoToLocalTime(
          existingAbsensi.waktuKeluar,
        ),
        keterlambatanMenit:
          existingAbsensi.keterlambatanMenit ?? undefined,
        alasan: existingAbsensi.keterangan ?? "",
        keterangan: "",
      });
    } else {
      form.reset({
        status: "hadir",
        waktuMasuk: "",
        waktuKeluar: "",
        keterlambatanMenit: undefined,
        alasan: "",
        keterangan: "",
      });
    }
  }, [existingAbsensi, open, form]);

  const status = form.watch("status");
  const waktuMasukValue = form.watch("waktuMasuk");

  useEffect(() => {
    if (
      status === "terlambat" &&
      waktuMasukValue &&
      shiftJamMulai
    ) {
      const menit = hitungKeterlambatan(
        tanggal,
        shiftJamMulai,
        waktuMasukValue,
      );

      form.setValue("keterlambatanMenit", menit);
    }

    if (status !== "terlambat") {
      form.setValue("keterlambatanMenit", undefined);
    }
  }, [
    status,
    waktuMasukValue,
    tanggal,
    shiftJamMulai,
    form,
  ]);

  async function onSubmit(data: FormData) {
    try {
      const alasanGabungan = [
        data.alasan.trim(),
        data.keterangan?.trim(),
      ]
        .filter(Boolean)
        .join("\n");

      const payload = {
        assignmentId,
        status: data.status,
        waktuMasuk:
          data.waktuMasuk && data.status !== "izin" &&
          data.status !== "sakit" &&
          data.status !== "alpha"
            ? localTimeToIso(tanggal, data.waktuMasuk)
            : null,
        waktuKeluar:
          data.waktuKeluar && data.status !== "izin" &&
          data.status !== "sakit" &&
          data.status !== "alpha"
            ? localTimeToIso(tanggal, data.waktuKeluar)
            : null,
        keterlambatanMenit:
          data.status === "terlambat"
            ? data.keterlambatanMenit ?? 0
            : null,
        alasan: alasanGabungan,
        keterangan: data.keterangan?.trim() || null,
        lokasiMasuk: null,
        lokasiKeluar: null,
        fotoMasukUrl: null,
        fotoKeluarUrl: null,
      };

      const response = await fetch(
        `${API_URL}/api/absensi/manual`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      toast.success("Absensi berhasil disimpan.");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan absensi.",
      );
    }
  }

  const isHadirOrTerlambat =
    status === "hadir" || status === "terlambat";

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Catat Absensi Manual</DialogTitle>
        </DialogHeader>

        <div className="rounded-md bg-muted px-3 py-2 text-sm">
          <div className="font-medium">{officerNama}</div>
          <div className="text-muted-foreground">
            {shiftNama} ({shiftJamMulai}) · {tanggal}
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
          >
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status Kehadiran</FormLabel>

                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>

                    <SelectContent>
                      {STATUS_OPTIONS.map((item) => (
                        <SelectItem
                          key={item.value}
                          value={item.value}
                        >
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <FormMessage />
                </FormItem>
              )}
            />

            {isHadirOrTerlambat && (
              <>
                <Separator />

                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="waktuMasuk"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Waktu Masuk</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="waktuKeluar"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Waktu Keluar</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {status === "terlambat" && (
                  <FormField
                    control={form.control}
                    name="keterlambatanMenit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          Keterlambatan (menit)
                          <Badge
                            variant="secondary"
                            className="ml-1 text-xs"
                          >
                            Otomatis
                          </Badge>
                        </FormLabel>

                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            placeholder="15"
                            value={field.value ?? ""}
                            onChange={(event) => {
                              const value = event.target.value;

                              field.onChange(
                                value
                                  ? Number(value)
                                  : undefined,
                              );
                            }}
                          />
                        </FormControl>

                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </>
            )}

            <Separator />

            <FormField
              control={form.control}
              name="alasan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Alasan Absensi Manual
                    <Badge
                      variant="destructive"
                      className="ml-2 px-1.5 py-0 text-[10px]"
                    >
                      Wajib
                    </Badge>
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      rows={3}
                      {...field}
                      placeholder="Contoh: Petugas tidak membawa HP, input koreksi data, kamera rusak..."
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
                  <FormLabel>
                    Catatan Tambahan{" "}
                    <span className="text-xs text-muted-foreground">
                      (opsional)
                    </span>
                  </FormLabel>

                  <FormControl>
                    <Textarea
                      rows={2}
                      {...field}
                      placeholder="Catatan tambahan..."
                    />
                  </FormControl>

                  <FormMessage />
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
                {form.formState.isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Absensi"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}