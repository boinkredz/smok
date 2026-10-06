import { useState } from "react";
import { Authenticated  } from "@/components/providers/auth";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import PenugasanTab from "./_components/penugasan-tab.tsx";
import RuteTab from "./_components/rute-tab.tsx";
import CheckpointTab from "./_components/checkpoint-tab.tsx";
import MonitoringTab from "./_components/monitoring-tab.tsx";

export default function PatroliPage() {
  const [tab, setTab] = useState("penugasan");
  return (
    <Authenticated>
      <div>
        <PageHeader title="Patroli & Tugas" description="Rute patroli, penugasan, dan laporan hasil patroli petugas keamanan." />
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="penugasan">Penugasan</TabsTrigger>
            <TabsTrigger value="rute">Rute Patroli</TabsTrigger>
            <TabsTrigger value="checkpoint">Checkpoint</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          </TabsList>
          <TabsContent value="penugasan"><PenugasanTab /></TabsContent>
          <TabsContent value="rute"><RuteTab onLihatCheckpoint={() => setTab("checkpoint")} /></TabsContent>
          <TabsContent value="checkpoint"><CheckpointTab /></TabsContent>
          <TabsContent value="monitoring">
            <MonitoringTab />
          </TabsContent>
        </Tabs>
      </div>
    </Authenticated>
  );
}

