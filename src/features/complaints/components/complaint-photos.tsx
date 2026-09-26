"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus } from "lucide-react";
import { Alert } from "@/components/ui/feedback";
import { uploadComplaintPhotoAction } from "@/features/complaints/mutations";

const MAX_EDGE = 1600;

/** Shrink phone photos in the browser (12 MP → ~300 KB) so uploads are fast and fit request limits. */
async function compress(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // Unsupported format in this browser; the server decides.
  }
}

interface Props {
  slug: string;
  complaintId: string;
  photos: { id: string; name: string }[];
  canAdd: boolean;
  max: number;
  highlight?: boolean;
}

export function ComplaintPhotos({ slug, complaintId, photos, canAdd, max, highlight }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const room = max - photos.length;

  function onPick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files).slice(0, room);
    start(async () => {
      for (let i = 0; i < list.length; i++) {
        setProgress(`Uploading ${i + 1} of ${list.length}…`);
        const fd = new FormData();
        fd.set("complaintId", complaintId);
        fd.set("photo", await compress(list[i]!));
        const r = await uploadComplaintPhotoAction(slug, fd);
        if (!r?.ok) {
          setError(r?.error.message ?? "Upload failed. Try again.");
          break;
        }
      }
      setProgress(null);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  if (!photos.length && !canAdd) return null;

  return (
    <section className={`rounded-2xl bg-surface p-5 ring-1 ${highlight ? "ring-primary/40" : "ring-border"}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">Photos {photos.length > 0 && <span className="font-normal text-subtle">({photos.length})</span>}</h2>
        {canAdd && room > 0 && photos.length > 0 && (
          <button type="button" onClick={() => input.current?.click()} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline disabled:opacity-60">
            <ImagePlus className="size-4" aria-hidden /> Add photo
          </button>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {photos.length > 0 ? (
        <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <a href={`/api/files/${p.id}`} target="_blank" rel="noopener" className="block aspect-square overflow-hidden rounded-xl bg-bg ring-1 ring-border hover:ring-primary">
                {/* Private, authorized route: next/image optimisation would bypass the auth check. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/files/${p.id}`} alt={p.name} loading="lazy" className="size-full object-cover" />
              </a>
            </li>
          ))}
        </ul>
      ) : (
        canAdd && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={pending}
            className="mt-3 flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-bg px-4 py-6 text-center transition-colors hover:border-primary-ring disabled:opacity-60"
          >
            <Camera className="size-6 text-primary" aria-hidden />
            <span className="text-sm font-semibold">{highlight ? "Add a photo so staff see the problem" : "Add photos"}</span>
            <span className="text-xs text-muted">Up to {max} photos · JPG, PNG or WebP</span>
          </button>
        )
      )}

      {progress && (
        <p role="status" className="mt-2 text-xs text-muted">
          {progress}
        </p>
      )}
      {canAdd && (
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          multiple
          className="sr-only"
          aria-label="Add photos"
          onChange={(e) => onPick(e.target.files)}
        />
      )}
    </section>
  );
}
