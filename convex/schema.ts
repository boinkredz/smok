import { defineSchema } from "convex/server";
import { users } from "./schema/users";
import { officers } from "./schema/officers";
import { shifts, shiftAssignments, absensi, shiftSwapRequests, cutiRequests, cutiBalance } from "./schema/shifts";
import { rutePatroli, checkpoint, tugasPatroli, checklistPatroli } from "./schema/patroli";
import { sites, siteOfficers } from "./schema/sites";
import { geoFence } from "./schema/geofence";
import { deviceRegistrations } from "./schema/devices";
import { beritaAcara, laporanHarian, baCounter } from "./schema/insiden";
import { masterJabatan, masterLokasiGedung } from "./schema/masterData";
import {
  masterPerlengkapan,
  cekPerlengkapan,
  tindakLanjut,
  serahTerima,
} from "./schema/perlengkapan";
import { gajiKomponen, kasbon, transaksiKeuangan, rekapGaji } from "./schema/keuangan";

export default defineSchema({
  users,
  officers,
  shifts,
  shiftAssignments,
  absensi,
  shiftSwapRequests,
  cutiRequests,
  cutiBalance,
  rutePatroli,
  checkpoint,
  tugasPatroli,
  checklistPatroli,
  sites,
  siteOfficers,
  geoFence,
  deviceRegistrations,
  beritaAcara,
  laporanHarian,
  baCounter,
  masterJabatan,
  masterLokasiGedung,
  masterPerlengkapan,
  cekPerlengkapan,
  tindakLanjut,
  serahTerima,
  gajiKomponen,
  kasbon,
  transaksiKeuangan,
  rekapGaji,
});
