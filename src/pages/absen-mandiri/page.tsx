import {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  CalendarDays,
  Camera,
  Clock3,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import PageHeader from "@/components/page-header.tsx";
import { Button } from "@/components/ui/button";
import AbsensiCapture from "./_components/absensi-capture";
import FaceEnrollment from "./_components/face-enrollment";
import { formatTimeJakarta } from "../../utils/datetime";

const API_URL = (
  import.meta.env.VITE_API_URL ??
  "http://localhost:3000"
).replace(/\/$/, "");

type FaceStatus = {
  isEnrolled: boolean;
  facePhotoUrl?: string | null;
  faceEnrolledAt?: string | null;
};

type Attendance = {
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  fotoMasukUrl?: string | null;
  fotoKeluarUrl?: string | null;
};

type Assignment = {
  id: number;
  tanggal: string;
  shiftNama: string;
  lokasi: string | null;
  status?: string | null;
  attendance?: Attendance | null;
  absensi?: Attendance | null;
};

type CaptureMode = "masuk" | "keluar";

function getTodayJakarta(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getFileUrl(
  value?: string | null,
): string | null {
  if (!value) return null;

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value;
  }

  return `${API_URL}${
    value.startsWith("/") ? "" : "/"
  }${value}`;
}

function getAttendance(
  assignment: Assignment,
): Attendance {
  return (
    assignment.attendance ??
    assignment.absensi ??
    {}
  );
}

function parseDate(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00`);
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? new Date()
    : date;
}

function AttendancePhoto({
  label,
  url,
}: {
  label: string;
  url?: string | null;
}) {
  const imageUrl = getFileUrl(url);

  return (
    <div>
      <p className="mb-2 text-sm text-muted-foreground">
        {label}
      </p>

      {imageUrl ? (
        <img
          src={imageUrl}
          alt={label}
          className="h-50 w-50 rounded-lg border object-cover mx-auto flex items-center justify-center rounded-xl"
        />
      ) : (
        <div className="flex h-50 w-50 mx-auto flex items-center justify-center rounded-lg border bg-muted text-sm text-muted-foreground">
          Belum ada foto
        </div>
      )}
    </div>
  );
}

export default function AbsenMandiriPage() {
  const [tanggal, setTanggal] = useState(
    getTodayJakarta(),
  );

  const [faceStatus, setFaceStatus] =
    useState<FaceStatus | null>(null);

  const [assignment, setAssignment] =
    useState<Assignment | null>(null);

  const [loadingFace, setLoadingFace] =
    useState(true);

  const [loadingAssignment, setLoadingAssignment] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const [captureMode, setCaptureMode] =
    useState<CaptureMode | null>(null);

  const [showEnrollment, setShowEnrollment] =
    useState(false);

  const loadFaceStatus = useCallback(async () => {
    try {
      setLoadingFace(true);

      const response = await fetch(
        `${API_URL}/api/absensi/face-status`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Gagal membaca status foto profil.",
        );
      }

      setFaceStatus(result.officer ?? result);
    } catch (error) {
      console.error(error);
      setFaceStatus(null);
    } finally {
      setLoadingFace(false);
    }
  }, []);

  const loadAssignment = useCallback(async () => {
    try {
      setLoadingAssignment(true);
      setErrorMessage(null);

      const response = await fetch(
        `${API_URL}/api/absensi/me/today-assignment?tanggal=${encodeURIComponent(
          tanggal,
        )}`,
        {
          method: "GET",
          credentials: "include",
        },
      );

      const result = await response.json();

      if (response.status === 404) {
        setAssignment(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          result.message ??
            "Gagal mengambil data penugasan.",
        );
      }

      setAssignment(result.assignment ?? null);
    } catch (error) {
      setAssignment(null);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Tidak dapat terhubung ke server.",
      );
    } finally {
      setLoadingAssignment(false);
    }
  }, [tanggal]);

  useEffect(() => {
    void loadFaceStatus();
  }, [loadFaceStatus]);

  useEffect(() => {
    void loadAssignment();
  }, [loadAssignment]);

  const isEnrolled =
    faceStatus?.isEnrolled === true ||
    Boolean(faceStatus?.facePhotoUrl);

  const profilePhotoUrl = getFileUrl(
    faceStatus?.facePhotoUrl,
  );

  const attendance = assignment
    ? getAttendance(assignment)
    : null;

  if (captureMode) {
    return (
      <main className="min-h-full p-6">
        <div className="mx-auto max-w-xl rounded-xl border bg-card p-5">
          <AbsensiCapture
            mode={captureMode}
            tanggal={tanggal}
            onSuccess={() => {
              setCaptureMode(null);
              void loadAssignment();
            }}
            onCancel={() => setCaptureMode(null)}
          />
        </div>
      </main>
    );
  }

  return (
      
    <main className="space-y-6">
      
        <PageHeader
        title="Absen Mandiri"
        description="Absensi masuk dan keluar menggunakan foto selfie serta verifikasi lokasi."
        
      />
      
      <section className="mb-4 rounded-xl border bg-card p-5 text-center shadow-sm">
        <h2 className="mb-4 text-lg font-bold">
          Foto Profil
        </h2>

        {loadingFace ? (
          <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border text-sm text-muted-foreground">
            Memuat foto...
          </div>
        ) : profilePhotoUrl ? (
          <>
            <img
              src={profilePhotoUrl}
              alt="Foto profil"
              className="mx-auto h-48 w-48 rounded-xl border object-cover"
            />

            {/* <p className="mt-3 font-semibold text-green-500">
              Foto profil sudah tersimpan
            </p> */}

            <Button
              variant="outline"
              className="mt-4"
              onClick={() => setShowEnrollment(true)}
            >
              <Camera className="mr-2 size-4" />
              Ganti Foto Profil
            </Button>
          </>
        ) : (
          <>
            <div className="mx-auto flex h-48 w-48 items-center justify-center rounded-xl border bg-muted">
              <Camera className="size-12 text-muted-foreground" />
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 text-yellow-500">
              <ShieldAlert className="size-5" />
              Foto profil belum tersedia
            </div>

            <Button
              className="mt-4"
              onClick={() => setShowEnrollment(true)}
            >
              <Camera className="mr-2 size-4" />
              Ambil Foto Profil
            </Button>
          </>
        )}

        {showEnrollment && (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-labelledby="face-enrollment-title"
    onMouseDown={() => setShowEnrollment(false)}
  >
    <div
      className="relative max-h-[95vh] w-full max-w-lg overflow-y-auto rounded-2xl border bg-card p-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        aria-label="Tutup"
        onClick={() => setShowEnrollment(false)}
        className="absolute right-4 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-destructive hover:text-white"
      >
        <X className="size-5" />
      </button>

      <div id="face-enrollment-title">
        <FaceEnrollment
          onEnrolled={() => {
            setShowEnrollment(false);
            void loadFaceStatus();
          }}
        />
      </div>
    </div>
  </div>
)}
      </section>

      <section className="mb-4 rounded-xl border bg-card p-5">
        <label
          htmlFor="tanggal-absensi"
          className="mb-2 flex items-center gap-2 text-sm font-medium"
        >
          <CalendarDays className="size-4" />
          Tanggal Absensi
        </label>

        <input
          id="tanggal-absensi"
          type="date"
          value={tanggal}
          onChange={(event) =>
            setTanggal(event.target.value)
          }
          className="h-10 w-full rounded-md border bg-background px-3"
        />
      </section>

      {loadingAssignment && (
        <section className="rounded-xl border p-6 text-center text-muted-foreground">
          Memuat data penugasan...
        </section>
      )}

      {!loadingAssignment && errorMessage && (
        <section className="rounded-xl border border-destructive/50 bg-destructive/10 p-5 text-destructive">
          {errorMessage}
        </section>
      )}

      {!loadingAssignment &&
        !errorMessage &&
        !assignment && (
          <section className="rounded-xl border p-6 text-center text-muted-foreground">
            Tidak ada jadwal shift pada tanggal ini.
          </section>
        )}

      {!loadingAssignment && assignment && (
        <div className="space-y-4">
          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">
              Detail Penugasan
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">
                  Tanggal
                </p>
                <p className="font-semibold">
                  {format(
                    parseDate(assignment.tanggal),
                    "EEEE, d MMMM yyyy",
                    { locale: idLocale },
                  )}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Shift
                </p>
                <p className="font-semibold">
                  {assignment.shiftNama}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Lokasi
                </p>
                <p className="flex items-center gap-1 font-semibold">
                  <MapPin className="size-4 text-primary" />
                  {assignment.lokasi ?? "-"}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">
                  Status
                </p>
                <p className="font-semibold">
                  {assignment.status ?? "Belum diproses"}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <Clock3 className="size-5 text-primary" />
              Waktu Absensi
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-green-950/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Jam Masuk
                </p>
                <p className="mt-2 text-xl font-bold text-green-400">
                  {formatTimeJakarta(
                    attendance?.waktuMasuk,
                  )}
                </p>
              </div>

              <div className="rounded-lg border bg-orange-950/30 p-4">
                <p className="text-sm text-muted-foreground">
                  Jam Keluar
                </p>
                <p className="mt-2 text-xl font-bold text-orange-400">
                  {formatTimeJakarta(
                    attendance?.waktuKeluar,
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            <h2 className="mb-4 text-lg font-bold">
              Foto Absensi
            </h2>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-center">
              <AttendancePhoto
                label="Foto Absen Masuk"
                url={attendance?.fotoMasukUrl}
              />
  
              <AttendancePhoto
                label="Foto Absen Keluar"
                url={attendance?.fotoKeluarUrl}
              />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-5">
            {!isEnrolled && (
              <p className="mb-3 text-sm text-yellow-500">
                Ambil foto profil terlebih dahulu.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                disabled={!isEnrolled}
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setCaptureMode("masuk")}
              >
                <Camera className="mr-2 size-4" />
                Absen Masuk
              </Button>

              <Button
                disabled={!isEnrolled}
                variant="outline"
                onClick={() => setCaptureMode("keluar")}
              >
                Absen Keluar
              </Button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
