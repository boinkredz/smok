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
import type { AssignmentRow, AbsensiInfo, AbsensiStatus } from "../types/assig.ts";

const API_URL = import.meta.env.VITE_API_URL ?? "";

const schema = z.object({
  officerId: z.string().min(1, "Pilih petugas"),
  shiftId: z.string().min(1, "Pilih shift"),
  siteId: z.string().optional(),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  catatan: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

type Officer = {
  id: number;
  nama: string;
  jabatan?: string;
  status?: string;
};

type Shift = {
  id: number;
  nama: string;
  jamMulai: string;
  jamSelesai: string;
};

type Site = {
  id: number;
  name: string;
  kode?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  defaultDate: string;
  editAssignment?: AssignmentRow | null;
};

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options?.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options?.headers ?? {}),
    },
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      result?.message ??
        result?.error ??
        "Terjadi kesalahan pada server.",
    );
  }

  return result?.data ?? result;
}

function extractArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { data?: unknown }).data)
  ) {
    return (value as { data: T[] }).data;
  }

  return [];
}

export default function AssignmentFormDialog({
  open,
  onClose,
  defaultDate,
  editAssignment,
}: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      officerId: "",
      shiftId: "",
      siteId: "",
      tanggal: defaultDate,
      catatan: "",
    },
  });

  const [officers, setOfficers] = useState<Officer[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;

    async function loadOptions() {
      try {
        setLoadingOptions(true);

        const [officerData, shiftData, siteData] =
          await Promise.all([
            request<unknown>("/api/officers"),
            request<unknown>("/api/shifts"),
            request<unknown>("/api/sites?aktifOnly=true"),
          ]);

        setOfficers(extractArray<Officer>(officerData));
        setShifts(extractArray<Shift>(shiftData));
        setSites(extractArray<Site>(siteData));
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Gagal mengambil data pilihan.",
        );
      } finally {
        setLoadingOptions(false);
      }
    }

    void loadOptions();
  }, [open]);

  useEffect(() => {
    if (editAssignment) {
    form.reset({
      officerId: String(editAssignment.officerId),
      shiftId: editAssignment.shiftId ? String(editAssignment.shiftId) : "",
      siteId: editAssignment.siteId ? String(editAssignment.siteId) : "",
      tanggal: editAssignment.tanggal.slice(0, 10),
      catatan: editAssignment.catatan ?? "",
    });
  }
}, [editAssignment, open, form]);

  async function onSubmit(data: FormData) {
    try {
      const payload = {
        officerId: Number(data.officerId),
        shiftId: Number(data.shiftId),
        siteId: data.siteId
          ? Number(data.siteId)
          : null,
        tanggal: data.tanggal,
        catatan: data.catatan?.trim() || null,
      };

      if (editAssignment) {
        await request(`/api/assignments/${editAssignment.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        toast.success("Jadwal berhasil diperbarui.");
      } else {
        await request("/api/assignments", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        toast.success("Jadwal berhasil ditambahkan.");
      }

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan jadwal.",
      );
    }
  }

  return (
    <Dialog
      open={open}
      modal={false}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editAssignment
              ? "Edit Jadwal Shift"
              : "Tambah Jadwal Shift"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="officerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Petugas</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingOptions}
                    
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih petugas..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-[1100]">
                      {officers.map((officer) => (
                        <SelectItem
                          key={officer.id}
                          value={String(officer.id)}
                        >
                          {officer.nama}
                          {officer.jabatan
                            ? ` - ${officer.jabatan}`
                            : ""}
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
              name="shiftId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={loadingOptions}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih shift..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-[1100]">
                      {shifts.map((shift) => (
                        <SelectItem
                          key={shift.id}
                          value={String(shift.id)}
                        >
                          {shift.nama} ({shift.jamMulai} -{" "}
                          {shift.jamSelesai})
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
              name="siteId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <Select
                    value={field.value || "none"}
                    onValueChange={(value) =>
                      field.onChange(value === "none" ? "" : value)
                    }
                    disabled={loadingOptions}
                    
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih site..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-[1100]">
                      <SelectItem value="none">
                        Tanpa site
                      </SelectItem>
                      {sites.map((site) => (
                        <SelectItem
                          key={site.id}
                          value={String(site.id)}
                        >
                          {site.name}
                          {site.kode ? ` (${site.kode})` : ""}
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
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Catatan tambahan..."
                      {...field}
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
                {form.formState.isSubmitting
                  ? "Menyimpan..."
                  : editAssignment
                    ? "Simpan Perubahan"
                    : "Tambah Jadwal"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}