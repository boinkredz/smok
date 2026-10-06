/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as cuti from "../cuti.js";
import type * as dashboard from "../dashboard.js";
import type * as devices from "../devices.js";
import type * as geofence from "../geofence.js";
import type * as insiden from "../insiden.js";
import type * as keuangan from "../keuangan.js";
import type * as lib_auth from "../lib/auth.js";
import type * as masterData from "../masterData.js";
import type * as migrations from "../migrations.js";
import type * as officers from "../officers.js";
import type * as patroli from "../patroli.js";
import type * as perlengkapan from "../perlengkapan.js";
import type * as schema_devices from "../schema/devices.js";
import type * as schema_geofence from "../schema/geofence.js";
import type * as schema_insiden from "../schema/insiden.js";
import type * as schema_keuangan from "../schema/keuangan.js";
import type * as schema_masterData from "../schema/masterData.js";
import type * as schema_officers from "../schema/officers.js";
import type * as schema_patroli from "../schema/patroli.js";
import type * as schema_perlengkapan from "../schema/perlengkapan.js";
import type * as schema_shifts from "../schema/shifts.js";
import type * as schema_sites from "../schema/sites.js";
import type * as schema_users from "../schema/users.js";
import type * as selfAbsensi from "../selfAbsensi.js";
import type * as shifts from "../shifts.js";
import type * as sites from "../sites.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  cuti: typeof cuti;
  dashboard: typeof dashboard;
  devices: typeof devices;
  geofence: typeof geofence;
  insiden: typeof insiden;
  keuangan: typeof keuangan;
  "lib/auth": typeof lib_auth;
  masterData: typeof masterData;
  migrations: typeof migrations;
  officers: typeof officers;
  patroli: typeof patroli;
  perlengkapan: typeof perlengkapan;
  "schema/devices": typeof schema_devices;
  "schema/geofence": typeof schema_geofence;
  "schema/insiden": typeof schema_insiden;
  "schema/keuangan": typeof schema_keuangan;
  "schema/masterData": typeof schema_masterData;
  "schema/officers": typeof schema_officers;
  "schema/patroli": typeof schema_patroli;
  "schema/perlengkapan": typeof schema_perlengkapan;
  "schema/shifts": typeof schema_shifts;
  "schema/sites": typeof schema_sites;
  "schema/users": typeof schema_users;
  selfAbsensi: typeof selfAbsensi;
  shifts: typeof shifts;
  sites: typeof sites;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
