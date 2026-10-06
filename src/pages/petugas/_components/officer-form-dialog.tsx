import { useEffect, useState } from "react";
import { format } from "date-fns";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { request } from "@/lib/api";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LAINNYA = "__LAINNYA__";

const schema = z
  .object({
    nama: z.string().min(2, "Nama wajib diisi"),
    nik: z.string().min(1, "NIK wajib diisi"),

    jabatanSelect: z.string().min(1, "Jabatan wajib dipilih"),
    jabatanCustom: z.string().optional(),

    lokasiSelect: z.string().min(1, "Lokasi wajib dipilih"),
    lokasiCustom: z.string().optional(),

    telepon: z.string().optional(),
    email: z.string().email("Email tidak valid"),

    roleId: z.string().optional(),
password: z.string().optional(),

    status: z.enum(["aktif", "cuti", "nonaktif"]),
    tanggalMasuk: z.string().min(1, "Tanggal masuk wajib diisi"),
    catatan: z.string().optional(),

    supervisorId: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.jabatanSelect === LAINNYA &&
      !value.jabatanCustom?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["jabatanCustom"],
        message: "Jabatan lainnya wajib diisi",
      });
    }

    if (
      value.lokasiSelect === LAINNYA &&
      !value.lokasiCustom?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["lokasiCustom"],
        message: "Lokasi lainnya wajib diisi",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

type MasterItem = {
  id: string;
  nama: string;
};
type RoleItem = {
  id: number;
  name: string;
};
type Officer = {
  id: number | string;
  nama: string;
  nik: string;
  jabatan: string;
  lokasiTugas?: string | null;
  telepon?: string | null;
  email?: string | null;
  status?: "aktif" | "cuti" | "nonaktif";
  tanggalMasuk?: string | null;
  catatan?: string | null;
  supervisorId?: number | string | null;
  danruId?: number | string | null;
};


type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  officer?: Officer | null;
  onSaved?: () => Promise<void> | void;
};

type ApiList<T> = T[] | { data?: T[] } | undefined;

function asArray<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Array.isArray(value.data)
  ) {
    return value.data;
  }

  return [];
}

function normalizeMasterItems(items: any[]): MasterItem[] {
  return items
    .map((item, index) => {
      const nama =
        item.nama ??
        item.name ??
        item.namaJabatan ??
        item.namaLokasi ??
        item.title;

      const id = item.id ?? item.kode ?? nama ?? index;

      if (!nama) return null;

      return {
        id: String(id),
        nama: String(nama),
      };
    })
    .filter(Boolean) as MasterItem[];
}

function dateInput(value?: string | null): string {
  return value
    ? value.slice(0, 10)
    : format(new Date(), "yyyy-MM-dd");
}

function findMasterName(
  value: string,
  items: MasterItem[],
): string {
  if (value === LAINNYA) return "";

  return (
    items.find((item) => item.id === value)?.nama ??
    value
  );
}

