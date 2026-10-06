// src/pages/absensi/_lib/pivot-assignment.ts
import type { AssignmentRow } from "../types/assig.ts";

export type BarisMatriks = {
    officerId: number;
    nama: string;
    shiftPerTanggal: Record<string, { kode: string; shiftId: number | null; assignmentId: number | null }>;
};

export function pivotAssignment(data: AssignmentRow[]): BarisMatriks[] {
    const peta = new Map<number, BarisMatriks>();

    for (const baris of data) {
        if (!peta.has(baris.officerId)) {
            peta.set(baris.officerId, {
                officerId: baris.officerId,
                nama: baris.officer?.nama ?? "-",
                shiftPerTanggal: {},
            });
        }
        const entri = peta.get(baris.officerId)!;
        entri.shiftPerTanggal[baris.tanggal.slice(0, 10)] = {
            kode: baris.shifts?.nama ?? "O",   // ← bergantung jawaban Poin 1
            shiftId: baris.shiftId,
            assignmentId: baris.id,
        };
    }

    return Array.from(peta.values());
}