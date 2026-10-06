// assig.ts

export type AbsensiStatus =
  | "hadir"
  | "terlambat"
  | "izin"
  | "sakit"
  | "alpha";

export type AbsensiInfo = {
  status: AbsensiStatus;
  waktuMasuk?: string | null;
  waktuKeluar?: string | null;
  keterlambatanMenit?: number | null;
  keterangan?: string | null;
  fotoMasukUrl?: string | null;
  fotoKeluarUrl?: string | null;
  lokasiMasuk?: {
    lat: number;
    lng: number;
  } | null;
};

export type AssignmentRow = {
  id: number;
  officerId: number;
  shiftId: number | null;
  siteId?: number | null;
  tanggal: string;
  catatan?: string | null;
  shiftNama: string | null;
  jamMulai: string | null;
  jamSelesai: string | null;
  officer: { id: number; nama: string; jabatan: string } | null;
  shifts: { id: number; nama: string; kode: string | null; jamMulai: string; jamSelesai: string; warnaTema?: string | null } | null;
  sites: { id: number; name: string } | null;
  absensi: AbsensiInfo | null;
};