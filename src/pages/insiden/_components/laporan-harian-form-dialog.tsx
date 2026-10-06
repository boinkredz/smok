import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import LampiranUpload from "./lampiran-upload";
import type { LampiranItem } from "./lampiran-upload";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const fisikSchema = z.object({
  nama: z.string().min(1),
  jabatan: z.string().min(1),
  posRotasi: z.string().min(1),
  kondisiFisik: z.string().min(1),
  kelengkapanKerja: z.string().min(1),
  keterangan: z.string().optional(),
});

const peralatanSchema = z.object({
  namaAlat: z.string().min(1),
  jmlStandar: z.number().min(0),
  jmlTersedia: z.number().min(0),
  kondisi: z.string().min(1),
  keterangan: z.string().optional(),
});

const schema = z.object({
  siteId: z.string().optional(),
  tanggal: z.string().min(1),
  shift: z.string().min(1),
  namaPembuat: z.string().min(1),
  jabatanPembuat: z.string().min(1),
  namaAtasan: z.string().optional(),
  jabatanAtasan: z.string().optional(),
  lokasiGedung: z.string().min(1),
  personilHarusnya: z.number().min(0),
  personilHadir: z.number().min(0),
  statusKehadiran: z.enum(["lengkap", "tidak_lengkap"]),
  adaTerlambat: z.boolean(),
  detailTerlambat: z.string().optional(),
  adaAbsen: z.boolean(),
  detailAbsen: z.string().optional(),
  detailBackup: z.string().optional(),
  cekFisik: z.array(fisikSchema),
  cekPeralatan: z.array(peralatanSchema),
  adaDinamika: z.boolean(),
  dinamika: z.string().optional(),
  adaInfoRegu: z.boolean(),
  detailInfoRegu: z.string().optional(),
  adaEskalasi: z.boolean(),
  detailEskalasi: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
};

type Option = {
  id: number;
  nama: string;
  jamMulai?: string;
  jamSelesai?: string;
};

type Profile = {
  officer: {
    nama: string;
    jabatan?: string | null;
  };
  atasan?: {
    nama: string;
    jabatan?: string | null;
  } | null;
};

export default function LaporanHarianFormDialog({
  open,
  onClose,
}: Props) {
  const [sites, setSites] = useState<Option[]>([]);
  const [lokasi, setLokasi] = useState<Option[]>([]);
  const [shifts, setShifts] = useState<Option[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lampiran, setLampiran] = useState<LampiranItem[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: "",
      tanggal: new Date().toISOString().slice(0, 10),
      shift: "",
      namaPembuat: "",
      jabatanPembuat: "",
      namaAtasan: "",
      jabatanAtasan: "",
      lokasiGedung: "",
      personilHarusnya: 0,
      personilHadir: 0,
      statusKehadiran: "lengkap",
      adaTerlambat: false,
      detailTerlambat: "",
      adaAbsen: false,
      detailAbsen: "",
      detailBackup: "",
      cekFisik: [],
      cekPeralatan: [],
      adaDinamika: false,
      dinamika: "",
      adaInfoRegu: false,
      detailInfoRegu: "",
      adaEskalasi: false,
      detailEskalasi: "",
    },
  });

  const fisik = useFieldArray({
    control: form.control,
    name: "cekFisik",
  });

  const peralatan = useFieldArray({
    control: form.control,
    name: "cekPeralatan",
  });

  const adaTerlambat = form.watch("adaTerlambat");
  const adaAbsen = form.watch("adaAbsen");
  const adaDinamika = form.watch("adaDinamika");
  const adaInfoRegu = form.watch("adaInfoRegu");
  const adaEskalasi = form.watch("adaEskalasi");

  useEffect(() => {
    if (!open) return;

    async function loadData() {
      try {
        const [s, l, sh, p] = await Promise.all([
          fetch(`${API_URL}/api/sites?aktifOnly=true`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/master-data/lokasi-gedung?aktifOnly=true`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/shifts`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/api/officers/me-with-atasan`, {
            credentials: "include",
          }),
        ]);

        if (![s, l, sh, p].every((r) => r.ok)) {
          throw new Error("Gagal memuat data formulir");
        }

        const [sj, lj, shj, pj] = await Promise.all([
          s.json(),
          l.json(),
          sh.json(),
          p.json(),
        ]);

        setSites(sj.data ?? sj);
        setLokasi(lj.data ?? lj);
        setShifts(shj.data ?? shj);
        setProfile(pj.data ?? pj);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gagal memuat data",
        );
      }
    }

    void loadData();
  }, [open]);

  useEffect(() => {
    if (!profile) return;

    form.setValue("namaPembuat", profile.officer.nama);
    form.setValue("jabatanPembuat", profile.officer.jabatan ?? "");
    form.setValue("namaAtasan", profile.atasan?.nama ?? "");
    form.setValue("jabatanAtasan", profile.atasan?.jabatan ?? "");
  }, [profile, form]);

  async function onSubmit(data: FormData) {
    try {
      const response = await fetch(`${API_URL}/api/laporan-harian`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...data,
          siteId: data.siteId ? Number(data.siteId) : null,
          namaAtasan: data.namaAtasan || null,
          jabatanAtasan: data.jabatanAtasan || null,
          lampiran: lampiran.map((item) => ({
            storageId: item.storageId,
            keterangan: item.keterangan || null,
          })),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.message ?? "Gagal menyimpan laporan");
      }

      toast.success("Laporan Harian berhasil dibuat");
      form.reset();
      setLampiran([]);
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menyimpan laporan",
      );
    }
  }

  const field = (name: keyof FormData, label: string) => (
    <FormField
      control={form.control}
      name={name as never}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input {...field} value={String(field.value ?? "")} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Buat Laporan Harian</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <div className="grid gap-3 sm:grid-cols-3">
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
                          <SelectValue placeholder="Pilih site" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sites.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={String(item.id)}
                          >
                            {item.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {field("tanggal", "Tanggal")}

              <FormField
                control={form.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Shift</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih shift" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {shifts.map((item) => (
                          <SelectItem
                            key={item.id}
                            value={item.nama}
                          >
                            {item.nama} ({item.jamMulai}–
                            {item.jamSelesai})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {field("namaPembuat", "Nama Pembuat")}
              {field("jabatanPembuat", "Jabatan Pembuat")}
              {field("namaAtasan", "Nama Atasan")}
              {field("jabatanAtasan", "Jabatan Atasan")}
            </div>

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
                        <SelectValue placeholder="Pilih lokasi" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {lokasi.map((item) => (
                        <SelectItem key={item.id} value={item.nama}>
                          {item.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-3">
              {field("personilHarusnya", "Personil Seharusnya")}
              {field("personilHadir", "Personil Hadir")}
              <FormField
                control={form.control}
                name="statusKehadiran"
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
                        <SelectItem value="lengkap">Lengkap</SelectItem>
                        <SelectItem value="tidak_lengkap">
                          Tidak Lengkap
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            {[
              ["adaTerlambat", "Ada Keterlambatan", "detailTerlambat"],
              ["adaAbsen", "Ada yang Absen", "detailAbsen"],
              ["adaDinamika", "Ada Dinamika", "dinamika"],
              ["adaInfoRegu", "Ada Info Regu Berikutnya", "detailInfoRegu"],
              ["adaEskalasi", "Ada Eskalasi", "detailEskalasi"],
            ].map(([toggle, label, detail]) => {
              const checked = form.watch(toggle as keyof FormData) as boolean;

              return (
                <div key={toggle} className="space-y-2">
                  <FormField
                    control={form.control}
                    name={toggle as never}
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <FormLabel>{label}</FormLabel>
                      </FormItem>
                    )}
                  />

                  {checked && (
                    <FormField
                      control={form.control}
                      name={detail as never}
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              rows={3}
                              placeholder={`Detail ${label.toLowerCase()}...`}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              );
            })}

            <section className="space-y-3">
              <div className="flex justify-between">
                <h4 className="font-semibold">Pengecekan Fisik Personil</h4>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    fisik.append({
                      nama: "",
                      jabatan: "",
                      posRotasi: "",
                      kondisiFisik: "Baik",
                      kelengkapanKerja: "Lengkap",
                      keterangan: "",
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah
                </Button>
              </div>

              {fisik.fields.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded border p-3 sm:grid-cols-6"
                >
                  {(["nama", "jabatan", "posRotasi", "kondisiFisik", "kelengkapanKerja"] as const).map(
                    (name) => (
                      <FormField
                        key={name}
                        control={form.control}
                        name={`cekFisik.${index}.${name}`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{name}</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    ),
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => fisik.remove(index)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </section>

            <section className="space-y-3">
              <div className="flex justify-between">
                <h4 className="font-semibold">Pengecekan Peralatan</h4>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    peralatan.append({
                      namaAlat: "",
                      jmlStandar: 0,
                      jmlTersedia: 0,
                      kondisi: "Baik",
                      keterangan: "",
                    })
                  }
                >
                  <Plus className="mr-1 h-4 w-4" />
                  Tambah
                </Button>
              </div>

              {peralatan.fields.map((item, index) => (
                <div
                  key={item.id}
                  className="grid gap-2 rounded border p-3 sm:grid-cols-6"
                >
                  <FormField
                    control={form.control}
                    name={`cekPeralatan.${index}.namaAlat`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Alat</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  {(["jmlStandar", "jmlTersedia"] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={`cekPeralatan.${index}.${name}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{name}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              value={field.value}
                              onChange={(event) =>
                                field.onChange(
                                  Number(event.target.value) || 0,
                                )
                              }
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}

                  {(["kondisi", "keterangan"] as const).map((name) => (
                    <FormField
                      key={name}
                      control={form.control}
                      name={`cekPeralatan.${index}.${name}`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{name}</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  ))}

                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => peralatan.remove(index)}
                  >
                    <Trash2 className="text-destructive" />
                  </Button>
                </div>
              ))}
            </section>

            <section>
              <h4 className="mb-2 font-semibold">Lampiran</h4>
              <LampiranUpload
                value={lampiran}
                onChange={setLampiran}
              />
            </section>

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
                  : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}