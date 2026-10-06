import { useEffect, useState } from "react";
import { Authenticated } from "@/components/providers/auth";
import {
  Building2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty.tsx";

import SiteFormDialog from "./_components/site-form-dialog.tsx";
import SiteOfficersDialog from "./_components/site-officers-dialog.tsx";

type SiteRow = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
  jumlahPetugas: number;
};

type OfficerTarget = {
  id: number;
  nama: string;
};

const API_URL = (
  import.meta.env.VITE_API_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

function SiteList() {
  const [sites, setSites] = useState<SiteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editSite, setEditSite] = useState<SiteRow | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [officerTarget, setOfficerTarget] =
    useState<OfficerTarget | null>(null);

  async function loadSites() {
    try {
      setLoading(true);

      const response = await fetch(`${API_URL}/api/sites`, {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal mengambil data site.");
      }

      setSites(data.sites ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal mengambil data site.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSites();
  }, []);

  async function handleDelete() {
    if (deleteId === null) return;

    try {
      const response = await fetch(
        `${API_URL}/api/sites/${deleteId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message ?? "Gagal menghapus site.");
      }

      setSites((current) =>
        current.filter((site) => site.id !== deleteId),
      );

      toast.success("Site berhasil dihapus.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menghapus site.",
      );
    } finally {
      setDeleteId(null);
    }
  }

  function openCreateDialog() {
    setEditSite(null);
    setFormOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Operasional"
        description="Kelola lokasi kerja, koordinat GPS, dan penugasan petugas per site."
        action={
          <Button onClick={openCreateDialog}>
            <Plus className="size-4" />
            Tambah Site
          </Button>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-44 w-full" />
          ))}
        </div>
      ) : sites.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2 />
            </EmptyMedia>
            <EmptyTitle>Belum ada site</EmptyTitle>
            <EmptyDescription>
              Tambahkan lokasi kerja pertama untuk mulai mengatur petugas.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button size="sm" onClick={openCreateDialog}>
              Tambah Site
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sites.map((site) => (
            <Card
              key={site.id}
              className={site.is_active ? "" : "opacity-60"}
            >
              <CardContent className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
                      <Building2 className="size-4" />
                    </div>

                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold">
                        {site.name}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={site.is_active ? "default" : "secondary"}
                    className={
                      site.is_active
                        ? "shrink-0 bg-green-600 text-white"
                        : "shrink-0"
                    }
                  >
                    {site.is_active ? "Aktif" : "Nonaktif"}
                  </Badge>
                </div>

                <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="mt-0.5 size-3 shrink-0" />
                  <span>
                    {site.latitude.toFixed(7)},{" "}
                    {site.longitude.toFixed(7)}
                  </span>
                </div>

                <div className="rounded-md bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                  Radius geofence: {site.radius_meters} meter
                </div>

                <div className="flex items-center justify-between border-t pt-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1.5 text-xs"
                    onClick={() =>
                      setOfficerTarget({
                        id: site.id,
                        nama: site.name,
                      })
                    }
                  >
                    <Users className="size-3" />
                    {site.jumlahPetugas} Petugas
                  </Button>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        setEditSite(site);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-3.5" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(site.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SiteFormDialog
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditSite(null);
          void loadSites();
        }}
        editSite={editSite}
      />

      {officerTarget && (
        <SiteOfficersDialog
          open
          onClose={() => setOfficerTarget(null)}
          siteId={officerTarget.id}
          siteName={officerTarget.nama}
        />
      )}

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Site?</AlertDialogTitle>
            <AlertDialogDescription>
              Semua penugasan petugas pada site ini juga akan dihapus.
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function SitePage() {
  return (
    <Authenticated>
      <SiteList />
    </Authenticated>
  );
}