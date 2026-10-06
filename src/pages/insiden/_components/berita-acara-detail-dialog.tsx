import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Printer,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

import BeritaAcaraPreview, {
  type BeritaAcaraData,
} from "./berita-acara-preview.tsx";

type BeritaAcaraDetailDialogProps = {
  baId: string;
  onClose: () => void;
};

type ApiResult = {
  data?: unknown;
  message?: unknown;
};

const API_URL =
  import.meta.env.VITE_API_URL || "";

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function getApiMessage(
  value: unknown,
): string {
  if (
    isRecord(value) &&
    typeof value.message === "string"
  ) {
    return value.message;
  }

  return "Data berita acara gagal dimuat.";
}

function getApiData(
  value: unknown,
): unknown {
  if (
    isRecord(value) &&
    "data" in value
  ) {
    return value.data;
  }

  return value;
}

export default function BeritaAcaraDetailDialog({
  baId,
  onClose,
}: BeritaAcaraDetailDialogProps) {
  const [data, setData] =
    useState<BeritaAcaraData | null>(null);

  const [loading, setLoading] =
    useState<boolean>(true);

  const [error, setError] =
    useState<string>("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function fetchBeritaAcara() {
      if (!baId) {
        setError(
          "ID berita acara tidak tersedia.",
        );
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setData(null);

      try {
        const response = await fetch(
          `${API_URL}/api/insiden/berita-acara/${baId}`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
            signal: controller.signal,
          },
        );

        const json: unknown =
          await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            getApiMessage(json),
          );
        }

        const result =
          json as ApiResult | unknown;

        const beritaAcara =
          getApiData(result);

        if (!isRecord(beritaAcara)) {
          throw new Error(
            "Format data berita acara tidak valid.",
          );
        }

        setData(
          beritaAcara as BeritaAcaraData,
        );
      } catch (cause) {
        if (
          cause instanceof DOMException &&
          cause.name === "AbortError"
        ) {
          return;
        }

        if (cause instanceof Error) {
          setError(cause.message);
        } else {
          setError(
            "Terjadi kesalahan saat mengambil data.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void fetchBeritaAcara();

    return () => {
      controller.abort();
    };
  }, [baId]);

  function handlePrint() {
    if (!data) {
      return;
    }

    const printWindow = window.open(
      "",
      "_blank",
      "width=900,height=700",
    );

    if (!printWindow) {
      window.alert(
        "Jendela cetak diblokir oleh browser.",
      );
      return;
    }

    const previewElement =
      window.document.querySelector(
        "[data-berita-acara-preview]",
      );

    if (!previewElement) {
      printWindow.close();
      window.alert(
        "Preview berita acara belum tersedia.",
      );
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html lang="id">
        <head>
          <meta charset="UTF-8" />
          <title>Berita Acara</title>
          <style>
            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              padding: 20mm;
              color: #000;
              background: #fff;
              font-family: Arial, sans-serif;
              font-size: 12pt;
            }

            @page {
              size: A4;
              margin: 15mm;
            }

            table {
              width: 100%;
              border-collapse: collapse;
            }

            img {
              max-width: 100%;
            }

            @media print {
              body {
                padding: 0;
              }
            }
          </style>
        </head>
        <body>
          ${previewElement.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();

    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Tutup dialog"
        className="fixed inset-0 z-40 cursor-default bg-black/50"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label="Detail berita acara"
        className={
          "fixed right-0 top-0 z-50 flex h-screen " +
          "w-[min(900px,90vw)] flex-col border-l " +
          "bg-background shadow-xl"
        }
      >
        <header
          className={
            "flex shrink-0 items-center justify-between " +
            "border-b bg-background px-4 py-3"
          }
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
          >
            <ArrowLeft className="mr-2 size-4" />
            Tutup
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={!data || loading}
              onClick={handlePrint}
            >
              <Printer className="mr-2 size-4" />
              Cetak
            </Button>

            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Tutup"
              onClick={onClose}
            >
              <X className="size-4" />
            </Button>
          </div>
        </header>

        <main
          className={
            "min-h-0 flex-1 overflow-auto " +
            "bg-muted/50 p-4 sm:p-8"
          }
        >
          <div className="flex justify-center">
            {loading && (
              <div
                className="space-y-4 rounded bg-white p-10 shadow-sm"
                style={{ width: "215mm" }}
              >
                <Skeleton className="mx-auto h-6 w-48" />
                <Skeleton className="mx-auto h-4 w-32" />
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            {!loading && error && (
              <div className="rounded bg-white p-10 text-center text-destructive">
                {error}
              </div>
            )}

            {!loading && !error && data && (
              <div
                data-berita-acara-preview
                className="overflow-hidden rounded bg-white shadow-lg"
              >
                <BeritaAcaraPreview ba={data} />
              </div>
            )}

            {!loading && !error && !data && (
              <div className="rounded bg-white p-10 text-center text-muted-foreground">
                Data berita acara tidak ditemukan.
              </div>
            )}
          </div>
        </main>
      </section>
    </>
  );
}