import { useEffect } from "react";
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
import { Input } from "@/components/ui/input.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Button } from "@/components/ui/button.tsx";
import type { ShiftRow } from "./shift.types.ts";

const API_URL =
  import.meta.env.VITE_API_URL ?? "http://localhost:3000";

const WARNA_OPTIONS = [
  { hex: "#3B82F6", label: "Biru" },
  { hex: "#10B981", label: "Hijau" },
  { hex: "#F59E0B", label: "Kuning" },
  { hex: "#EF4444", label: "Merah" },
  { hex: "#8B5CF6", label: "Ungu" },
  { hex: "#EC4899", label: "Pink" },
  { hex: "#06B6D4", label: "Cyan" },
  { hex: "#6B7280", label: "Abu-abu" },
];

const schema = z.object({
  nama: z.string().min(1, "Nama shift wajib diisi"),
  jamMulai: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  jamSelesai: z.string().regex(/^\d{2}:\d{2}$/, "Format HH:MM"),
  warnaTema: z.string().optional(),
  keterangan: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onClose: () => void;
  editShift?: ShiftRow | null;
};

async function getErrorMessage(response: Response) {
  try {
    const result = await response.json();

    return (
      result.message ??
      result.error ??
      "Terjadi kesalahan pada server"
    );
  } catch {
    return `Server mengembalikan status ${response.status}`;
  }
}

export default function ShiftFormDialog({
  open,
  onClose,
  editShift,
}: Props) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      nama: "",
      jamMulai: "08:00",
      jamSelesai: "16:00",
      warnaTema: "#3B82F6",
      keterangan: "",
    },
  });

  useEffect(() => {
    if (editShift) {
      form.reset({
        nama: editShift.nama,
        jamMulai: editShift.jamMulai,
        jamSelesai: editShift.jamSelesai,
        warnaTema: editShift.warnaTema ?? "#3B82F6",
        keterangan: editShift.keterangan ?? "",
      });
    } else {
      form.reset({
        nama: "",
        jamMulai: "08:00",
        jamSelesai: "16:00",
        warnaTema: "#3B82F6",
        keterangan: "",
      });
    }
  }, [editShift, open, form]);

  const onSubmit = async (data: FormValues) => {
    try {
      const url = editShift
        ? `${API_URL}/api/shifts/${editShift.id}`
        : `${API_URL}/api/shifts`;

      const response = await fetch(url, {
        method: editShift ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(await getErrorMessage(response));
      }

      toast.success(
        editShift ? "Shift diperbarui" : "Shift ditambahkan",
      );

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan",
      );
    }
  };

  const selectedWarna = form.watch("warnaTema");

  return (
    <Dialog open={open} onOpenChange={(value) => {
      if (!value) onClose();
    }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editShift ? "Edit Shift" : "Tambah Shift"}
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
                  <FormLabel>Nama Shift</FormLabel>
                  <FormControl>
                    <Input placeholder="Shift Pagi" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="jamMulai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jam Mulai</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="jamSelesai"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jam Selesai</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="warnaTema"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Warna Tema</FormLabel>

                  <div className="flex flex-wrap gap-2">
                    {WARNA_OPTIONS.map((color) => (
                      <button
                        key={color.hex}
                        type="button"
                        title={color.label}
                        onClick={() => field.onChange(color.hex)}
                        className="size-7 rounded-full border-2"
                        style={{
                          backgroundColor: color.hex,
                          borderColor:
                            selectedWarna === color.hex
                              ? "#fff"
                              : "transparent",
                          outline:
                            selectedWarna === color.hex
                              ? `2px solid ${color.hex}`
                              : "none",
                        }}
                      />
                    ))}
                  </div>

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
                  : editShift
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