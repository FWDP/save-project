"use client";
import { useRef, useState, useTransition } from "react";
import { scanReceipt } from "@/app/receipts/actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,application/pdf";

/** Categories shown in the main TransactionForm datalist */
const CATEGORIES = [
  "Food & dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Utilities",
  "Health",
  "Salary",
  "Freelance",
  "Business expenses",
  "Sales",
  "Other",
];

type Props = {
  /** ref to the <form> that contains the transaction fields we will auto-fill */
  formRef: React.RefObject<HTMLFormElement | null>;
  /** ISO currency code of this workspace (e.g. "PHP") */
  currency: string;
};

export function ReceiptScanner({ formRef, currency }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "scanning" }
    | { kind: "success"; summary: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  function patchForm(data: {
    merchant?: string;
    amount?: number;
    date?: string;
    category?: string;
    notes?: string;
  }) {
    const form = formRef.current;
    if (!form) return;

    function set(name: string, value: string) {
      const el = form!.elements.namedItem(name);
      if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        // Only overwrite if the field is currently empty
        if (!el.value.trim()) {
          el.value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }
    }

    if (data.amount != null) {
      // Convert to decimal string matching the currency precision
      set("amount", data.amount.toFixed(2).replace(/\.?0+$/, ""));
    }
    if (data.merchant) set("merchant", data.merchant);
    if (data.date) set("date", data.date);
    if (data.notes) set("description", data.notes);
    else if (data.merchant) set("description", `Purchase at ${data.merchant}`);

    if (data.category) {
      // Try a case-insensitive match against known categories
      const match = CATEGORIES.find(
        (c) => c.toLowerCase() === data.category!.toLowerCase(),
      );
      set("category", match ?? data.category);
    }
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    // Show local preview for image types
    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }

    setStatus({ kind: "scanning" });

    startTransition(async () => {
      const form = new FormData();
      form.append("file", file);
      form.append("categories", CATEGORIES.join(","));

      const result = await scanReceipt(form);

      if (!result.ok) {
        setStatus({ kind: "error", message: result.error });
        return;
      }

      patchForm(result.data);

      const { merchant, amount } = result.data;
      setStatus({
        kind: "success",
        summary: `Gemini AI read: ${merchant || "receipt"} · ${currency} ${amount}`,
      });
    });
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
  }

  function reset() {
    setPreview(null);
    setStatus({ kind: "idle" });
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  }

  const isScanning = isPending || status.kind === "scanning";

  return (
    <div className="receipt-scanner">
      <div className="scanner-header">
        <div className="scanner-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          Gemini AI
        </div>
        <span className="scanner-title">Smart Receipt Scan</span>
        <span className="scanner-hint">
          Upload or photograph a receipt and AI will pre-fill the form for you.
        </span>
      </div>

      {/* Drop zone */}
      <label
        className={`scanner-drop${isScanning ? " scanning" : ""}${status.kind === "success" ? " scanned" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        aria-label="Drop or click to upload a receipt image"
        tabIndex={isScanning ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isScanning}
        />

        {/* Camera capture (mobile) */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={isScanning}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local blob URL, cannot be optimised by next/image
          <img src={preview} alt="Receipt preview" className="scanner-preview" />
        ) : (
          <div className="scanner-placeholder">
            {isScanning ? (
              <>
                <div className="scanner-spinner" aria-hidden="true" />
                <span>Analyzing with Gemini Flash…</span>
              </>
            ) : (
              <>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeWidth="1" />
                </svg>
                <span>Drop receipt image here</span>
                <span className="scanner-sub">or click to browse</span>
              </>
            )}
          </div>
        )}
      </label>

      {/* Action buttons */}
      {!isScanning && status.kind !== "success" && (
        <div className="scanner-actions">
          <button
            type="button"
            className="button secondary small"
            onClick={() => fileInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload file
          </button>
          <button
            type="button"
            className="button secondary small"
            onClick={() => cameraInputRef.current?.click()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
            Take photo
          </button>
        </div>
      )}

      {/* Status feedback */}
      {status.kind === "success" && (
        <div className="scanner-result success">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{status.summary}</span>
          <button
            type="button"
            className="scanner-reset"
            onClick={reset}
            aria-label="Scan another receipt"
          >
            Scan another
          </button>
        </div>
      )}

      {status.kind === "error" && (
        <div className="scanner-result error" role="alert">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>{status.message}</span>
          <button
            type="button"
            className="scanner-reset"
            onClick={reset}
            aria-label="Retry scanning"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
