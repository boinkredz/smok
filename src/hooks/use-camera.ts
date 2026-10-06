import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

interface UseCameraOptions {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
}

interface UseCameraResult {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isLoading: boolean;
  error: string | null;
  isDenied: boolean;
  start: () => Promise<void>;
  stop: () => void;
}

export function useCamera(
  options: UseCameraOptions = {},
): UseCameraResult {
  const {
    facingMode = "user",
    width = 640,
    height = 480,
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDenied, setIsDenied] = useState(false);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setStream(null);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Browser tidak mendukung akses kamera.");
      setIsDenied(false);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      setIsDenied(false);

      // Hentikan stream lama jika ada
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode,
            width: {
              ideal: width,
            },
            height: {
              ideal: height,
            },
          },
        });

      streamRef.current = mediaStream;
      setStream(mediaStream);

      const video = videoRef.current;

      if (video) {
        video.srcObject = mediaStream;
        video.muted = true;
        video.playsInline = true;

        await video.play().catch(() => {
          // Beberapa browser menolak play otomatis.
          // Video tetap dapat diputar setelah interaksi user.
        });
      }
    } catch (err) {
      console.error("Camera error:", err);

      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setIsDenied(true);
          setError(
            "Izin kamera ditolak. Izinkan kamera melalui ikon kamera di sebelah alamat website.",
          );
        } else if (err.name === "NotFoundError") {
          setError("Kamera tidak ditemukan pada perangkat ini.");
        } else if (err.name === "NotReadableError") {
          setError(
            "Kamera sedang digunakan oleh aplikasi lain.",
          );
        } else if (err.name === "OverconstrainedError") {
          setError(
            "Kamera tidak mendukung konfigurasi yang diminta.",
          );
        } else {
          setError("Kamera tidak dapat dibuka.");
        }
      } else {
        setError("Kamera tidak dapat dibuka.");
      }

      setStream(null);
    } finally {
      // Bagian ini penting agar tulisan tidak berhenti di
      // "Membuka kamera..."
      setIsLoading(false);
    }
  }, [facingMode, height, width]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    stream,
    isLoading,
    error,
    isDenied,
    start,
    stop,
  };
}