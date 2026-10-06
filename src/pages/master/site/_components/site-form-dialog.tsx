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
import { Button } from "@/components/ui/button.tsx";
import { Switch } from "@/components/ui/switch.tsx";

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const schema = z.object({
  name: z.string().min(1, "Nama site wajib diisi"),
  latitude: z.string().min(1, "Latitude wajib diisi"),
  longitude: z.string().min(1, "Longitude wajib diisi"),
  radius_meters: z
    .string()
    .min(1, "Radius wajib diisi")
    .refine((value) => Number(value) > 0, "Radius harus lebih dari 0"),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type SiteRow = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  jumlahPetugas: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editSite?: SiteRow | null;
};

const emptyValues: FormData = {
  name: "",
  latitude: "",
  longitude: "",
  radius_meters: "100",
  is_active: true,
};

export default function SiteFormDialog({
  open,
  onClose,
  editSite,
}: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (editSite) {
      form.reset({
        name: editSite.name,
        latitude: String(editSite.latitude),
        longitude: String(editSite.longitude),
        radius_meters: String(editSite.radius_meters),
        is_active: editSite.is_active,
      });
    } else {
      form.reset(emptyValues);
    }
  }, [editSite, open, form]);

  async function onSubmit(data: FormData) {
    try {
      const isEdit = editSite !== null && editSite !== undefined;

      const response = await fetch(
        isEdit
          ? `${API_URL}/api/sites/${editSite.id}`
          : `${API_URL}/api/sites`,
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            name: data.name,
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            radius_meters: Number(data.radius_meters),
            is_active: data.is_active,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? "Gagal menyimpan site.",
        );
      }

      toast.success(
        isEdit ? "Site berhasil diperbarui." : "Site berhasil ditambahkan.",
      );

      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan site.",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editSite ? "Edit Site" : "Tambah Site"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Site</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Gedung A - Jakarta"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input placeholder="-6.200000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input placeholder="106.816666" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="radius_meters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Radius Geofence (meter)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Site aktif
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
                  : editSite
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