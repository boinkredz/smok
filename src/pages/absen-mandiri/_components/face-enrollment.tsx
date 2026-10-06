import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Camera,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Save,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

type FaceEnrollmentProps = {
  onEnrolled: () => void;
  onCancel?: () => void;
};

export default function FaceEnrollment({
  onEnrolled,
  onCancel,
}: FaceEnrollmentProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  

  const [cameraReady, setCameraReady] = useState(false);
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);
  const [photoFile, setPhotoFile] =
    useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

const [successMessage, setSuccessMessage] =
  useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setErrorMessage(null);
      stopCamera();

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 720 },
            height: { ideal: 960 },
          },
          audio: false,
        });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Kamera tidak dapat diakses. Izinkan akses kamera pada browser.",
      );
    }
  }, [stopCamera]);

  useEffect(() => {
    void startCamera();

    return () => {
      stopCamera();

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [startCamera, stopCamera, previewUrl]);

  const handleCapture = () => {
    const video = videoRef.current;

    if (
      !video ||
      !cameraReady ||
      video.videoWidth === 0 ||
      video.videoHeight === 0
    ) {
      setErrorMessage("Kamera belum siap.");
      return;
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      setErrorMessage("Gagal memproses gambar.");
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);

    context.drawImage(
      video,
      0,
      0,
      canvas.width,
      canvas.height,
    );

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setErrorMessage("Gagal mengambil foto.");
          return;
        }

        const file = new File(
          [blob],
          `foto-profil-${Date.now()}.jpg`,
          { type: "image/jpeg" },
        );

        setPhotoFile(file);
        setPreviewUrl(URL.createObjectURL(blob));
        setErrorMessage(null);
        stopCamera();
      },
      "image/jpeg",
      0.9,
    );
  };

  const handleRetake = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setPhotoFile(null);

    void startCamera();
  };

  const handleSave = async () => {
    if (!photoFile) {
      setErrorMessage("Silakan ambil foto terlebih dahulu.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const formData = new FormData();

      // Harus menggunakan nama field "foto"
      formData.append("foto", photoFile, photoFile.name);

      const response = await fetch(
        `${API_URL}/api/absensi/face-enrollment`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ?? "Gagal menyimpan foto profil.",
        );
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setSuccessMessage("Foto profil sudah tersimpan.");

      setTimeout(() => {
        onEnrolled();
      }, 1500);
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan foto profil.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    stopCamera();

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    if (onCancel) {
      onCancel();
    } else {
      onEnrolled();
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-md space-y-5">
       {successMessage && (
      <div
        role="status"
        className="fixed left-1/2 top-5 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-xl bg-green-600 px-5 py-3 text-sm font-medium text-white shadow-xl"
      >
        <CheckCircle2 className="size-5" />
        {successMessage}
      </div>
    )}
      <div className="text-center">
        <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-full bg-primary/10">
          <Camera className="size-7 text-primary" />
        </div>

        <h3 className="text-xl font-bold">
          Ambil Foto Profil
        </h3>

        <p className="mt-1 text-sm text-muted-foreground">
          Posisikan wajah Anda di dalam lingkaran.
        </p>
      </div>

      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-black shadow-2xl">
        {previewUrl ? (
          <>
            <img
              src={previewUrl}
              alt="Pratinjau foto profil"
              className="h-full w-full object-cover"
            />

            <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-green-600 px-4 py-2 text-xs font-semibold text-white">
              <CheckCircle2 className="size-4" />
              Foto siap disimpan
            </div>
          </>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full -scale-x-100 object-cover"
            />

            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative size-64 animate-pulse rounded-full border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>

            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-4 py-2 text-xs text-white">
              {cameraReady
                ? "Pastikan wajah terlihat jelas"
                : "Menyiapkan kamera..."}
            </div>
          </>
        )}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-400">
          {errorMessage}
        </div>
      )}

      <div className="flex justify-center gap-3">
        {!previewUrl ? (
          <Button
            type="button"
            size="lg"
            disabled={!cameraReady || saving}
            onClick={handleCapture}
            className="rounded-full px-7 shadow-lg transition hover:scale-105 active:scale-95"
          >
            <Camera className="mr-2 size-5" />
            Ambil Foto
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={handleRetake}
              className="rounded-full"
            >
              <RotateCcw className="mr-2 size-4" />
              Ambil Ulang
            </Button>

            <Button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-full bg-green-600 hover:bg-green-700"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Simpan Foto
                </>
              )}
            </Button>
          </>
        )}
      </div>

      {/* <Button
        type="button"
        variant="ghost"
        disabled={saving}
        onClick={handleClose}
        className="mx-auto flex text-muted-foreground"
      >
        <X className="mr-2 size-4" />
        Tutup
      </Button> */}
    </div>
  );
}