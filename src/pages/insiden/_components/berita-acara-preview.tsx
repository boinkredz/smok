import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

import { JENIS_INSIDEN_LABELS } from "../_lib/constants.ts";

type JenisInsiden =
  | "KECELAKAAN"
  | "KERUSAKAN"
  | "KEHILANGAN"
  | "PELANGGARAN"
  | "LAINNYA";

type LampiranItem = {
  fileId?: string | null;
  storageId?: string | null;
  keterangan?: string | null;
  url?: string | null;
};

export type BeritaAcaraData = {
  id?: number;

  nomorBa: string;
  tanggal: string;
  waktu: string;
  jenisInsiden: string;

  lokasiGedung: string;
  lokasiDetail: string;

  kronologi: string;
  tindakan: string;
  hasilTindakan: string;

  petugasNama: string;
  petugasJabatan: string;
  ttdPetugasUrl?: string | null;

  atasanNama?: string | null;
  atasanJabatan?: string | null;
  ttdAtasanUrl?: string | null;

  ketahuiNama?: string | null;
  ketahuiJabatan?: string | null;
  ttdKetahuiUrl?: string | null;

  tempatTtd: string;
  lampiran: LampiranItem[];

  site?: {
    nama: string;
  } | null;
};

type Props = {
  ba: BeritaAcaraData;
};

type JenisInsidenKey = keyof typeof JENIS_INSIDEN_LABELS;

function formatTanggal(value: string, pattern: string) {
  return format(parseISO(value), pattern, {
    locale: localeId,
  });
}

