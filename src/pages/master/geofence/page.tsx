import { useEffect, useState } from "react";
import { Authenticated } from "@/components/providers/auth";
import { MapPin, Plus, Pencil, Trash2, CircleDot } from "lucide-react";
import { toast } from "sonner";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import {
  Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent,
} from "@/components/ui/empty.tsx";
import GeoFenceFormDialog from "./_components/geofence-form-dialog.tsx";
import GeoFenceMap from "./_components/geofence-map.tsx";

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

type Site = { id: number; name: string; code?: string };
type GeoFence = {
  id: number;
  site_id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  description?: string | null;
  is_active: boolean;
  site?: Site | null;
};

export default function GeoFencePage() {
  const [zones, setZones] = useState<GeoFence[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteFilter, setSiteFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editZone, setEditZone] = useState<GeoFence | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      setLoading(true);
      const [zonesRes, sitesRes] = await Promise.all([
        fetch(`${API_URL}/api/geofences`, { credentials: "include" }),
        fetch(`${API_URL}/api/sites`, { credentials: "include" }),
      ]);

      const zonesJson = await zonesRes.json();
      const sitesJson = await sitesRes.json();

      if (!zonesRes.ok) throw new Error(zonesJson.message ?? "Gagal mengambil geofence");
      if (!sitesRes.ok) throw new Error(sitesJson.message ?? "Gagal mengambil site");

      setZones(zonesJson.data ?? zonesJson.geofences ?? zonesJson);
      setSites(sitesJson.data ?? sitesJson.sites ?? sitesJson);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  async function handleDelete() {
    if (deleteId === null) return;

    try {
      const response = await fetch(`${API_URL}/api/geofences/${deleteId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Gagal menghapus");

      toast.success("Zona dihapus");
      setDeleteId(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus");
    }
  }

  const filtered = zones.filter(
    (zone) => siteFilter === "all" || String(zone.site_id) === siteFilter,
  );

  return (
    <Authenticated>
      <PageHeader
        title="Master Geo Fence"
        description="Kelola zona geofence per site untuk validasi lokasi check-in absensi."
        action={
          <Button onClick={() => { setEditZone(null); setFormOpen(true); }}>
            <Plus className="size-4" /> Tambah Zona
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-3">
        <Select value={siteFilter} onValueChange={setSiteFilter}>
          <SelectTrigger className="h-9 w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Site</SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={String(site.id)}>
                {site.name} [{site.code ?? "-"}]
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!loading && <span className="text-sm text-muted-foreground">{filtered.length} zona ditemukan</span>}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-64 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon"><MapPin /></EmptyMedia>
            <EmptyTitle>Belum ada zona geo fence</EmptyTitle>
            <EmptyDescription>Tambahkan zona geofence untuk memvalidasi lokasi check-in.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent><Button onClick={() => setFormOpen(true)}>Tambah Zona</Button></EmptyContent>
        </Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((zone) => (
            <Card key={zone.id} className={!zone.is_active ? "opacity-60" : ""}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CircleDot className="size-4 text-accent" />{zone.name}
                  </CardTitle>
                  <div className="flex gap-1">
                    {!zone.is_active && <Badge variant="outline">Nonaktif</Badge>}
                    <Button variant="ghost" size="icon" onClick={() => { setEditZone(zone); setFormOpen(true); }}><Pencil className="size-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(zone.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                {zone.site && <Badge variant="secondary">{zone.site.code} — {zone.site.name}</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                <GeoFenceMap lat={zone.latitude} lng={zone.longitude} radius={zone.radius_meters} className="h-40 w-full rounded-md" />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-md bg-muted px-3 py-2">
                    <div className="text-xs text-muted-foreground">Koordinat</div>
                    <div className="font-mono">{zone.latitude.toFixed(5)}, {zone.longitude.toFixed(5)}</div>
                  </div>
                  <div className="rounded-md bg-muted px-3 py-2">
                    <div className="text-xs text-muted-foreground">Radius</div>
                    <div className="font-semibold">{zone.radius_meters} meter</div>
                  </div>
                </div>
                {zone.description && <p className="text-sm text-muted-foreground">{zone.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <GeoFenceFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditZone(null); }}
        editZone={editZone}
        sites={sites}
        onSaved={loadData}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(value) => !value && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Zona?</AlertDialogTitle>
            <AlertDialogDescription>Zona yang dihapus tidak bisa dipulihkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Authenticated>
  );
}