import { useCallback, useEffect, useMemo, useState } from "react";

type RutePatroli = {
  id: number | string;
  nama_rute?: string | null;
  kode_rute?: string | null;
  site_id?: number | string | null;
  site_nama?: string | null;
  nama_site?: string | null;
  deskripsi?: string | null;
  durasi_menit?: number | null;
  jumlah_checkpoint?: number | null;
  checkpoint_count?: number | null;
  status?: string | null;
};

type RouteTabProps = {
  onTambahRute?: () => void;
  onEditRute?: (rute: RutePatroli) => void;
  onHapusRute?: (rute: RutePatroli) => void;
  onLihatCheckpoint?: (rute: RutePatroli) => void;
};

function ambilArray(data: unknown): RutePatroli[] {
  if (Array.isArray(data)) {
    return data as RutePatroli[];
  }

  if (data && typeof data === "object") {
    const object = data as {
      data?: unknown;
      rows?: unknown;
      rute?: unknown;
    };

    if (Array.isArray(object.data)) {
      return object.data as RutePatroli[];
    }

    if (Array.isArray(object.rows)) {
      return object.rows as RutePatroli[];
    }

    if (Array.isArray(object.rute)) {
      return object.rute as RutePatroli[];
    }
  }

  return [];
}

export default function RouteTab({
  onTambahRute,
  onEditRute,
  onHapusRute,
  onLihatCheckpoint,
}: RouteTabProps) {
  const [rute, setRute] = useState<RutePatroli[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [siteAktif, setSiteAktif] = useState("SEMUA");

  const ambilRute = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const apiUrl =
        import.meta.env.VITE_API_URL || "http://localhost:3000";

      const response = await fetch(
        `${apiUrl}/api/patroli/rute`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      if (!response.ok) {
        const text = await response.text();

        throw new Error(
          `Gagal mengambil data rute. HTTP ${response.status}: ${text.slice(
            0,
            200
          )}`
        );
      }

      const result = await response.json();
      setRute(ambilArray(result));
    } catch (err) {
      console.error("Gagal mengambil rute patroli:", err);

      setRute([]);
      setError(
        err instanceof Error
          ? err.message
          : "Gagal mengambil data rute patroli"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ambilRute();
  }, [ambilRute]);

  const daftarSite = useMemo(() => {
    const sites = rute
      .map(
        (item) =>
          item.site_nama ||
          item.nama_site ||
          (item.site_id ? `Site ${item.site_id}` : null)
      )
      .filter(Boolean) as string[];

    return ["SEMUA", ...Array.from(new Set(sites))];
  }, [rute]);

  const ruteDitampilkan = useMemo(() => {
    if (siteAktif === "SEMUA") {
      return rute;
    }

    return rute.filter((item) => {
      const site =
        item.site_nama ||
        item.nama_site ||
        (item.site_id ? `Site ${item.site_id}` : "");

      return site === siteAktif;
    });
  }, [rute, siteAktif]);

  function jumlahCheckpoint(item: RutePatroli) {
    return (
      item.jumlah_checkpoint ??
      item.checkpoint_count ??
      0
    );
  }

  function namaSite(item: RutePatroli) {
    return (
      item.site_nama ||
      item.nama_site ||
      (item.site_id ? `Site ${item.site_id}` : "-")
    );
  }

  return (
    <section className="w-full space-y-4">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <select
          value={siteAktif}
          onChange={(event) => setSiteAktif(event.target.value)}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none sm:w-64"
        >
          {daftarSite.map((site) => (
            <option key={site} value={site}>
              {site === "SEMUA" ? "Semua Site" : site}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={onTambahRute}
          className="rounded-lg bg-slate-300 px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-white"
        >
          <span className="mr-2">＋</span>
          Tambah Rute
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center text-sm text-slate-400">
          Memuat data rute patroli...
        </div>
      ) : ruteDitampilkan.length === 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-8 text-center">
          <div className="mb-4 text-4xl text-slate-400">⌘</div>

          <h3 className="font-semibold text-white">
            Belum ada rute patroli
          </h3>

          <p className="mt-2 text-sm text-slate-400">
            Buat rute patroli beserta checkpoint-nya untuk mulai
            menjadwalkan patroli.
          </p>

          <button
            type="button"
            onClick={onTambahRute}
            className="mt-5 rounded-lg bg-slate-300 px-4 py-2 text-sm text-slate-900 hover:bg-white"
          >
            Tambah Rute
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {ruteDitampilkan.map((item) => {
            const aktif =
              !item.status ||
              item.status.toUpperCase() === "AKTIF";

            return (
              <article
                key={item.id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {item.nama_rute || "Rute Patroli"}
                    </h3>

                    <span className="mt-3 inline-block rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200">
                      {item.kode_rute || "-"}
                    </span>
                  </div>

                  <span className="rounded-full bg-slate-300 px-3 py-1 text-xs font-medium text-slate-900">
                    {aktif ? "Aktif" : item.status}
                  </span>
                </div>

                <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-300">
                  <span>
                    ⚑ {jumlahCheckpoint(item)} checkpoint
                  </span>

                  <span>
                    ◷ {item.durasi_menit ?? 0} menit
                  </span>
                </div>

                <p className="mt-4 text-sm text-slate-400">
                  {item.deskripsi || namaSite(item)}
                </p>

                <div className="mt-5 flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onLihatCheckpoint?.(item)}
                    className="flex-1 rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
                  >
                    ◉&nbsp; Lihat Checkpoint
                  </button>

                  <button
                    type="button"
                    onClick={() => onEditRute?.(item)}
                    title="Edit rute"
                    className="text-xl text-slate-300 hover:text-white"
                  >
                    ✎
                  </button>

                  <button
                    type="button"
                    onClick={() => onHapusRute?.(item)}
                    title="Hapus rute"
                    className="text-xl text-red-400 hover:text-red-300"
                  >
                    ♧
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}