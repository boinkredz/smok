import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Authenticated, Unauthenticated  } from "@/components/providers/auth";
import { SignInButton } from "@/components/ui/signin.tsx";
import MasterPerlengkapan from "./_components/master-perlengkapan.tsx";
import ChecklistShift from "./_components/checklist-shift.tsx";
import RiwayatTracking from "./_components/riwayat-tracking.tsx";
import SerahTerima from "./_components/serah-terima.tsx";

export default function PerlengkapanPage() {
  return (
    <div>
      <PageHeader
        title="Perlengkapan Kerja"
        description="Pengecekan kelengkapan peralatan petugas per shift dan serah terima."
      />
      <Unauthenticated>
        <div className="flex items-center justify-center py-12">
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <Tabs defaultValue="checklist" className="space-y-4">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="checklist">Checklist Shift</TabsTrigger>
            <TabsTrigger value="serah-terima">Serah Terima</TabsTrigger>
            <TabsTrigger value="riwayat">Riwayat & Tindak Lanjut</TabsTrigger>
            <TabsTrigger value="master">Master Alat</TabsTrigger>
          </TabsList>
          <TabsContent value="checklist">
            <ChecklistShift />
          </TabsContent>
          <TabsContent value="serah-terima">
            <SerahTerima />
          </TabsContent>
          <TabsContent value="riwayat">
            <RiwayatTracking siteId={null} />
          </TabsContent>
          <TabsContent value="master">
            <MasterPerlengkapan />
          </TabsContent>
        </Tabs>
      </Authenticated>
    </div>
  );
}

