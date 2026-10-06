import { useEffect, useState } from "react";
import type { ComponentProps } from "react";
import {
  Printer,
  FileText,
  ArrowLeft,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { toast } from "sonner";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";

import LaporanHarianPreview from "./laporan-harian-preview.tsx";
import { buildLaporanHarianHtml } from "../_lib/laporan-harian-html.ts";

type LaporanHarian = ComponentProps<
  typeof LaporanHarianPreview
>["laporan"];

type Props = {
  laporanId: number;
  onClose: () => void;
};

type RecordData = Record<string, unknown>;

function isRecord(
  value: unknown,
): value is RecordData {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function isLaporanHarian(
  value: unknown,
): value is LaporanHarian {
  if (!isRecord(value)) {
    return false;
  }

  return (
    "id" in value &&
    "tanggal" in value &&
    "shift" in value &&
    typeof value.id === "number"
  );
}

function getErrorMessage(
  value: unknown,
): string | null {
  if (
    isRecord(value) &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return null;
}

function extractLaporan(
  result: unknown,
): LaporanHarian | null {
  if (!isRecord(result)) {
    return null;
  }

  if ("data" in result) {
    return isLaporanHarian(result.data)
      ? result.data
      : null;
  }

  return isLaporanHarian(result)
    ? result
    : null;
}

export default function LaporanHarianDetailPanel({
  laporanId,
  onClose,
}: Props) {
  const [laporan, setLaporan] =
    useState<LaporanHarian | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [exporting, setExporting] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchLaporan() {
      setLoading(true);
      setError(null);
      setLaporan(null);

      try {
        const response = await fetch(
          `/api/laporan-harian/${laporanId}`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const result: unknown =
          await response.json().catch(() => null);

        if (!response.ok) {
          const message =
            getErrorMessage(result) ??
            "Gagal mengambil detail laporan harian.";

          throw new Error(message);
        }

        const data = extractLaporan(result);

        if (!data) {
          throw new Error(
            "Data laporan harian tidak ditemukan.",
          );
        }

        setLaporan(data);
      } catch (err) {
        if (
          err instanceof DOMException &&
          err.name === "AbortError"
        ) {
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : "Gagal mengambil laporan harian.";

        setError(message);
        toast.error(message);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchLaporan();

    return () => {
      controller.abort();
    };
  }, [laporanId]);

  function handlePrint() {
    if (!laporan) {
      return;
    }

    const html = buildLaporanHarianHtml(laporan);
    const printWindow = window.open(
      "",
      "_blank",
    );

    if (!printWindow) {
      toast.error(
        "Popup diblokir oleh browser.",
      );
      return;
    }

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 800);
  }

  async function handleDownloadWord() {
    if (!laporan) {
      return;
    }

    setExporting(true);

    try {
      const {
        Document,
        Packer,
        Paragraph,
        TextRun,
        AlignmentType,
      } = await import("docx");

      const tanggal = format(
        new Date(laporan.tanggal),
        "d MMMM yyyy",
        {
          locale: localeId,
        },
      );

      const wordDocument = new Document({
        sections: [
          {
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "LAPORAN HARIAN PROJECT",
                    bold: true,
                    size: 26,
                  }),
                ],
              }),

              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text:
                      "PENGECEKAN KINERJA PENGAMANAN",
                    size: 18,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun(
                    `Tanggal: ${tanggal}`,
                  ),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun(
                    `Shift: ${laporan.shift}`,
                  ),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun(
                    `Dibuat oleh: ${
                      laporan.namaPembuat
                    } — ${
                      laporan.jabatanPembuat
                    }`,
                  ),
                ],
              }),

              new Paragraph({
                text: "",
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text:
                      "Silakan gunakan versi cetak " +
                      "untuk tampilan laporan lengkap.",
                  }),
                ],
              }),
            ],
          },
        ],
      });

      const blob =
        await Packer.toBlob(wordDocument);

      const url =
        URL.createObjectURL(blob);

      const anchor =
        window.document.createElement("a");

      anchor.href = url;
      anchor.download =
        `Laporan-Harian-${laporan.tanggal}-` +
        `${laporan.shift}.docx`;

      window.document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Gagal membuat dokumen Word.",
      );
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />

      <div
        className={
          "fixed right-0 top-0 z-50 flex h-screen " +
          "flex-col border-l bg-background shadow-xl"
        }
        style={{
          width: "min(900px, 90vw)",
        }}
      >
        <div
          className={
            "flex shrink-0 items-center " +
            "justify-between gap-2 border-b " +
            "bg-background px-4 py-3"
          }
        >
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="gap-1.5"
          >
            <ArrowLeft className="size-4" />
            Tutup
          </Button>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
              disabled={!laporan || loading}
            >
              <Printer className="mr-1.5 size-4" />

              <span className="hidden sm:inline">
                Cetak / Simpan PDF
              </span>

              <span className="sm:hidden">
                PDF
              </span>
            </Button>

            <Button
              size="sm"
              variant="secondary"
              onClick={handleDownloadWord}
              disabled={
                !laporan ||
                loading ||
                exporting
              }
            >
              <FileText className="mr-1.5 size-4" />

              {exporting
                ? "Memproses..."
                : "Word"}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>

        <div
          className={
            "min-h-0 flex-1 overflow-auto " +
            "bg-muted/50 p-4 sm:p-8"
          }
        >
          <div className="flex justify-center">
            {loading ? (
              <div
                className={
                  "space-y-4 rounded bg-white " +
                  "p-10 shadow-sm"
                }
                style={{
                  width: "215mm",
                }}
              >
                <Skeleton className="mx-auto h-6 w-48" />
                <Skeleton className="mx-auto h-4 w-32" />
                <Skeleton className="mt-4 h-40 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : error ? (
              <div
                className={
                  "rounded bg-white p-10 " +
                  "text-center text-destructive"
                }
              >
                {error}
              </div>
            ) : laporan ? (
              <div className="overflow-hidden rounded shadow-lg">
                <LaporanHarianPreview
                  laporan={laporan}
                />
              </div>
            ) : (
              <div className="rounded bg-white p-10 text-center">
                Laporan tidak ditemukan.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}