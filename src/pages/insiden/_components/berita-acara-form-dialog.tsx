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

import LampiranUpload from "./lampiran-upload.tsx";
import type { LampiranItem } from "./lampiran-upload.tsx";
import SignaturePad from "./signature-pad.tsx";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const JENIS_INSIDEN = [
  "KECELAKAAN",
  "KEHILANGAN",
  "KERUSAKAN",
  "GANGGUAN_KEAMANAN",
  "LAINNYA",
] as const;

const JENIS_INSIDEN_LABELS: Record<string, string> = {
  KECELAKAAN: "Kecelakaan",
  KEHILANGAN: "Kehilangan",
  KERUSAKAN: "Kerusakan",
  GANGGUAN_KEAMANAN: "Gangguan Keamanan",
  LAINNYA: "Lainnya",
};

const schema = z.object({
  siteId: z.string().optional(),
  lokasiGedung: z.string().min(1, "Wajib diisi"),
  tanggal: z.string().min(1, "Wajib diisi"),
  waktu: z.string().min(1, "Wajib diisi"),
  jenisInsiden: z.string().min(1, "Pilih jenis insiden"),
  lokasiDetail: z.string().min(1, "Wajib diisi"),
  kronologi: z.string().min(1, "Wajib diisi"),
  tindakan: z.string().min(1, "Wajib diisi"),
  hasilTindakan: z.string().min(1, "Wajib diisi"),
  petugasNama: z.string().min(1, "Wajib diisi"),
  petugasJabatan: z.string().min(1, "Wajib diisi"),
  atasanNama: z.string().optional(),
  atasanJabatan: z.string().optional(),
  ketahuiNama: z.string().optional(),
  ketahuiJabatan: z.string().optional(),
  tempatTtd: z.string().min(1, "Wajib diisi"),
});

type FormData = z.infer<typeof schema>;

type TtdState = {
  petugas: string | null;
  atasan: string | null;
  ketahui: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

type Option = {
  id?: string;
  _id?: string;
  nama: string;
  kode?: string;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message ?? "Gagal mengambil data");
  }

  return (result?.data ?? result) as T;
}

function normalizeOptionList(value: unknown): Option[] {
  if (Array.isArray(value)) {
    return value as Option[];
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const object = value as Record<string, unknown>;
  const possibleKeys = ["sites", "jabatan", "lokasi", "items", "rows", "data"];

  for (const key of possibleKeys) {
    if (Array.isArray(object[key])) {
      return object[key] as Option[];
    }
  }

  return [];
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");

  if (!header || !base64) {
    throw new Error("Format tanda tangan tidak valid");
  }

  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mime });
}

async function uploadSignature(dataUrl: string) {
  const formData = new FormData();

  formData.append(
    "file",
    dataUrlToBlob(dataUrl),
    `signature-${Date.now()}.png`,
  );

  const response = await fetch(`${API_URL}/api/insiden/upload`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(result?.message ?? "Gagal mengunggah tanda tangan");
  }

  return result?.data ?? result;
}

