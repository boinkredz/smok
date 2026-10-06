import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Camera,
  CheckCircle2,
  MapPin,
  RefreshCw,
} from "lucide-react";

import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

import { Button } from "@/components/ui/button";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

type CaptureMode = "masuk" | "keluar";

type Props = {
  mode: CaptureMode;
  tanggal: string;
  onSuccess: () => void;
  onCancel: () => void;
};

type LocationData = {
  lat: number;
  lng: number;
};

type AttendanceData = {
  id?: number;
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  fotoMasukUrl?: string | null;
  fotoKeluarUrl?: string | null;
};

type ApiResponse = {
  status?: string;
  message?: string;
  attendance?: AttendanceData;
};

type Step =
  | "location"
  | "camera"
  | "uploading"
  | "success";

function getPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  });
}

async function readResponse(
  response: Response,
): Promise<ApiResponse> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await response.json()) as ApiResponse;
  }

  const text = await response.text();

  return {
    message:
      text || `Request gagal (${response.status})`,
  };
}

function getErrorMessage(error: unknown): string {
  if (
    error instanceof DOMException &&
    error.name === "AbortError"
  ) {
    return "Request timeout. Server tidak merespons dalam 30 detik.";
  }

  if (error instanceof TypeError) {
    return "Tidak dapat terhubung ke server. Pastikan backend berjalan di port 3000.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Absensi gagal diproses.";
}

export default function AbsensiCapture({
  mode,
  tanggal,
  onSuccess,
  onCancel,
}: Props) {
  const videoRef =
    useRef<HTMLVideoElement | null>(null);

  const streamRef =
    useRef<MediaStream | null>(null);

  const [step, setStep] =
    useState<Step>("location");

  const [location, setLocation] =
    useState<LocationData | null>(null);

  const [loadingLocation, setLoadingLocation] =
    useState(false);

  const [loadingCamera, setLoadingCamera] =
    useState(false);

  const [cameraReady, setCameraReady] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [savedAttendance, setSavedAttendance] =
    useState<AttendanceData | null>(null);

  function stopCamera() {
    const stream = streamRef.current;

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
    }

    streamRef.current = null;
    setCameraReady(false);

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }
  }

  async function requestLocation() {
    setLoadingLocation(true);
    setErrorMessage(null);

    try {
      if (!navigator.geolocation) {
        throw new Error(
          "Browser tidak mendukung akses lokasi.",
        );
      }

      const position = await getPosition();

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      if (
        !Number.isFinite(lat) ||
        !Number.isFinite(lng)
      ) {
        throw new Error(
          "Koordinat lokasi tidak valid.",
        );
      }

      setLocation({ lat, lng });
      setStep("camera");
    } catch (error) {
      if (
        error instanceof GeolocationPositionError
      ) {
        if (error.code === 1) {
          setErrorMessage(
            "Izin lokasi ditolak. Izinkan akses lokasi dari browser.",
          );
        } else if (error.code === 2) {
          setErrorMessage(
            "Lokasi tidak tersedia. Aktifkan GPS lalu coba lagi.",
          );
        } else {
          setErrorMessage(
            "Waktu mendapatkan lokasi habis. Coba lagi.",
          );
        }
      } else {
        setErrorMessage(getErrorMessage(error));
      }
    } finally {
      setLoadingLocation(false);
    }
  }

  async function openCamera() {
    setLoadingCamera(true);
    setErrorMessage(null);

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        });

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error(
          "Komponen video belum siap.",
        );
      }

      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;

      await video.play();
      setCameraReady(true);
    } catch {
      setErrorMessage(
        "Kamera tidak dapat dibuka. Pastikan izin kamera sudah diberikan.",
      );
      setStep("location");
      stopCamera();
    } finally {
      setLoadingCamera(false);
    }
  }

  useEffect(() => {
    if (step === "camera") {
      void openCamera();
    }

    return () => {
      if (step !== "camera") {
        stopCamera();
      }
    };
  }, [step]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  async function createPhoto(): Promise<Blob> {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0) {
      throw new Error(
        "Kamera belum siap. Tunggu beberapa detik lalu coba lagi.",
      );
    }

    const canvas = document.createElement("canvas");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Canvas tidak tersedia.");
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

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(
              new Error("Gagal membuat file foto."),
            );
          } else {
            resolve(blob);
          }
        },
        "image/jpeg",
        0.85,
      );
    });
  }

  async function submitAttendance() {
    if (!location) {
      setErrorMessage("Lokasi belum tersedia.");
      return;
    }

    if (!cameraReady) {
      setErrorMessage("Kamera belum siap.");
      return;
    }

    setStep("uploading");
    setErrorMessage(null);

    const controller = new AbortController();

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 30000);

    try {
      const photoBlob = await createPhoto();
      const formData = new FormData();

      formData.append(
        "foto",
        photoBlob,
        `absensi-${mode}-${tanggal}.jpg`,
      );

      formData.append(
        "latitude",
        String(location.lat),
      );

      formData.append(
        "longitude",
        String(location.lng),
      );

      formData.append("tanggal", tanggal);

      const endpoint =
        mode === "masuk"
          ? "/api/absensi/check-in"
          : "/api/absensi/check-out";

      const response = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "POST",
          credentials: "include",
          body: formData,
          signal: controller.signal,
        },
      );

      const result = await readResponse(response);

      if (!response.ok) {
        throw new Error(
          result.message ??
            `Absensi gagal (${response.status}).`,
        );
      }

      setSavedAttendance(
        result.attendance ?? null,
      );

      stopCamera();
      setStep("success");
    } catch (error) {
      stopCamera();
      setErrorMessage(getErrorMessage(error));
      setStep("location");
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function goBack() {
    stopCamera();
    setErrorMessage(null);
    setStep("location");
  }

  const displayDate = new Date(
    `${tanggal}T12:00:00`,
  );

  const photoUrl =
    mode === "masuk"
      ? savedAttendance?.fotoMasukUrl
      : savedAttendance?.fotoKeluarUrl;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <h2 className="font-semibold">
          Absen{" "}
          {mode === "masuk" ? "Masuk" : "Keluar"} —{" "}
          {format(
            displayDate,
            "EEEE, d MMMM yyyy",
            { locale: idLocale },
          )}
        </h2>
      </div>

      {errorMessage && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-300">
          <AlertCircle className="size-4" />
          <span>{errorMessage}</span>
        </div>
      )}

      {step === "location" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4">
            <div className="flex items-center gap-2 font-medium">
              <MapPin className="size-5 text-primary" />
              Verifikasi Lokasi
            </div>

            <p className="mt-2 text-sm text-muted-foreground">
              Sistem membutuhkan lokasi GPS untuk memverifikasi absensi Anda.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => void requestLocation()}
            disabled={loadingLocation}
          >
            <MapPin className="mr-2 size-4" />
            {loadingLocation
              ? "Mendapatkan lokasi..."
              : "Izinkan Akses Lokasi"}
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={onCancel}
          >
            Batal
          </Button>
        </div>
      )}

      {step === "camera" && (
        <div className="space-y-4">
          <div className="relative mx-auto aspect-square max-w-sm overflow-hidden rounded-xl bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full scale-x-[-1] object-cover"
            />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
                {loadingCamera
                  ? "Membuka kamera..."
                  : "Menyiapkan kamera..."}
              </div>
            )}
          </div>

          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={() => void submitAttendance()}
            disabled={!cameraReady || loadingCamera}
          >
            <Camera className="mr-2 size-4" />
            Ambil Foto & Absen
          </Button>

          <Button
            variant="ghost"
            className="w-full"
            onClick={goBack}
          >
            Kembali
          </Button>
        </div>
      )}

      {step === "uploading" && (
        <div className="flex flex-col items-center gap-4 py-12">
          <RefreshCw className="size-9 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Mengupload foto dan menyimpan absensi...
          </p>
        </div>
      )}

      {step === "success" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <CheckCircle2 className="size-12 text-green-500" />

          <p className="font-semibold">
            Absensi berhasil disimpan.
          </p>

          {photoUrl && (
            <div className="text-center">
              <p className="mb-2 text-sm font-medium">
                Foto Selfie Absen{" "}
                {mode === "masuk"
                  ? "Masuk"
                  : "Keluar"}
              </p>

              <img
                src={`${API_URL}${photoUrl}`}
                alt={`Foto selfie absen ${mode}`}
                className="mx-auto h-48 w-48 rounded-xl object-cover shadow-md"
              />
            </div>
          )}

          <Button
            className="w-full"
            onClick={onSuccess}
          >
            Selesai
          </Button>
        </div>
      )}
    </div>
  );
}