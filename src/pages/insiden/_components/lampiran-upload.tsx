import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ImagePlus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

export type LampiranItem = {
  fileId: number;
  keterangan: string;
  url: string;
};

type Props = {
  value: LampiranItem[];
  onChange: (items: LampiranItem[]) => void;
};

type UploadResponse = {
  fileId: number;
  url: string;
};

export default function LampiranUpload({ value, onChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => {
      value.forEach((item) => {
        if (item.url.startsWith("blob:")) {
          URL.revokeObjectURL(item.url);
        }
      });
    };
  }, [value]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);

    try {
      const newItems: LampiranItem[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) {
          throw new Error("File yang dipilih harus berupa gambar");
        }

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/uploads/berita-acara", {
          method: "POST",
          body: formData,
          credentials: "include",
        });

        const result = (await response.json().catch(() => null)) as
          | UploadResponse
          | { message?: string }
          | null;

        if (!response.ok) {
          throw new Error(
            result && "message" in result
              ? result.message
              : "Gagal mengunggah foto",
          );
        }

        if (!result || !("fileId" in result) || !("url" in result)) {
          throw new Error("Response upload tidak valid");
        }

        newItems.push({
          fileId: result.fileId,
          url: result.url,
          keterangan: "",
        });
      }

      onChange([...value, ...newItems]);
      toast.success(`${newItems.length} foto berhasil diunggah`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengunggah foto",
      );
    } finally {
      setUploading(false);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const updateKeterangan = (index: number, keterangan: string) => {
    const updatedItems = value.map((item, itemIndex) =>
      itemIndex === index
        ? { ...item, keterangan }
        : item,
    );

    onChange(updatedItems);
  };

  const removeItem = async (index: number) => {
    const item = value[index];

    if (!item) {
      return;
    }

    try {
      const response = await fetch(`/api/uploads/${item.fileId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Gagal menghapus file dari server");
      }

      onChange(value.filter((_, itemIndex) => itemIndex !== index));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal menghapus foto",
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <ImagePlus className="mr-1.5 h-4 w-4" />
          )}

          {uploading ? "Mengunggah..." : "Tambah Foto"}
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {value.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {value.length} foto
          </span>
        )}
      </div>

      {value.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.map((item, index) => (
            <div
              key={item.fileId}
              className="relative space-y-2 rounded-lg border p-2"
            >
              <img
                src={item.url}
                alt={`Lampiran ${index + 1}`}
                className="h-24 w-full rounded object-cover"
              />

              <Input
                placeholder="Keterangan foto..."
                value={item.keterangan}
                onChange={(event) =>
                  updateKeterangan(index, event.target.value)
                }
                className="text-xs"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-6 w-6 bg-background/80"
                onClick={() => void removeItem(index)}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}