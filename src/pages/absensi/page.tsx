import { useState } from "react";
import { Authenticated  } from "@/components/providers/auth";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import JadwalHarianTab from "./_components/jadwal-harian-tab.tsx";
import JadwalKalenderTab from "./_components/jadwal-kalender-tab.tsx";
import RekapAbsensiTab from "./_components/rekap-absensi-tab.tsx";
import ShiftTemplatesTab from "./_components/shift-templates-tab.tsx";
import TukarShiftTab from "./_components/tukar-shift-tab.tsx";
import CutiIzinTab from "./_components/cuti-izin-tab.tsx";

export default function AbsensiPage() {
  const [tab, setTab] = useState("harian");

  return (
    <Authenticated>
      <div>
        <PageHeader
          title="Jadwal Shift"
          description="Kelola jadwal shift, kalender penugasan, tukar shift, cuti & absensi."
        />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="harian">Jadwal Harian</TabsTrigger>
            <TabsTrigger value="kalender">Kalender</TabsTrigger>
            <TabsTrigger value="cuti">Cuti & Sakit</TabsTrigger>
            <TabsTrigger value="tukar">Tukar Shift</TabsTrigger>
            <TabsTrigger value="rekap">Rekap Absensi</TabsTrigger>
            <TabsTrigger value="shift">Template Shift</TabsTrigger>
          </TabsList>
          <TabsContent value="harian">
            <JadwalHarianTab />
          </TabsContent>
          <TabsContent value="kalender">
            <JadwalKalenderTab />
          </TabsContent>
          <TabsContent value="cuti">
            <CutiIzinTab />
          </TabsContent>
          <TabsContent value="tukar">
            <TukarShiftTab />
          </TabsContent>
          <TabsContent value="rekap">
            <RekapAbsensiTab />
          </TabsContent>
          <TabsContent value="shift">
            <ShiftTemplatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </Authenticated>
  );
}