export default function BeritaAcaraFormDialog({
  open,
  onClose,
}: Props) {
  const [sites, setSites] = useState<Option[]>([]);
  const [jabatanList, setJabatanList] = useState<Option[]>([]);
  const [lokasiList, setLokasiList] = useState<Option[]>([]);
  const [lampiran, setLampiran] = useState<LampiranItem[]>([]);
  const [ttd, setTtd] = useState<TtdState>({
    petugas: null,
    atasan: null,
    ketahui: null,
  });
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: "",
      lokasiGedung: "",
      tanggal: new Date().toISOString().split("T")[0],
      waktu: new Date().toTimeString().slice(0, 5),
      jenisInsiden: "",
      lokasiDetail: "",
      kronologi: "",
      tindakan: "",
      hasilTindakan: "",
      petugasNama: "",
      petugasJabatan: "",
      atasanNama: "",
      atasanJabatan: "",
      ketahuiNama: "",
      ketahuiJabatan: "",
      tempatTtd: "",
    },
  });

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        const [siteData, jabatanData, lokasiData] = await Promise.all([
          getJson<unknown>(
            `${API_URL}/api/sites?aktifOnly=true`,
          ),
          getJson<unknown>(
            `${API_URL}/api/master-data/jabatan?aktifOnly=true`,
          ),
          getJson<unknown>(
            `${API_URL}/api/master-data/lokasi-gedung?aktifOnly=true`,
          ),
        ]);

        setSites(normalizeOptionList(siteData));
        setJabatanList(normalizeOptionList(jabatanData));
        setLokasiList(normalizeOptionList(lokasiData));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal memuat data referensi",
        );
      }
    }

    void loadOptions();
  }, [open]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);

    try {
      const [ttdPetugas, ttdAtasan, ttdKetahui] = await Promise.all([
        ttd.petugas ? uploadSignature(ttd.petugas) : null,
        ttd.atasan ? uploadSignature(ttd.atasan) : null,
        ttd.ketahui ? uploadSignature(ttd.ketahui) : null,
      ]);

      const payload = {
        ...data,
        siteId: data.siteId || null,
        atasanNama: data.atasanNama || null,
        atasanJabatan: data.atasanJabatan || null,
        ketahuiNama: data.ketahuiNama || null,
        ketahuiJabatan: data.ketahuiJabatan || null,
        ttdPetugas: ttdPetugas?.fileId ?? null,
        ttdAtasan: ttdAtasan?.fileId ?? null,
        ttdKetahui: ttdKetahui?.fileId ?? null,
        lampiran: lampiran.map((item) => ({
          fileId: item.fileId,
          keterangan: item.keterangan,
        })),
      };

      const response = await fetch(
        `${API_URL}/api/insiden/berita-acara`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.message ?? "Gagal membuat Berita Acara",
        );
      }

      toast.success("Berita Acara berhasil dibuat");

      form.reset();
      setLampiran([]);
      setTtd({
        petugas: null,
        atasan: null,
        ketahui: null,
      });

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal membuat Berita Acara",
      );
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Berita Acara Baru</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Site</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih site..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.nama}
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
                name="lokasiGedung"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lokasi Gedung</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih lokasi..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {lokasiList.map((lokasi) => (
                          <SelectItem
                            key={lokasi.id}
                            value={lokasi.nama}
                          >
                            {lokasi.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tanggal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tanggal</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="waktu"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Waktu</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="jenisInsiden"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jenis Insiden</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih jenis insiden..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {JENIS_INSIDEN.map((jenis) => (
                        <SelectItem key={jenis} value={jenis}>
                          {JENIS_INSIDEN_LABELS[jenis]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {(
              [
                ["lokasiDetail", "Lokasi Detail Kejadian"],
                ["kronologi", "Kronologi Kejadian"],
                ["tindakan", "Tindakan yang Diambil"],
                ["hasilTindakan", "Hasil Tindakan"],
              ] as const
            ).map(([name, label]) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(
                [
                  ["petugasNama", "Nama Petugas"],
                  ["petugasJabatan", "Jabatan Petugas"],
                  ["atasanNama", "Nama Atasan"],
                  ["atasanJabatan", "Jabatan Atasan"],
                  ["ketahuiNama", "Nama Yang Mengetahui"],
                  ["ketahuiJabatan", "Jabatan Yang Mengetahui"],
                  ["tempatTtd", "Tempat Tanda Tangan"],
                ] as const
              ).map(([name, label]) => (
                <FormField
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{label}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ))}
            </div>

            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-medium">
                Tanda Tangan Digital
              </h4>

              <SignaturePad
                onEnd={(value) =>
                  setTtd((state) => ({
                    ...state,
                    petugas: value,
                  }))
                }
              />

              <SignaturePad
                onEnd={(value) =>
                  setTtd((state) => ({
                    ...state,
                    atasan: value,
                  }))
                }
              />

              <SignaturePad
                onEnd={(value) =>
                  setTtd((state) => ({
                    ...state,
                    ketahui: value,
                  }))
                }
              />
            </div>

            <div className="border-t pt-4">
              <h4 className="mb-3 text-sm font-medium">
                Lampiran Foto
              </h4>
              <LampiranUpload
                value={lampiran}
                onChange={setLampiran}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={onClose}
              >
                Batal
              </Button>

              <Button type="submit" disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}