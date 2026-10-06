import { lazy, Suspense, useEffect, useState } from "react";
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
  FormDescription,
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
import { Skeleton } from "@/components/ui/skeleton.tsx";

const GeoFencePickerMap = lazy(
  () => import("./geofence-picker-map.tsx"),
);

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const schema = z.object({
  siteId: z.string().min(1, "Pilih site."),
  name: z.string().min(1, "Nama zona wajib diisi."),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusMeters: z.number().min(10).max(10000),
  description: z.string().optional(),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

type Site = {
  id: number;
  name: string;
  code?: string | null;
};

type GeoFence = {
  id: number;
  site_id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  description?: string | null;
  is_active: boolean;
};

type Props = {
  open: boolean;
  onClose: () => void;
  editZone?: GeoFence | null;
  sites: Site[];
  onSaved: () => Promise<void>;
};

export default function GeoFenceFormDialog({
  open,
  onClose,
  editZone,
  sites,
  onSaved,
}: Props) {
  const [locating, setLocating] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      siteId: "",
      name: "Zona Utama",
      latitude: -6.2,
      longitude: 106.816,
      radiusMeters: 100,
      description: "",
      isActive: true,
    },
  });

  useEffect(() => {
    if (editZone) {
      form.reset({
        siteId: String(editZone.site_id),
        name: editZone.name,
        latitude: Number(editZone.latitude),
        longitude: Number(editZone.longitude),
        radiusMeters: Number(editZone.radius_meters),
        description: editZone.description ?? "",
        isActive: editZone.is_active,
      });
    } else {
      form.reset({
        siteId: "",
        name: "Zona Utama",
        latitude: -6.2,
        longitude: 106.816,
        radiusMeters: 100,
        description: "",
        isActive: true,
      });
    }
  }, [editZone, form]);

  function fillCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolokasi tidak didukung browser.");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        form.setValue(
          "latitude",
          Number(position.coords.latitude.toFixed(6)),
          { shouldValidate: true },
        );

        form.setValue(
          "longitude",
          Number(position.coords.longitude.toFixed(6)),
          { shouldValidate: true },
        );

        setLocating(false);
        toast.success("Koordinat berhasil diambil dari GPS.");
      },
      () => {
        setLocating(false);
        toast.error("Gagal mendapatkan lokasi GPS.");
      },
      {
        timeout: 10000,
        enableHighAccuracy: true,
      },
    );
  }

  const onSubmit = async (values: FormData) => {
    try {
      const url = editZone
        ? `${API_URL}/api/geofences/${editZone.id}`
        : `${API_URL}/api/geofences`;

      const response = await fetch(url, {
        method: editZone ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          site_id: Number(values.siteId),
          name: values.name,
          latitude: Number(values.latitude),
          longitude: Number(values.longitude),
          radius_meters: Number(values.radiusMeters),
          description: values.description?.trim() || null,
          is_active: values.isActive,
        }),
      });

      const responseText = await response.text();

      let result: unknown;

      try {
        result = responseText ? JSON.parse(responseText) : null;
      } catch {
        result = responseText;
      }

      if (!response.ok) {
        console.error("Error API geofence:", result);
        throw new Error(
          `Gagal menyimpan geofence. Status: ${response.status}`,
        );
      }

      toast.success(
        editZone
          ? "Geofence berhasil diperbarui."
          : "Geofence berhasil ditambahkan.",
      );

      await onSaved();
      onClose();
    } catch (error) {
      console.error("Gagal menyimpan geofence:", error);

      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan geofence.",
      );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="z-[1000] max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editZone
              ? "Edit Zona Geo Fence"
              : "Tambah Zona Geo Fence"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
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
                        <SelectItem
                          key={site.id}
                          value={String(site.id)}
                        >
                          {site.name} [{site.code ?? "-"}]
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Zona</FormLabel>
                  <FormControl>
                    <Input placeholder="Zona Utama" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="relative z-0 overflow-hidden rounded-md">
              <Suspense fallback={<Skeleton className="h-48 w-full" />}>
                <GeoFencePickerMap
                  lat={form.watch("latitude")}
                  lng={form.watch("longitude")}
                  radius={form.watch("radiusMeters")}
                  onLocationPick={(latitude, longitude) => {
                    form.setValue("latitude", latitude, {
                      shouldValidate: true,
                    });

                    form.setValue("longitude", longitude, {
                      shouldValidate: true,
                    });
                  }}
                />
              </Suspense>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
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
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.000001"
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
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={fillCurrentLocation}
              disabled={locating}
            >
              {locating
                ? "Mendapatkan lokasi..."
                : "Isi dari GPS Perangkat"}
            </Button>

            <FormField
              control={form.control}
              name="radiusMeters"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Radius (meter)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={10}
                      max={10000}
                      value={field.value}
                      onChange={(event) =>
                        field.onChange(
                          Number(event.target.value),
                        )
                      }
                    />
                  </FormControl>
                  <FormDescription>
                    Minimal 10 meter dan maksimal 10.000 meter.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3">
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">
                    Zona aktif
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
                  : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}