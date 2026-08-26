import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  apiCreateClubAlbum,
  apiDeleteClubAlbum,
  apiDeleteClubAlbumPhoto,
  apiListClubAlbums,
  apiUpdateClubAlbum,
  apiUploadClubAlbumPhoto,
  type ClubAlbum,
} from "@/lib/clubAlbumsApi";

const MAX_FILES_PER_BATCH = 12;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGE_EDGE = 2048;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface PreparedPhoto {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
  caption: string;
}

interface ClubAlbumTabProps {
  clubId: string;
  clubName: string;
  clubAvatarUrl?: string | null;
  canManage: boolean;
  currentUserName?: string;
  accent: string;
  isDark: boolean;
}

function dataUrlFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read this image"));
    reader.readAsDataURL(blob);
  });
}

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to decode this image"));
    image.src = source;
  });
}

export async function prepareClubAlbumPhoto(file: File): Promise<PreparedPhoto> {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file.name} is not a supported JPEG, PNG, or WebP image`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name} is larger than 12 MB`);
  }

  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(sourceUrl);
    const scale = Math.min(1, MAX_IMAGE_EDGE / image.naturalWidth, MAX_IMAGE_EDGE / image.naturalHeight);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image preparation is unavailable in this browser");
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Unable to prepare this image")), "image/webp", 0.84);
    });
    if (blob.size > 6 * 1024 * 1024) {
      throw new Error(`${file.name} remains larger than 6 MB after optimization`);
    }
    const caption = file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return {
      id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      dataUrl: await dataUrlFromBlob(blob),
      width,
      height,
      caption,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function formatClubAlbumDate(eventDate: string | null, createdAt: string) {
  const value = eventDate ? `${eventDate}T12:00:00` : createdAt;
  return new Date(value).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function AlbumMosaic({
  album,
  onOpen,
}: {
  album: ClubAlbum;
  onOpen: (album: ClubAlbum, index: number) => void;
}) {
  const visible = album.photos.slice(0, 5);
  const remaining = Math.max(0, album.photos.length - visible.length);

  if (visible.length === 0) {
    return (
      <div className="flex aspect-[16/8] items-center justify-center bg-white/[0.025] text-white/25">
        <Images className="h-9 w-9" aria-hidden="true" />
      </div>
    );
  }

  if (visible.length === 1) {
    return (
      <button type="button" onClick={() => onOpen(album, 0)} className="block w-full overflow-hidden bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50]">
        <img
          src={visible[0].url}
          alt={visible[0].altText || visible[0].caption || `${album.title} photo 1`}
          loading="lazy"
          decoding="async"
          className="aspect-[16/10] w-full object-cover transition-transform duration-300 motion-safe:hover:scale-[1.015]"
        />
      </button>
    );
  }

  return (
    <div className={`grid gap-1 bg-black/30 ${visible.length === 2 ? "grid-cols-2" : "grid-cols-2 grid-rows-2"}`}>
      {visible.map((photo, index) => {
        const isLead = visible.length >= 3 && index === 0;
        const isLast = index === visible.length - 1;
        return (
          <button
            type="button"
            key={photo.id}
            onClick={() => onOpen(album, index)}
            className={`group relative min-h-0 overflow-hidden focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4CAF50] ${
              visible.length === 2 ? "aspect-square" : isLead ? "row-span-2 min-h-[244px] sm:min-h-[360px]" : "min-h-[120px] sm:min-h-[178px]"
            }`}
          >
            <img
              src={photo.url}
              alt={photo.altText || photo.caption || `${album.title} photo ${index + 1}`}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.025]"
            />
            {isLast && remaining > 0 && (
              <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-2xl font-bold text-white backdrop-blur-[1px]">
                +{remaining}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function AlbumSkeleton({ isDark }: { isDark: boolean }) {
  return (
    <div className={`overflow-hidden rounded-3xl border ${isDark ? "border-white/8 bg-[#0b180d]/90" : "border-[#436850]/15 bg-white/90"}`}>
      <div className="flex items-center gap-3 p-4">
        <div className={`h-10 w-10 animate-pulse rounded-full ${isDark ? "bg-white/8" : "bg-[#436850]/10"}`} />
        <div className="flex-1 space-y-2">
          <div className={`h-3 w-36 animate-pulse rounded ${isDark ? "bg-white/8" : "bg-[#436850]/10"}`} />
          <div className={`h-3 w-24 animate-pulse rounded ${isDark ? "bg-white/5" : "bg-[#436850]/8"}`} />
        </div>
      </div>
      <div className={`aspect-[16/8] animate-pulse ${isDark ? "bg-white/5" : "bg-[#436850]/8"}`} />
    </div>
  );
}

export function ClubAlbumTab({
  clubId,
  clubName,
  clubAvatarUrl,
  canManage,
  currentUserName = "Club director",
  accent,
  isDark,
}: ClubAlbumTabProps) {
  const [albums, setAlbums] = useState<ClubAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<ClubAlbum | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [pendingPhotos, setPendingPhotos] = useState<PreparedPhoto[]>([]);
  const [preparingFiles, setPreparingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ album: ClubAlbum; index: number } | null>(null);
  const [deleteAlbumTarget, setDeleteAlbumTarget] = useState<ClubAlbum | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadAlbums = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setAlbums(await apiListClubAlbums(clubId));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load club albums");
    } finally {
      setLoading(false);
    }
  }, [clubId]);

  useEffect(() => {
    void loadAlbums();
  }, [loadAlbums]);

  const currentPhoto = viewer?.album.photos[viewer.index] ?? null;
  const viewerCount = viewer?.album.photos.length ?? 0;

  useEffect(() => {
    if (!viewer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") {
        setViewer((current) => current ? { ...current, index: (current.index - 1 + current.album.photos.length) % current.album.photos.length } : null);
      }
      if (event.key === "ArrowRight") {
        setViewer((current) => current ? { ...current, index: (current.index + 1) % current.album.photos.length } : null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [viewer]);

  const resetEditor = () => {
    setEditingAlbum(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setPendingPhotos([]);
    setFormError(null);
    setUploadProgress({ completed: 0, total: 0 });
  };

  const openCreate = () => {
    resetEditor();
    setEditorOpen(true);
  };

  const openEdit = (album: ClubAlbum) => {
    setEditingAlbum(album);
    setTitle(album.title);
    setDescription(album.description ?? "");
    setEventDate(album.eventDate ?? "");
    setPendingPhotos([]);
    setFormError(null);
    setUploadProgress({ completed: 0, total: 0 });
    setEditorOpen(true);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const selected = Array.from(files).slice(0, MAX_FILES_PER_BATCH);
    if (files.length > MAX_FILES_PER_BATCH) {
      toast.info(`Preparing the first ${MAX_FILES_PER_BATCH} photos. Add the rest in another batch.`);
    }
    setPreparingFiles(true);
    setFormError(null);
    try {
      const prepared: PreparedPhoto[] = [];
      for (const file of selected) prepared.push(await prepareClubAlbumPhoto(file));
      setPendingPhotos((current) => [...current, ...prepared]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to prepare those photos");
    } finally {
      setPreparingFiles(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveAlbum = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError("Add an album title before publishing.");
      return;
    }
    if (!editingAlbum && pendingPhotos.length === 0) {
      setFormError("Select at least one event photo for this album.");
      return;
    }

    setSaving(true);
    setFormError(null);
    let albumId = editingAlbum?.id;
    let createdNewAlbum = false;
    let uploaded = 0;
    try {
      if (editingAlbum) {
        await apiUpdateClubAlbum(clubId, editingAlbum.id, { title: cleanTitle, description: description.trim(), eventDate });
      } else {
        albumId = await apiCreateClubAlbum(clubId, {
          title: cleanTitle,
          description: description.trim(),
          eventDate,
          createdByName: currentUserName,
        });
        createdNewAlbum = true;
      }

      if (!albumId) throw new Error("Album could not be created");
      setUploadProgress({ completed: 0, total: pendingPhotos.length });
      for (const photo of pendingPhotos) {
        await apiUploadClubAlbumPhoto(clubId, albumId, {
          dataUrl: photo.dataUrl,
          caption: photo.caption,
          altText: photo.caption,
          width: photo.width,
          height: photo.height,
        });
        uploaded += 1;
        setUploadProgress({ completed: uploaded, total: pendingPhotos.length });
      }

      await loadAlbums();
      setEditorOpen(false);
      resetEditor();
      toast.success(editingAlbum ? "Album updated" : "Album published");
    } catch (error) {
      if (createdNewAlbum && albumId && uploaded === 0) {
        await apiDeleteClubAlbum(clubId, albumId).catch(() => undefined);
      }
      await loadAlbums();
      const message = error instanceof Error ? error.message : "Unable to save this album";
      setFormError(uploaded > 0 ? `${uploaded} photo${uploaded === 1 ? "" : "s"} uploaded before an error occurred. ${message}` : message);
    } finally {
      setSaving(false);
    }
  };

  const deleteAlbum = async () => {
    if (!deleteAlbumTarget) return;
    setDeleting(true);
    try {
      await apiDeleteClubAlbum(clubId, deleteAlbumTarget.id);
      setDeleteAlbumTarget(null);
      await loadAlbums();
      toast.success("Album removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete album");
    } finally {
      setDeleting(false);
    }
  };

  const deleteCurrentPhoto = async () => {
    if (!viewer || !currentPhoto) return;
    if (!window.confirm("Remove this photo from the album?")) return;
    try {
      await apiDeleteClubAlbumPhoto(clubId, viewer.album.id, currentPhoto.id);
      const nextPhotos = viewer.album.photos.filter((photo) => photo.id !== currentPhoto.id);
      setAlbums((current) => current.map((album) => album.id === viewer.album.id ? { ...album, photos: nextPhotos } : album));
      if (nextPhotos.length === 0) {
        setViewer(null);
      } else {
        setViewer({ album: { ...viewer.album, photos: nextPhotos }, index: Math.min(viewer.index, nextPhotos.length - 1) });
      }
      toast.success("Photo removed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to remove photo");
    }
  };

  const totalPhotos = useMemo(() => albums.reduce((sum, album) => sum + album.photos.length, 0), [albums]);
  const surface = isDark ? "border-white/8 bg-[#071309]/92 text-white" : "border-[#436850]/15 bg-white/92 text-[#12372A]";
  const muted = isDark ? "text-white/55" : "text-[#436850]/75";

  return (
    <section aria-labelledby="club-albums-heading" className="mx-auto w-full max-w-3xl space-y-4">
      <header className={`rounded-3xl border p-5 sm:p-6 ${surface}`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${accent}20`, color: accent }}>
                <Images className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${muted}`}>Club memories</span>
            </div>
            <h2 id="club-albums-heading" className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>Albums</h2>
            <p className={`mt-1 text-sm leading-relaxed ${muted}`}>
              {albums.length > 0 ? `${albums.length} album${albums.length === 1 ? "" : "s"} · ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"}` : `Event photos shared by ${clubName}.`}
            </p>
          </div>
          {canManage && (
            <Button type="button" onClick={openCreate} className="h-11 shrink-0 rounded-xl px-4 font-semibold text-white" style={{ background: accent }}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
              Create album
            </Button>
          )}
        </div>
      </header>

      {loading && (
        <div className="space-y-4" aria-label="Loading club albums">
          <AlbumSkeleton isDark={isDark} />
          <AlbumSkeleton isDark={isDark} />
        </div>
      )}

      {!loading && loadError && (
        <div className={`rounded-3xl border p-8 text-center ${surface}`} role="alert">
          <Images className={`mx-auto h-9 w-9 ${muted}`} aria-hidden="true" />
          <h3 className="mt-3 text-base font-bold">Albums could not be loaded</h3>
          <p className={`mx-auto mt-1 max-w-md text-sm ${muted}`}>{loadError}</p>
          <Button type="button" variant="outline" onClick={() => void loadAlbums()} className="mt-4 rounded-xl">
            <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" /> Retry
          </Button>
        </div>
      )}

      {!loading && !loadError && albums.length === 0 && (
        <div className={`rounded-3xl border px-6 py-14 text-center ${surface}`}>
          <h3 className="text-lg font-bold tracking-normal" style={{ fontFamily: "Inter, sans-serif", wordSpacing: "0.12em" }}>No albums yet</h3>
          <p className={`mx-auto mt-1 max-w-sm text-sm leading-relaxed ${muted}`}>
            {canManage ? "Create the first album to share tournament nights, club meetups, and community moments." : "Event photos and club memories will appear here when the club shares them."}
          </p>
          {canManage && (
            <Button type="button" onClick={openCreate} className="mt-5 h-11 rounded-xl px-4 font-semibold text-white" style={{ background: accent }}>
              <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" /> Add first album
            </Button>
          )}
        </div>
      )}

      {!loading && !loadError && albums.map((album) => (
        <article key={album.id} className={`overflow-hidden rounded-3xl border ${surface}`}>
          <div className="flex items-start gap-3 p-4 sm:p-5">
            <PlayerAvatar username={clubName} name={clubName} avatarUrl={clubAvatarUrl ?? undefined} size={42} showBadge={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="truncate text-[15px] font-bold">{album.title}</h3>
                <span className={`text-xs ${muted}`}>{formatClubAlbumDate(album.eventDate, album.createdAt)}</span>
              </div>
              <p className={`mt-0.5 text-xs ${muted}`}>{clubName} · {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</p>
            </div>
            {canManage && (
              <div className="flex shrink-0 items-center gap-1">
                <button type="button" onClick={() => openEdit(album)} className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isDark ? "text-white/45 hover:bg-white/8 hover:text-white" : "text-[#436850]/70 hover:bg-[#436850]/8"}`} aria-label={`Edit ${album.title}`}>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => setDeleteAlbumTarget(album)} className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isDark ? "text-white/35 hover:bg-red-500/10 hover:text-red-400" : "text-[#436850]/55 hover:bg-red-50 hover:text-red-600"}`} aria-label={`Delete ${album.title}`}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
          {album.description && <p className={`px-4 pb-4 text-[15px] leading-relaxed sm:px-5 ${isDark ? "text-white/78" : "text-[#12372A]/85"}`}>{album.description}</p>}
          <AlbumMosaic album={album} onOpen={(target, index) => setViewer({ album: target, index })} />
          <div className={`flex items-center justify-between gap-3 px-4 py-3 text-xs sm:px-5 ${muted}`}>
            <span className="inline-flex items-center gap-1.5"><Images className="h-3.5 w-3.5" aria-hidden="true" /> {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</span>
            {canManage && (
              <button type="button" onClick={() => openEdit(album)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 font-semibold transition-colors" style={{ color: accent }}>
                <Upload className="h-3.5 w-3.5" aria-hidden="true" /> Add photos
              </button>
            )}
          </div>
        </article>
      ))}

      <Dialog open={editorOpen} onOpenChange={(open) => { if (!saving) { setEditorOpen(open); if (!open) resetEditor(); } }}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-3xl border-white/10 bg-[#09170b] p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-white/8 px-5 py-5 text-left sm:px-6">
            <DialogTitle className="text-xl font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>{editingAlbum ? "Edit album" : "Create album"}</DialogTitle>
            <DialogDescription className="text-sm text-white/50">Share event photos publicly on the club’s Album timeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            <div className="space-y-2">
              <label htmlFor="club-album-title" className="text-sm font-semibold text-white/85">Album title</label>
              <Input id="club-album-title" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} placeholder="Friday Night Swiss" className="h-11 border-white/10 bg-white/5 text-base text-white placeholder:text-white/30" />
              <p className="text-right text-[11px] tabular-nums text-white/35">{title.length}/120</p>
            </div>
            <div className="space-y-2">
              <label htmlFor="club-album-date" className="text-sm font-semibold text-white/85">Event date <span className="font-normal text-white/35">(optional)</span></label>
              <Input id="club-album-date" type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} className="h-11 border-white/10 bg-white/5 text-base text-white [color-scheme:dark]" />
            </div>
            <div className="space-y-2">
              <label htmlFor="club-album-description" className="text-sm font-semibold text-white/85">Album caption <span className="font-normal text-white/35">(optional)</span></label>
              <Textarea id="club-album-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={3} placeholder="A quick recap of the event and the people in these photos." className="resize-none border-white/10 bg-white/5 text-base text-white placeholder:text-white/30" />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white/85">Photos {editingAlbum ? <span className="font-normal text-white/35">(add more)</span> : null}</p>
                <p className="mt-1 text-xs text-white/45">JPEG, PNG, or WebP. Up to {MAX_FILES_PER_BATCH} photos per batch. Images are optimized before upload.</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => void handleFiles(event.target.files)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={preparingFiles || saving} className="flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-4 text-sm font-semibold text-white/65 transition-colors hover:border-[#4CAF50]/50 hover:bg-[#4CAF50]/5 hover:text-white disabled:opacity-50">
                {preparingFiles ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
                {preparingFiles ? "Preparing photos…" : "Choose event photos"}
              </button>

              {pendingPhotos.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pendingPhotos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-2xl border border-white/8 bg-white/[0.025]">
                      <div className="relative aspect-[16/10]">
                        <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
                        <button type="button" onClick={() => setPendingPhotos((current) => current.filter((item) => item.id !== photo.id))} className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-md transition-colors hover:bg-red-600" aria-label={`Remove ${photo.name}`}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="space-y-1.5 p-3">
                        <label htmlFor={`caption-${photo.id}`} className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/45">Caption and photo description</label>
                        <Input id={`caption-${photo.id}`} value={photo.caption} maxLength={300} onChange={(event) => setPendingPhotos((current) => current.map((item) => item.id === photo.id ? { ...item, caption: event.target.value } : item))} className="h-10 border-white/8 bg-black/20 text-sm text-white placeholder:text-white/25" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {saving && uploadProgress.total > 0 && (
              <div className="rounded-2xl border border-[#4CAF50]/20 bg-[#4CAF50]/8 p-4" aria-live="polite">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold text-white/70">
                  <span>Uploading photos</span>
                  <span className="tabular-nums">{uploadProgress.completed}/{uploadProgress.total}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/25">
                  <div className="h-full rounded-full bg-[#4CAF50] transition-[width] duration-200" style={{ width: `${uploadProgress.total ? (uploadProgress.completed / uploadProgress.total) * 100 : 0}%` }} />
                </div>
              </div>
            )}

            {formError && <p className="rounded-xl border border-red-500/20 bg-red-500/8 px-3 py-2.5 text-sm text-red-300" role="alert">{formError}</p>}
          </div>
          <DialogFooter className="border-t border-white/8 px-5 py-4 sm:px-6">
            <Button type="button" variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving} className="h-11 rounded-xl text-white/60 hover:bg-white/8 hover:text-white">Cancel</Button>
            <Button type="button" onClick={() => void saveAlbum()} disabled={saving || preparingFiles} className="h-11 rounded-xl px-5 font-semibold text-white" style={{ background: accent }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : editingAlbum ? "Save changes" : "Publish album"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewer !== null} onOpenChange={(open) => { if (!open) setViewer(null); }}>
        <DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white">
          <DialogTitle className="sr-only">{viewer?.album.title ?? "Album photo"}</DialogTitle>
          <DialogDescription className="sr-only">Full-screen club album photo viewer. Use the left and right arrow keys to navigate.</DialogDescription>
          {viewer && currentPhoto && (
            <div className="relative flex h-full min-h-0 flex-col">
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{viewer.album.title}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-white/60">{viewer.index + 1} of {viewerCount}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button type="button" onClick={() => void deleteCurrentPhoto()} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/70 backdrop-blur-md transition-colors hover:bg-red-500/25 hover:text-red-300" aria-label="Remove this photo">
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" onClick={() => setViewer(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20" aria-label="Close photo viewer">
                    <X className="h-5 w-5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-20 sm:px-16">
                <img src={currentPhoto.url} alt={currentPhoto.altText || currentPhoto.caption || `${viewer.album.title} photo ${viewer.index + 1}`} className="max-h-full max-w-full object-contain" />
              </div>
              {viewerCount > 1 && (
                <>
                  <button type="button" onClick={() => setViewer((current) => current ? { ...current, index: (current.index - 1 + current.album.photos.length) % current.album.photos.length } : null)} className="absolute left-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70 sm:left-5" aria-label="Previous photo">
                    <ChevronLeft className="h-6 w-6" aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => setViewer((current) => current ? { ...current, index: (current.index + 1) % current.album.photos.length } : null)} className="absolute right-2 top-1/2 z-20 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-md transition-colors hover:bg-black/70 sm:right-5" aria-label="Next photo">
                    <ChevronRight className="h-6 w-6" aria-hidden="true" />
                  </button>
                </>
              )}
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/85 to-transparent px-4 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] pt-12 text-center">
                {currentPhoto.caption && <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/85">{currentPhoto.caption}</p>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteAlbumTarget !== null} onOpenChange={(open) => { if (!open && !deleting) setDeleteAlbumTarget(null); }}>
        <DialogContent className="max-w-md rounded-3xl border-white/10 bg-[#09170b] text-white">
          <DialogHeader className="text-left">
            <DialogTitle>Delete album?</DialogTitle>
            <DialogDescription className="text-white/50">This removes “{deleteAlbumTarget?.title}” and all of its photo references from the public club timeline. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteAlbumTarget(null)} disabled={deleting} className="rounded-xl text-white/65 hover:bg-white/8 hover:text-white">Cancel</Button>
            <Button type="button" onClick={() => void deleteAlbum()} disabled={deleting} className="rounded-xl bg-red-600 text-white hover:bg-red-500">
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              Delete album
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
