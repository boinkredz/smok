import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "convex/react";
import { Authenticated  } from "@/components/providers/auth";
import { format } from "date-fns";
import { toast } from "sonner";
import { ConvexError } from "convex/values";
import jsQR from "jsqr";
import {
  ArrowLeft, QrCode, MapPin, Camera, CheckCircle2, AlertTriangle,
  ShieldAlert, FileText, Loader2, X, Upload, RotateCcw, Check,
} from "lucide-react";
import { api } from "@convex/_generated/api.js";
import type { Id } from "@convex/_generated/dataModel.js";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Label } from "@/components/ui/label.tsx";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select.tsx";
import { cn } from "@/lib/utils.ts";

// Haversine distance in meters
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type CheckpointData = {
  _id: Id<"checkpoint">;
  nama: string;
  urutan: number;
  deskripsi?: string;
  koordinat?: { lat: number; lng: number };
  qrCode: string;
};

type ChecklistData = {
  _id: Id<"checklistPatroli">;
  checkpointId: Id<"checkpoint">;
  dikunjungi: boolean;
  waktuKunjungan?: string;
  lokasiKunjungan?: { lat: number; lng: number };
  temuanStatus: "normal" | "temuan" | "darurat";
  catatan?: string;
  fotoId?: Id<"_storage">;
  fotoUrl?: string;
};

type TugasType = {
  _id: Id<"tugasPatroli">;
  ruteId: Id<"rutePatroli">;
  officerId: Id<"officers">;
  tanggal: string;
  jamMulaiRencana: string;
  jamSelesaiRencana: string;
  status: "dijadwalkan" | "berlangsung" | "selesai" | "dibatalkan";
  waktuMulai?: string;
  lokasiTerakhir?: { lat: number; lng: number };
  rute: { _id: string; nama: string; estimasiMenit: number } | null;
  officer: { _id: string; nama: string; jabatan: string } | null;
  totalCheckpoints: number;
  checkpointsDikunjungi: number;
};

// ─── QR Scanner ──────────────────────────────────────────────────────────────

type ScanMode = "camera" | "manual";

type QrScanDialogProps = {
  open: boolean;
  onClose: () => void;
  onScanned: (qrCode: string) => void;
};

