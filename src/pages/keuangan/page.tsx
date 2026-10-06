import { useState } from "react";
import { Authenticated  } from "@/components/providers/auth";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import PageHeader from "@/components/page-header.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { Button } from "@/components/ui/button.tsx";
import BukuBesarTab from "./_components/buku-besar-tab.tsx";
import KasbonTab from "./_components/kasbon-tab.tsx";
import RekapGajiTab from "./_components/rekap-gaji-tab.tsx";
import PengaturanGajiTab from "./_components/pengaturan-gaji-tab.tsx";
import { useRole } from "@/hooks/use-role.ts";

function periodeLabel(periode: string): string {
  const [year, month] = periode.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return format(d, "MMMM yyyy");
}

function shiftPeriode(periode: string, delta: number): string {
  const [year, month] = periode.split("-").map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function KeuanganPage() {
  const { canManageFinance } = useRole();
  const [tab, setTab] = useState("rekap");
  const todayPeriode = format(new Date(), "yyyy-MM");
  const [periode, setPeriode] = useState(todayPeriode);

  return (
    <Authenticated>
      <div>
        <PageHeader
          title="Arus Kas"
          description="Kelola komponen gaji, kasbon, buku besar, dan rekap penggajian petugas."
        />

        {/* Period navigator */}
        <div className="flex items-center gap-2 mb-4">
          <Button size="icon" variant="secondary" className="size-8" onClick={() => setPeriode(shiftPeriode(periode, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[140px] text-center font-semibold">{periodeLabel(periode)}</span>
          <Button
            size="icon"
            variant="secondary"
            className="size-8"
            onClick={() => setPeriode(shiftPeriode(periode, 1))}
            disabled={periode >= todayPeriode}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap h-auto gap-1">
            <TabsTrigger value="rekap">Slip Gaji</TabsTrigger>
            {canManageFinance && <TabsTrigger value="buku">Buku Besar</TabsTrigger>}
            <TabsTrigger value="kasbon">Kasbon</TabsTrigger>
            {canManageFinance && <TabsTrigger value="pengaturan">Pengaturan Gaji</TabsTrigger>}
          </TabsList>
          <TabsContent value="rekap">
            <RekapGajiTab periode={periode} />
          </TabsContent>
          <TabsContent value="buku">
            <BukuBesarTab periode={periode} />
          </TabsContent>
          <TabsContent value="kasbon">
            <KasbonTab />
          </TabsContent>
          <TabsContent value="pengaturan">
            <PengaturanGajiTab />
          </TabsContent>
        </Tabs>
      </div>
    </Authenticated>
  );
}

