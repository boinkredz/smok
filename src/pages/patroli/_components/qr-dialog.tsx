import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Printer } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

type CheckpointQrData = {
  nama: string;
  qrCode: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  checkpoint: CheckpointQrData | null;
};

export default function QrDialog({
  open,
  onClose,
  checkpoint,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function generateQrCode() {
      if (!open || !checkpoint?.qrCode) {
        setDataUrl(null);
        setError(null);
        return;
      }

      setDataUrl(null);
      setError(null);

      try {
        const url = await QRCode.toDataURL(
          checkpoint.qrCode,
          {
            width: 320,
            margin: 2,
            errorCorrectionLevel: "H",
          },
        );

        if (!cancelled) {
          setDataUrl(url);
        }
      } catch {
        if (!cancelled) {
          setError("QR Code gagal dibuat.");
        }
      }
    }

    void generateQrCode();

    return () => {
      cancelled = true;
    };
  }, [open, checkpoint]);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <DialogContent className="max-w-sm print:max-w-none">
        <DialogHeader className="print:hidden">
          <DialogTitle>QR Code Checkpoint</DialogTitle>
        </DialogHeader>

        {checkpoint && (
          <div
            id="checkpoint-qr-print"
            className="flex flex-col items-center gap-3 text-center print:gap-4"
          >
            <p className="text-base font-semibold">
              {checkpoint.nama}
            </p>

            <div className="rounded-lg border bg-white p-3">
              {error ? (
                <div className="flex size-56 items-center justify-center p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : dataUrl ? (
                <img
                  src={dataUrl}
                  alt={`QR Code ${checkpoint.nama}`}
                  className="size-56"
                />
              ) : (
                <Skeleton className="size-56" />
              )}
            </div>

            <code className="block w-full break-all rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
              {checkpoint.qrCode}
            </code>

            <p className="text-xs text-muted-foreground print:hidden">
              Tempelkan QR Code ini di titik checkpoint.
            </p>
          </div>
        )}

        <DialogFooter className="print:hidden">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
          >
            Tutup
          </Button>

          <Button
            type="button"
            className="cursor-pointer gap-1"
            onClick={handlePrint}
            disabled={!dataUrl}
          >
            <Printer className="size-4" />
            Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}