function QrScanDialog({ open, onClose, onScanned }: QrScanDialogProps) {
  const [mode, setMode] = useState<ScanMode>("camera");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setScanning(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);

      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const tick = () => {
        const video = videoRef.current;
        if (!video || video.readyState !== video.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height);
        if (code?.data) {
          stopCamera();
          onScanned(code.data);
          onClose();
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      toast.error("Tidak dapat mengakses kamera. Coba gunakan input kode manual.");
      setMode("manual");
    }
  }, [onScanned, onClose, stopCamera]);

  useEffect(() => {
    if (open && mode === "camera") {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, mode, startCamera, stopCamera]);

  const handleManualSubmit = () => {
    if (!manualCode.trim()) { toast.error("Masukkan kode checkpoint"); return; }
    onScanned(manualCode.trim());
    onClose();
    setManualCode("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { stopCamera(); onClose(); } }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="size-5" /> Scan QR Checkpoint</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 mb-3">
          <Button
            size="sm" variant={mode === "camera" ? "default" : "secondary"}
            className="flex-1 cursor-pointer" onClick={() => setMode("camera")}
          >
            <Camera className="size-4 mr-1" /> Kamera
          </Button>
          <Button
            size="sm" variant={mode === "manual" ? "default" : "secondary"}
            className="flex-1 cursor-pointer" onClick={() => setMode("manual")}
          >
            Manual
          </Button>
        </div>

        {mode === "camera" ? (
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="w-full aspect-square object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            {!scanning && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white bg-black/70">
                <Loader2 className="size-8 animate-spin" />
                <p className="text-sm">Memulai kamera...</p>
              </div>
            )}
            {scanning && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="size-48 border-2 border-white/80 rounded-lg" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Label>Kode QR Checkpoint</Label>
            <Input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Masukkan kode QR..."
              onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => { stopCamera(); onClose(); }}>Batal</Button>
          {mode === "manual" && (
            <Button onClick={handleManualSubmit} className="cursor-pointer">Konfirmasi</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Checkpoint Form ──────────────────────────────────────────────────────────

type CheckpointFormProps = {
  open: boolean;
  onClose: () => void;
  tugasId: Id<"tugasPatroli">;
  checkpoint: CheckpointData;
  existing: ChecklistData | null;
  gpsLoc: { lat: number; lng: number } | null;
};

function CheckpointFormDialog({ open, onClose, tugasId, checkpoint, existing, gpsLoc }: CheckpointFormProps) {
  const saveChecklist = useMutation(api.patroli.saveChecklist);
  const generateUrl = useMutation(api.patroli.generateUploadUrl);

  const [temuanStatus, setTemuanStatus] = useState<"normal" | "temuan" | "darurat">(existing?.temuanStatus ?? "normal");
  const [catatan, setCatatan] = useState(existing?.catatan ?? "");
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(existing?.fotoUrl ?? null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTemuanStatus(existing?.temuanStatus ?? "normal");
      setCatatan(existing?.catatan ?? "");
      setFotoFile(null);
      setFotoPreview(existing?.fotoUrl ?? null);
    }
  }, [open, existing]);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let fotoId: Id<"_storage"> | undefined;
      if (fotoFile) {
        const uploadUrl = await generateUrl({});
        const res = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": fotoFile.type }, body: fotoFile });
        if (!res.ok) throw new Error("Upload foto gagal");
        const { storageId } = await res.json() as { storageId: Id<"_storage"> };
        fotoId = storageId;
      }

      await saveChecklist({
        tugasId,
        checkpointId: checkpoint._id,
        dikunjungi: true,
        waktuKunjungan: new Date().toISOString(),
        lokasiKunjungan: gpsLoc ?? undefined,
        temuanStatus,
        catatan: catatan || undefined,
        fotoId,
      });
      toast.success("Checkpoint dicatat");
      onClose();
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const gpsWarning = checkpoint.koordinat && gpsLoc
    ? haversine(gpsLoc.lat, gpsLoc.lng, checkpoint.koordinat.lat, checkpoint.koordinat.lng) > 50
    : false;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="size-5" />
            #{checkpoint.urutan} {checkpoint.nama}
          </DialogTitle>
        </DialogHeader>

        {gpsWarning && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-sm text-yellow-700 dark:text-yellow-400">
            <AlertTriangle className="size-4 mt-0.5 shrink-0" />
            <span>Anda mungkin tidak berada di dekat checkpoint ini (jarak GPS {">"} 50m).</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Status Temuan</Label>
            <Select value={temuanStatus} onValueChange={(v) => setTemuanStatus(v as "normal" | "temuan" | "darurat")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">
                  <span className="flex items-center gap-2"><Check className="size-4 text-green-600" /> Normal — Aman</span>
                </SelectItem>
                <SelectItem value="temuan">
                  <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-yellow-600" /> Temuan — Perlu Perhatian</span>
                </SelectItem>
                <SelectItem value="darurat">
                  <span className="flex items-center gap-2"><ShieldAlert className="size-4 text-red-600" /> Darurat — Segera Ditangani</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-2 block">Catatan</Label>
            <Textarea
              value={catatan}
              onChange={(e) => setCatatan(e.target.value)}
              placeholder="Deskripsi kondisi, temuan, atau catatan..."
              rows={3}
            />
          </div>

          <div>
            <Label className="mb-2 block">Foto Bukti</Label>
            {fotoPreview ? (
              <div className="relative w-fit">
                <img src={fotoPreview} alt="Foto bukti" className="h-32 w-auto rounded-lg object-cover border" />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 size-5 rounded-full bg-destructive flex items-center justify-center text-white"
                  onClick={() => { setFotoFile(null); setFotoPreview(null); }}
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors w-fit">
                <Upload className="size-4" />
                <span>Upload Foto</span>
                <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
              </label>
            )}
          </div>

          {gpsLoc && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="size-3" />
              GPS: {gpsLoc.lat.toFixed(5)}, {gpsLoc.lng.toFixed(5)}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer gap-1">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function TugasDetailContent() {
  const { tugasId } = useParams<{ tugasId: string }>();
  const navigate = useNavigate();

  const currentTask = useQuery(
    api.patroli.getTugasById,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  ) as TugasType | null | undefined;

  const checkpoints = useQuery(
    api.patroli.listCheckpoints,
    currentTask?.ruteId ? { ruteId: currentTask.ruteId } : "skip",
  );

  const checklist = useQuery(
    api.patroli.getChecklist,
    tugasId ? { tugasId: tugasId as Id<"tugasPatroli"> } : "skip",
  );

  const updateStatus = useMutation(api.patroli.updateTugasStatus);

  const [qrOpen, setQrOpen] = useState(false);
  const [formCheckpoint, setFormCheckpoint] = useState<CheckpointData | null>(null);
  const [gpsLoc, setGpsLoc] = useState<{ lat: number; lng: number } | null>(null);

  // Get GPS on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.watchPosition(
        (pos) => setGpsLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {},
        { enableHighAccuracy: true },
      );
    }
  }, []);

  const handleScanned = async (qrCode: string) => {
    if (!checkpoints) { toast.error("Data checkpoint belum dimuat"); return; }
    const cp = checkpoints.find((c) => c.qrCode === qrCode);
    if (!cp) { toast.error("QR Code tidak dikenali. Pastikan QR sesuai dengan rute ini."); return; }
    if (!tugasId) return;

    // Start task if still dijadwalkan
    if (currentTask?.status === "dijadwalkan") {
      await updateStatus({
        tugasId: tugasId as Id<"tugasPatroli">,
        status: "berlangsung",
        waktuMulai: new Date().toISOString(),
        lokasiTerakhir: gpsLoc ?? undefined,
      }).catch(() => {});
    }

    setFormCheckpoint(cp as CheckpointData);
  };

  const handleStartPatroli = async () => {
    if (!tugasId || !currentTask) return;
    try {
      await updateStatus({
        tugasId: tugasId as Id<"tugasPatroli">,
        status: "berlangsung",
        waktuMulai: new Date().toISOString(),
        lokasiTerakhir: gpsLoc ?? undefined,
      });
      toast.success("Patroli dimulai");
    } catch (err) {
      toast.error(err instanceof ConvexError ? (err.data as { message: string }).message : "Gagal memulai patroli");
    }
  };

  if (!tugasId) {
    navigate("/patroli");
    return null;
  }

  const isLoading = currentTask === undefined || checkpoints === undefined || checklist === undefined;

  if (isLoading) {
    return (
      <div className="space-y-3 p-6">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
        <AlertTriangle className="size-10" />
        <p>Tugas tidak ditemukan</p>
        <Button variant="ghost" onClick={() => navigate("/patroli")}>Kembali</Button>
      </div>
    );
  }

  const checklistMap = new Map<string, ChecklistData>();
  (checklist as ChecklistData[]).forEach((cl) => checklistMap.set(cl.checkpointId, cl));

  const totalCp = checkpoints.length;
  const doneCp = checklist.filter((cl) => cl.dikunjungi).length;
  const pct = totalCp > 0 ? Math.round((doneCp / totalCp) * 100) : 0;

  const TEMUAN_CONFIG = {
    normal: { label: "Normal", icon: CheckCircle2, cls: "text-green-600" },
    temuan: { label: "Temuan", icon: AlertTriangle, cls: "text-yellow-600" },
    darurat: { label: "Darurat", icon: ShieldAlert, cls: "text-red-600" },
  };

  return (
    <div className="max-w-2xl mx-auto p-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/patroli")} className="cursor-pointer">
          <ArrowLeft className="size-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{currentTask.rute?.nama ?? "Patroli"}</h1>
          <p className="text-sm text-muted-foreground">
            {currentTask.officer?.nama} · {currentTask.tanggal} · {currentTask.jamMulaiRencana}–{currentTask.jamSelesaiRencana}
          </p>
        </div>
        <Badge className={cn(
          currentTask.status === "dijadwalkan" && "bg-secondary text-secondary-foreground",
          currentTask.status === "berlangsung" && "bg-blue-600 text-white",
          currentTask.status === "selesai" && "bg-green-600 text-white",
          currentTask.status === "dibatalkan" && "bg-destructive text-white",
        )}>
          {currentTask.status === "dijadwalkan" && "Dijadwalkan"}
          {currentTask.status === "berlangsung" && "Berlangsung"}
          {currentTask.status === "selesai" && "Selesai"}
          {currentTask.status === "dibatalkan" && "Dibatalkan"}
        </Badge>
      </div>

      {/* Progress */}
      <div className="rounded-lg border p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress Checkpoint</span>
          <span className="text-muted-foreground">{doneCp} / {totalCp}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">{pct}% selesai</p>
      </div>

      {/* Start Patrol Button */}
      {currentTask.status === "dijadwalkan" && (
        <Button className="w-full cursor-pointer" onClick={handleStartPatroli}>
          Mulai Patroli
        </Button>
      )}

      {/* Scan Button */}
      {(currentTask.status === "berlangsung" || currentTask.status === "dijadwalkan") && (
        <Button
          variant="secondary" size="lg"
          className="w-full cursor-pointer gap-2"
          onClick={() => setQrOpen(true)}
        >
          <QrCode className="size-5" /> Scan QR Checkpoint
        </Button>
      )}

      {/* Checkpoint List */}
      <div className="space-y-2">
        <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Daftar Checkpoint</h2>
        {(checkpoints as CheckpointData[]).map((cp) => {
          const cl = checklistMap.get(cp._id);
          const done = cl?.dikunjungi ?? false;
          const tc = done ? TEMUAN_CONFIG[cl!.temuanStatus] : null;
          const Icon = tc?.icon ?? null;

          return (
            <div
              key={cp._id}
              className={cn(
                "rounded-lg border p-4 flex items-start gap-3",
                done && "border-green-200 dark:border-green-900 bg-green-50/50 dark:bg-green-950/20",
              )}
            >
              <div className={cn(
                "size-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0 mt-0.5",
                done ? "bg-green-600 text-white" : "bg-muted text-muted-foreground",
              )}>
                {done ? <Check className="size-4" /> : cp.urutan}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{cp.nama}</p>
                {cp.deskripsi && <p className="text-xs text-muted-foreground">{cp.deskripsi}</p>}
                {done && cl && (
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {Icon && (
                      <span className={cn("flex items-center gap-1 text-xs font-medium", tc!.cls)}>
                        <Icon className="size-3" /> {tc!.label}
                      </span>
                    )}
                    {cl.waktuKunjungan && (
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(cl.waktuKunjungan), "HH:mm")}
                      </span>
                    )}
                    {cl.catatan && (
                      <span className="text-xs text-muted-foreground italic line-clamp-1">{cl.catatan}</span>
                    )}
                    {cl.fotoUrl && (
                      <img src={cl.fotoUrl} alt="bukti" className="size-6 rounded object-cover border" />
                    )}
                  </div>
                )}
              </div>
              {!done && (currentTask.status === "berlangsung" || currentTask.status === "dijadwalkan") && (
                <Button
                  variant="ghost" size="sm" className="shrink-0 cursor-pointer text-xs h-7"
                  onClick={() => setFormCheckpoint(cp)}
                >
                  Catat
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Laporan Button */}
      {currentTask.status !== "dibatalkan" && (
        <Button
          variant="default" size="lg"
          className="w-full cursor-pointer gap-2"
          onClick={() => navigate(`/patroli/laporan/${tugasId}`)}
        >
          <FileText className="size-5" /> Lihat & Submit Laporan
        </Button>
      )}

      <QrScanDialog open={qrOpen} onClose={() => setQrOpen(false)} onScanned={handleScanned} />

      {formCheckpoint && (
        <CheckpointFormDialog
          open={!!formCheckpoint}
          onClose={() => setFormCheckpoint(null)}
          tugasId={tugasId as Id<"tugasPatroli">}
          checkpoint={formCheckpoint}
          existing={checklistMap.get(formCheckpoint._id) ?? null}
          gpsLoc={gpsLoc}
        />
      )}
    </div>
  );
}

export default function TugasDetailPage() {
  return (
    <Authenticated>
      <TugasDetailContent />
    </Authenticated>
  );
}


