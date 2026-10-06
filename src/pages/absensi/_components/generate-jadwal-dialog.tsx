"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { request } from "@/lib/api";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type ShiftOption = { id: number; nama: string; kode: string | null };
type PreviewRow = { officerId: number; nama: string; tanggal: string; kode: string; shiftId: number | null };
type SavedAssignment = {
    id: number; officerId: number; tanggal: string; shiftId: number | null;
    shifts: { id: number; kode: string | null } | null;
};
type SelCell = { assignmentId: number | null; kode: string; shiftId: number | null };

type Props = { open: boolean; onOpenChange: (open: boolean) => void; bulan: number; tahun: number };

export function GenerateJadwalDialog({ open, onOpenChange, bulan, tahun }: Props) {
    const [memuat, setMemuat] = useState(false);
    const [shiftOptions, setShiftOptions] = useState<ShiftOption[]>([]);
    const [officers, setOfficers] = useState<{ id: number; nama: string }[]>([]);
    const [tanggalList, setTanggalList] = useState<string[]>([]);
    const [matriks, setMatriks] = useState<Map<string, SelCell>>(new Map());
    const [konfirmasiTerbuka, setKonfirmasiTerbuka] = useState(false);
    const [sedangMemproses, setSedangMemproses] = useState(false);
    const [sedangMenyimpanSel, setSedangMenyimpanSel] = useState<string | null>(null);

    const kunciSel = (officerId: number, tanggal: string) => `${officerId}__${tanggal}`;

    async function muatData() {
        setMemuat(true);
        try {
            const akhirBulan = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
            const [shiftRes, previewRes, savedRes] = await Promise.all([
                request<{ data: ShiftOption[] }>("/api/shifts?aktif=true"),
                request<{ data: { rows: PreviewRow[] } }>(
                    `/api/assignments/generate/preview?bulan=${bulan}&tahun=${tahun}`,
                ),
                request<{ data: SavedAssignment[] }>(
                    `/api/assignments?mulai=${tahun}-${String(bulan).padStart(2, "0")}-01&selesai=${tahun}-${String(bulan).padStart(2, "0")}-${akhirBulan}`,
                ),
            ]);

            setShiftOptions(shiftRes.data);

            const petaOfficer = new Map<number, string>();
            const setTanggal = new Set<string>();
            const petaBaru = new Map<string, SelCell>();

            for (const baris of previewRes.data.rows) {
                petaOfficer.set(baris.officerId, baris.nama);
                setTanggal.add(baris.tanggal);
                petaBaru.set(kunciSel(baris.officerId, baris.tanggal), {
                    assignmentId: null, kode: baris.kode, shiftId: baris.shiftId,
                });
            }
            for (const simpan of savedRes.data) {
                const tgl = simpan.tanggal.slice(0, 10);
                petaBaru.set(kunciSel(simpan.officerId, tgl), {
                    assignmentId: simpan.id, kode: simpan.shifts?.kode ?? "-", shiftId: simpan.shiftId,
                });
            }

            setOfficers(Array.from(petaOfficer.entries())
                .map(([id, nama]) => ({ id, nama }))
                .sort((a, b) => a.nama.localeCompare(b.nama)));
            setTanggalList(Array.from(setTanggal).sort());
            setMatriks(petaBaru);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memuat data jadwal.");
        } finally {
            setMemuat(false);
        }
    }

    useEffect(() => { if (open) muatData(); }, [open, bulan, tahun]); // eslint-disable-line react-hooks/exhaustive-deps

    async function eksekusiGenerate() {
        setSedangMemproses(true);
        try {
            const hasil = await request<{ data: { jumlahDibuat: number; jumlahDilewati: number } }>(
                "/api/assignments/generate",
                { method: "POST", body: JSON.stringify({ bulan, tahun }) },
            );
            toast.success(`Berhasil: ${hasil.data.jumlahDibuat} jadwal dibuat, ${hasil.data.jumlahDilewati} dilewati.`);
            setKonfirmasiTerbuka(false);
            await muatData();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal melakukan generate jadwal.");
        } finally {
            setSedangMemproses(false);
        }
    }

    async function ubahSel(officerId: number, tanggal: string, kodeBaru: string) {
        const kunci = kunciSel(officerId, tanggal);
        const selLama = matriks.get(kunci);
        const shiftTerpilih = shiftOptions.find((s) => s.kode === kodeBaru);
        if (!shiftTerpilih) return toast.error("Kode shift tidak dikenali.");

                setSedangMenyimpanSel(kunci);
        try {
            if (selLama?.assignmentId) {
                // Baris sudah tersimpan di basis data — perbarui via PATCH
                await request(`/api/assignments/${selLama.assignmentId}`, {
                    method: "PATCH",
                    body: JSON.stringify({ shiftId: shiftTerpilih.id }),
                });
                setMatriks((prev) => {
                    const next = new Map(prev);
                    next.set(kunci, { assignmentId: selLama.assignmentId, kode: kodeBaru, shiftId: shiftTerpilih.id });
                    return next;
                });
            } else {
                // Baris masih murni hasil pratinjau — buat baru via POST
                const hasil = await request<{ data: { id: number } }>("/api/assignments", {
                    method: "POST",
                    body: JSON.stringify({ officerId, shiftId: shiftTerpilih.id, tanggal }),
                });
                setMatriks((prev) => {
                    const next = new Map(prev);
                    next.set(kunci, { assignmentId: hasil.data.id, kode: kodeBaru, shiftId: shiftTerpilih.id });
                    return next;
                });
            }
            toast.success("Sel berhasil diperbarui.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Gagal memperbarui sel.");
        } finally {
            setSedangMenyimpanSel(null);
        }
    }

       const formatTanggalHeader = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
    };

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange} modal={false}>  
                <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                    <DialogHeader>
                        <DialogTitle>
                            Matriks Jadwal — {String(bulan).padStart(2, "0")}/{tahun}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-auto border rounded-md">
                        {memuat ? (
                            <div className="p-6 text-center text-sm text-muted-foreground">Memuat data...</div>
                        ) : (
                            <table className="min-w-full text-xs border-collapse">
                                <thead className="sticky top-0 bg-background z-10">
                                    <tr>
                                        <th className="border px-2 py-1 text-left sticky left-0 bg-background z-20 min-w-[140px]">
                                            Nama Petugas
                                        </th>
                                        {tanggalList.map((tgl) => (
                                            <th key={tgl} className="border px-1 py-1 text-center min-w-[70px]">
                                                {formatTanggalHeader(tgl)}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {officers.map((officer) => (
                                        <tr key={officer.id}>
                                            <td className="border px-2 py-1 sticky left-0 bg-background z-10 font-medium">
                                                {officer.nama}
                                            </td>
                                            {tanggalList.map((tgl) => {
                                                const kunci = kunciSel(officer.id, tgl);
                                                const sel = matriks.get(kunci);
                                                const sedangMenyimpan = sedangMenyimpanSel === kunci;
                                                return (
                                                    <td key={kunci} className="border px-1 py-1 text-center">
                                                        <Select
    value={sel?.kode ?? "-"}
    onValueChange={(value) => ubahSel(officer.id, tgl, value)}
    disabled={sedangMenyimpan}
    modal={false}
>
    <SelectTrigger className="h-7 w-full text-xs px-1">
        <SelectValue />
    </SelectTrigger>
    <SelectContent>
        <SelectItem value="-">-</SelectItem>
        <SelectItem value="O">O (Libur)</SelectItem>
        {shiftOptions.map((shift) => (
            <SelectItem key={shift.id} value={shift.kode ?? ""}>
                {shift.kode}
            </SelectItem>
        ))}
    </SelectContent>
</Select>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>

                    <DialogFooter className="flex items-center justify-between sm:justify-between">
                        <p className="text-xs text-muted-foreground">
                            Total petugas: {officers.length} — Total hari: {tanggalList.length}
                        </p>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>Tutup</Button>
                            <Button variant="default" onClick={() => setKonfirmasiTerbuka(true)} disabled={memuat}>
                                Generate Otomatis
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={konfirmasiTerbuka} onOpenChange={setKonfirmasiTerbuka}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Konfirmasi Generate Jadwal</AlertDialogTitle>
                        <AlertDialogDescription>
                            Tindakan ini akan membuat atau menimpa jadwal untuk seluruh petugas aktif
                            pada periode {String(bulan).padStart(2, "0")}/{tahun} berdasarkan pola rotasi
                            regu masing-masing. Sel yang telah disunting secara manual dapat ikut tertimpa.
                            Tindakan ini tidak dapat dibatalkan.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={sedangMemproses}>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={eksekusiGenerate} disabled={sedangMemproses}>
                            {sedangMemproses ? "Memproses..." : "Ya, Lanjutkan Generate"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}