export default function OfficerFormDialog({
  open,
  onOpenChange,
  officer,
  onSaved,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [jabatanList, setJabatanList] = useState<MasterItem[]>([]);
  const [lokasiList, setLokasiList] = useState<MasterItem[]>([]);
  const [allOfficers, setAllOfficers] = useState<Officer[]>([]);
  const [roleList, setRoleList] = useState<RoleItem[]>([]);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: "",
  nik: "",
  jabatanSelect: "",
  jabatanCustom: "",
  lokasiSelect: "",
  lokasiCustom: "",
  telepon: "",
  email: "",
  password: "",
  roleId: "",
  status: "aktif",
  tanggalMasuk: format(new Date(), "yyyy-MM-dd"),
  catatan: "",
  supervisorId: "",
    },
  });

  const jabatanSelect = form.watch("jabatanSelect");
  const lokasiSelect = form.watch("lokasiSelect");

  useEffect(() => {
    if (!open) return;

    async function loadFormData() {
  try {
    const [
      jabatanResponse,
      lokasiResponse,
      officerResponse,
      roleResponse,
    ] = await Promise.all([
      request<ApiList<any>>(
        "/api/master-data/jabatan",
      ),
      request<ApiList<any>>(
        "/api/master-data/lokasi-gedung",
      ),
      request<ApiList<Officer>>(
        "/api/officers",
      ),
      request<ApiList<any>>(
        "/api/master-data/roles",
      ),
    ]);

    setJabatanList(
      normalizeMasterItems(
        asArray(jabatanResponse),
      ),
    );

    setLokasiList(
      normalizeMasterItems(
        asArray(lokasiResponse),
      ),
    );

    setAllOfficers(
      asArray(officerResponse),
    );

    setRoleList(
      asArray(roleResponse)
        .map((role: any) => ({
          id: Number(role.id),
          name: String(
            role.name ??
              role.nama ??
              role.namaRole ??
              "",
          ),
        }))
        .filter(
          (role) =>
            role.id > 0 &&
            role.name.length > 0,
        ),
    );
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Gagal memuat data formulir.",
    );
  }
}

    void loadFormData();
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const jabatanItem = jabatanList.find(
      (item) => item.nama === officer?.jabatan,
    );

    const lokasiItem = lokasiList.find(
      (item) => item.nama === officer?.lokasiTugas,
    );

    form.reset({
  nama: officer?.nama ?? "",
  nik: officer?.nik ?? "",

  jabatanSelect: officer
    ? jabatanItem?.id ?? LAINNYA
    : "",

  jabatanCustom:
    officer && !jabatanItem
      ? officer.jabatan
      : "",

  lokasiSelect: officer
    ? lokasiItem?.id ?? LAINNYA
    : "",

  lokasiCustom:
    officer && !lokasiItem
      ? officer.lokasiTugas ?? ""
      : "",

  telepon: officer?.telepon ?? "",
  email: officer?.email ?? "",

  password: "",
  roleId: "",

  status: officer?.status ?? "aktif",
  tanggalMasuk: dateInput(officer?.tanggalMasuk),
  catatan: officer?.catatan ?? "",

  supervisorId: officer?.supervisorId
    ? String(officer.supervisorId)
    : "",

});
  }, [open, officer, jabatanList, lokasiList, form]);

  const supervisorList = allOfficers.filter((item) =>
    item.jabatan.toLowerCase().includes("supervisor"),
  );

  const danruList = allOfficers.filter((item) =>
    /danru|dan ru/i.test(item.jabatan),
  );

  async function onSubmit(values: FormValues) {
  try {
    setSubmitting(true);

    const jabatan =
      values.jabatanSelect === LAINNYA
        ? values.jabatanCustom?.trim()
        : findMasterName(
            values.jabatanSelect,
            jabatanList,
          );

    const lokasiTugas =
      values.lokasiSelect === LAINNYA
        ? values.lokasiCustom?.trim()
        : findMasterName(
            values.lokasiSelect,
            lokasiList,
          );

    if (!officer) {
      if (!values.password || values.password.length < 8) {
        form.setError("password", {
          type: "manual",
          message: "Password minimal 8 karakter",
        });
        return;
      }

      if (
        !values.roleId ||
        Number(values.roleId) <= 0
      ) {
        form.setError("roleId", {
          type: "manual",
          message: "Role wajib dipilih",
        });
        return;
      }
    }

    const payload: Record<string, unknown> = {
      nama: values.nama.trim(),
      nik: values.nik.trim(),
      jabatan,
      lokasiTugas,
      telepon: values.telepon?.trim() || null,
      email: values.email.trim().toLowerCase(),
      status: values.status,
      tanggalMasuk: new Date(
        `${values.tanggalMasuk}T00:00:00.000Z`,
      ).toISOString(),
      catatan: values.catatan?.trim() || null,
      supervisorId: values.supervisorId
        ? Number(values.supervisorId)
        : null,
    };

    // Password dan role hanya dikirim ketika menambah petugas.
    if (!officer) {
      payload.password = values.password;
      payload.roleId = Number(values.roleId);
    }

    await request(
      officer
        ? `/api/officers/${officer.id}`
        : "/api/officers",
      {
        method: officer ? "PUT" : "POST",
        body: JSON.stringify(payload),
      },
    );

    toast.success(
      officer
        ? "Data petugas diperbarui."
        : "Petugas berhasil ditambahkan.",
    );

    await onSaved?.();
    onOpenChange(false);
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "Gagal menyimpan data petugas.",
    );
  } finally {
    setSubmitting(false);
  }
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden p-0">
    {/* HEADER STICKY */}
    <DialogHeader className="sticky top-0 z-20 shrink-0 border-b bg-background px-6 py-4">
      <DialogTitle>
            {officer ? "Ubah Data Petugas" : "Tambah Petugas"}
          </DialogTitle>

      <DialogDescription>
        Lengkapi identitas dan penempatan petugas.
      </DialogDescription>
    </DialogHeader>

    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <Form {...form}>
          <form
            id="officer-form"
            onSubmit={form.handleSubmit(
    onSubmit,
    (errors) => {
      console.log("Validasi gagal:", errors);
      toast.error(
        "Periksa kembali field yang masih belum valid.",
      );
    },
  )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="nama"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama lengkap</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nik"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>NIK / ID Petugas</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="telepon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telepon</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

           <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <div className="space-y-4">
    <FormField
      control={form.control}
      name="jabatanSelect"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Jabatan</FormLabel>

          <Select
            value={field.value ?? ""}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih jabatan" />
              </SelectTrigger>
            </FormControl>

            <SelectContent
              position="popper"
              className="z-[99999]"
            >
              {jabatanList.map((item) => (
                <SelectItem
                  key={item.id}
                  value={String(item.id)}
                >
                  {item.nama}
                </SelectItem>
              ))}

              <SelectItem value={LAINNYA}>
                Lainnya
              </SelectItem>
            </SelectContent>
          </Select>

          <FormMessage />
        </FormItem>
      )}
    />

    {jabatanSelect === LAINNYA && (
      <FormField
        control={form.control}
        name="jabatanCustom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Jabatan lainnya</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
  </div>

  <div className="space-y-4">
    <FormField
      control={form.control}
      name="lokasiSelect"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Penempatan</FormLabel>

          <Select
            value={field.value ?? ""}
            onValueChange={field.onChange}
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pilih lokasi" />
              </SelectTrigger>
            </FormControl>

            <SelectContent
              position="popper"
              className="z-[99999]"
            >
              {lokasiList.map((item) => (
                <SelectItem
                  key={item.id}
                  value={String(item.id)}
                >
                  {item.nama}
                </SelectItem>
              ))}

              <SelectItem value={LAINNYA}>
                Lainnya
              </SelectItem>
            </SelectContent>
          </Select>

          <FormMessage />
        </FormItem>
      )}
    />

    {lokasiSelect === LAINNYA && (
      <FormField
        control={form.control}
        name="lokasiCustom"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Lokasi lainnya</FormLabel>
            <FormControl>
              <Input {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    )}
  </div>
</div>
                        
           {!officer && (
  <>
    <FormField
      control={form.control}
      name="password"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Password akun</FormLabel>
          <FormControl>
        <Input
          type="password"
          placeholder="Minimal 8 karakter"
          {...field}
          value={field.value ?? ""}
        />
      </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />

    <FormField
      control={form.control}
      name="roleId"
      render={({ field }) => (
          <FormItem>
                        <FormLabel>Role akun</FormLabel>

                        <Select
                          value={field.value ?? ""}
                          onValueChange={(value) => {
                            field.onChange(value);
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Pilih role akun" />
                            </SelectTrigger>
                          </FormControl>

                          <SelectContent
                            position="popper"
                            className="z-[99999]"
                          >
                            {roleList.length === 0 ? (
                              <SelectItem
                                value="role-empty"
                                disabled
                              >
                                Role belum tersedia
                              </SelectItem>
                            ) : (
                              roleList.map((role) => (
                                <SelectItem
                                  key={role.id}
                                  value={String(role.id)}
                                >
                                  {role.name}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>

                        <FormMessage />
                      </FormItem>
      )}
    />
  </>
)}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <FormField
    control={form.control}
    name="status"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Status</FormLabel>

        <Select
          value={field.value}
          onValueChange={field.onChange}
        >
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih status" />
            </SelectTrigger>
          </FormControl>

          <SelectContent
            position="popper"
            className="z-[99999]"
          >
            <SelectItem value="aktif">
              Aktif
            </SelectItem>
            <SelectItem value="cuti">
              Cuti
            </SelectItem>
            <SelectItem value="nonaktif">
              Nonaktif
            </SelectItem>
          </SelectContent>
        </Select>

        <FormMessage />
      </FormItem>
    )}
  />

  <FormField
    control={form.control}
    name="tanggalMasuk"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Tanggal masuk</FormLabel>
        <FormControl>
          <Input
            type="date"
            className="w-full"
            {...field}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
</div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  <FormField
    control={form.control}
    name="supervisorId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Supervisor</FormLabel>

        <Select
          value={field.value ?? ""}
          onValueChange={field.onChange}
        >
          <FormControl>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih supervisor" />
            </SelectTrigger>
          </FormControl>

          <SelectContent
            position="popper"
            className="z-[99999]"
          >
            {supervisorList.length === 0 ? (
              <SelectItem
                value="supervisor-empty"
                disabled
              >
                Supervisor belum tersedia
              </SelectItem>
            ) : (
              supervisorList.map((item) => (
                <SelectItem
                  key={String(item.id)}
                  value={String(item.id)}
                >
                  {item.nama}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>

        <FormMessage />
      </FormItem>
    )}
  />

  
</div>

            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea rows={3} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>
  </div>
        <DialogFooter className="sticky bottom-0 z-20 shrink-0 border-t bg-background px-6 py-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>

          <Button
            type="submit"
            form="officer-form"
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}