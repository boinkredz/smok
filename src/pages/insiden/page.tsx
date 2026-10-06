import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import BeritaAcaraList from "./_components/berita-acara-list.tsx";
import LaporanHarianList from "./_components/laporan-harian-list.tsx";

export default function InsidenPage() {
  return (
    <div>
      <PageHeader
        title="Insiden & Laporan"
        description="Pencatatan kejadian insiden dan laporan harian pengamanan."
      />
      <Tabs defaultValue="berita-acara" className="space-y-4">
        <TabsList>
          <TabsTrigger value="berita-acara">Berita Acara</TabsTrigger>
          <TabsTrigger value="laporan-harian">Laporan Harian</TabsTrigger>
        </TabsList>
        <TabsContent value="berita-acara">
          <BeritaAcaraList />
        </TabsContent>
        <TabsContent value="laporan-harian">
          <LaporanHarianList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