export default function BeritaAcaraPreview({ ba }: Props) {
  const tanggalFormatted = formatTanggal(
    ba.tanggal,
    "d MMMM yyyy",
  );
  
const jenisKey = ba.jenisInsiden
  .trim()
  .toLowerCase() as JenisInsidenKey;

const jenisLabel =
  JENIS_INSIDEN_LABELS[jenisKey] ?? ba.jenisInsiden;

  const toList = (text: string) =>
    text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);

  const renderList = (text: string) => {
    const items = toList(text);

    if (items.length === 0) {
      return <span>-</span>;
    }

    return (
      <ol style={{ margin: 0, paddingLeft: "20px" }}>
        {items.map((item, index) => (
          <li key={index} style={{ marginBottom: "2px" }}>
            {item}
          </li>
        ))}
      </ol>
    );
  };

  return (
    <div
      style={{
        fontFamily: "Times New Roman, serif",
        fontSize: "12pt",
        color: "#000",
        background: "#fff",
        width: "215mm",
        minHeight: "330mm",
        padding: "20mm 25mm 20mm 30mm",
        boxSizing: "border-box",
        lineHeight: "1.6",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "2px solid #333",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "8pt",
              fontWeight: "bold",
            }}
          >
            ◆
          </div>

          <div>
            <div
              style={{
                fontWeight: "bold",
                fontSize: "13pt",
                letterSpacing: "2px",
              }}
            >
              SOLID
            </div>
            <div style={{ fontSize: "7pt", color: "#555" }}>
              MAN &amp; DEVICE ADVISORY
            </div>
          </div>
        </div>

        <div
          style={{
            textAlign: "right",
            fontSize: "9pt",
            color: "#444",
          }}
        >
          {ba.site?.nama ?? ""}
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: "4px" }}>
        <div
          style={{
            fontWeight: "bold",
            fontSize: "13pt",
            letterSpacing: "1px",
          }}
        >
          BERITA ACARA
        </div>

        <div style={{ fontSize: "11pt" }}>
          NOMOR : {ba.nomorBa}
        </div>
      </div>

      <p
        style={{
          marginTop: "14px",
          marginBottom: "10px",
          textAlign: "justify",
        }}
      >
        Pada hari ini{" "}
        {formatTanggal(ba.tanggal, "EEEE")},{" "}
        {tanggalFormatted}, saya yang sedang melaksanakan tugas di bawah ini:
      </p>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "12px",
        }}
      >
        <tbody>
          <tr>
            <td style={{ width: "30%" }}>Nama</td>
            <td style={{ width: "4%" }}>:</td>
            <td>{ba.petugasNama}</td>
          </tr>
          <tr>
            <td>Jabatan</td>
            <td>:</td>
            <td>{ba.petugasJabatan}</td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginBottom: "12px" }}>
        Melaporkan kejadian sebagai berikut:
      </p>

      <section style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "6px",
          }}
        >
          A. Informasi Awal:
        </div>

        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>
            <tr>
              <td style={{ width: "30%" }}>Hari/Tanggal</td>
              <td style={{ width: "4%" }}>:</td>
              <td>{formatTanggal(ba.tanggal, "EEEE, d MMMM yyyy")}</td>
            </tr>
            <tr>
              <td>Pukul</td>
              <td>:</td>
              <td>{ba.waktu} WIB</td>
            </tr>
            <tr>
              <td>Kejadian</td>
              <td>:</td>
              <td>{jenisLabel}</td>
            </tr>
            <tr>
              <td>Lokasi</td>
              <td>:</td>
              <td>
                {ba.lokasiGedung} — {ba.lokasiDetail}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "4px",
          }}
        >
          B. Kronologi Kejadian:
        </div>
        {renderList(ba.kronologi)}
      </section>

      <section style={{ marginBottom: "10px" }}>
        <div
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "4px",
          }}
        >
          C. Tindakan Yang Dilakukan:
        </div>
        {renderList(ba.tindakan)}
      </section>

      <section style={{ marginBottom: "16px" }}>
        <div
          style={{
            fontWeight: "bold",
            textDecoration: "underline",
            marginBottom: "4px",
          }}
        >
          D. Hasil Dari Tindakan Yang Telah Diambil:
        </div>
        {renderList(ba.hasilTindakan)}
      </section>

      <p style={{ marginBottom: "20px", textAlign: "justify" }}>
        Demikian laporan yang dapat saya sampaikan sebagai bahan periksa
        Pimpinan. Terima kasih.
      </p>

      <div style={{ textAlign: "right", marginBottom: "24px" }}>
        {ba.tempatTtd}, {tanggalFormatted}
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "center",
        }}
      >
        <tbody>
          <tr>
            <SignatureColumn
              title="YANG MEMBUAT"
              name={ba.petugasNama}
              position={ba.petugasJabatan}
              signatureUrl={ba.ttdPetugasUrl}
            />

            <SignatureColumn
              title="DI PERIKSA"
              name={ba.atasanNama}
              position={ba.atasanJabatan}
              signatureUrl={ba.ttdAtasanUrl}
            />

            <SignatureColumn
              title="DI KETAHUI"
              name={ba.ketahuiNama}
              position={ba.ketahuiJabatan}
              signatureUrl={ba.ttdKetahuiUrl}
            />
          </tr>
        </tbody>
      </table>

      {ba.lampiran?.some((item) => item.url) && (
        <div style={{ marginTop: "32px" }}>
          <div
            style={{
              borderTop: "1px dashed #999",
              marginBottom: "20px",
            }}
          />

          <div
            style={{
              textAlign: "center",
              fontWeight: "bold",
              textDecoration: "underline",
              marginBottom: "16px",
              letterSpacing: "1px",
            }}
          >
            LAMPIRAN FOTO DOKUMENTASI
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "16px",
            }}
          >
            {ba.lampiran.map((item, index) =>
              item.url ? (
                <div key={item.fileId ?? item.storageId ?? index}>
                  <img
                    src={item.url}
                    alt={item.keterangan ?? `Foto ${index + 1}`}
                    style={{
                      width: "240px",
                      height: "160px",
                      objectFit: "cover",
                      border: "1px solid #ccc",
                      display: "block",
                    }}
                  />

                  <div
                    style={{
                      marginTop: "4px",
                      fontSize: "10pt",
                      textAlign: "center",
                    }}
                  >
                    {item.keterangan ?? `Foto ${index + 1}`}
                  </div>
                </div>
              ) : null,
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type SignatureColumnProps = {
  title: string;
  name?: string | null;
  position?: string | null;
  signatureUrl?: string | null;
};

function SignatureColumn({
  title,
  name,
  position,
  signatureUrl,
}: SignatureColumnProps) {
  return (
    <td
      style={{
        width: "33%",
        verticalAlign: "top",
        paddingBottom: "4px",
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: "60px" }}>
        {title}
      </div>

      {signatureUrl && (
        <img
          src={signatureUrl}
          alt={`Tanda tangan ${title.toLowerCase()}`}
          style={{
            height: "50px",
            margin: "0 auto 4px",
            display: "block",
          }}
        />
      )}

      <div
        style={{
          borderTop: "1px solid #000",
          paddingTop: "4px",
          display: "inline-block",
          minWidth: "120px",
        }}
      >
        <div style={{ fontWeight: "bold" }}>{name ?? ""}</div>
        <div>{position ?? ""}</div>
      </div>
    </td>
  );
}