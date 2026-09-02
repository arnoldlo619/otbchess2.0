import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const CURATED_ALBUM_COVERS = {
  tournaments: "/manus-storage/chess-tournaments_23c8b088.jpg",
  leagues: "/manus-storage/chess-leagues_770bca1d.jpg",
  meetups: "/manus-storage/chess-club-meetups_c17d81ae.jpg",
} as const;

export function getCuratedClubAlbumCover(title: string): string | null {
  const normalizedTitle = title.trim().toLowerCase();
  if (normalizedTitle.includes("tournament")) return CURATED_ALBUM_COVERS.tournaments;
  if (normalizedTitle.includes("league")) return CURATED_ALBUM_COVERS.leagues;
  if (normalizedTitle.includes("meetup")) return CURATED_ALBUM_COVERS.meetups;
  return null;
}

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
  canUpload: boolean;
  currentUserName?: string;
  accent: string;
  isDark: boolean;
}

const SHARED_CATEGORY_ALBUM_TITLES = new Set([
  "chess tournaments",
  "chess leagues",
  "chess club meetups",
]);

export function isSharedCategoryAlbum(title: string) {
  return SHARED_CATEGORY_ALBUM_TITLES.has(title.trim().toLowerCase());
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

function AlbumGridItem({
  album,
  photoIndex,
  onOpen,
  canManage,
  canUpload,
  onEdit,
  onDelete,
  onUpload,
}: {
  album: ClubAlbum;
  photoIndex: number | null;
  onOpen: (album: ClubAlbum, index: number) => void;
  canManage: boolean;
  canUpload: boolean;
  onEdit: (album: ClubAlbum) => void;
  onDelete: (album: ClubAlbum) => void;
  onUpload: (album: ClubAlbum) => void;
}) {
  const photo = photoIndex === null ? null : album.photos[photoIndex];
  // A real uploaded album photo remains the highest-priority cover. Category
  // artwork only replaces generic covers for the matching album destinations.
  const coverUrl = photo?.url ?? getCuratedClubAlbumCover(album.title) ?? album.coverImageUrl;
  const label = photo
    ? photo.altText || photo.caption || `${album.title} photo ${(photoIndex ?? 0) + 1}`
    : `${album.title} album cover`;

  return (
    <article className="group relative aspect-square overflow-hidden bg-white/[0.035]">
      {coverUrl ? (
        <button type="button" onClick={() => onOpen(album, photoIndex ?? 0)} className="absolute inset-0 block w-full text-left focus-visible:z-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4CAF50]" aria-label={`Open ${album.title} album`}>
          <img src={coverUrl} alt={label} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[260ms] ease-out motion-safe:group-hover:scale-[1.045]" />
        </button>
      ) : (
        <div className="flex h-full items-center justify-center text-white/25"><Images className="h-8 w-8" aria-hidden="true" /></div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent px-2 pb-2 pt-9 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        <p className="truncate text-[11px] font-semibold text-white">{album.title}</p>
        <p className="mt-0.5 text-[10px] text-white/65">{album.photos.length} photo{album.photos.length === 1 ? "" : "s"}</p>
      </div>
      {canManage && (photoIndex === 0 || photoIndex === null) && (
        <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <button type="button" onClick={() => onEdit(album)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white/85 shadow-sm backdrop-blur-sm transition hover:bg-black/85 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]" aria-label={`Edit ${album.title}`}><Pencil className="h-3.5 w-3.5" aria-hidden="true" /></button>
          <button type="button" onClick={() => onDelete(album)} className="flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white/85 shadow-sm backdrop-blur-sm transition hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300" aria-label={`Delete ${album.title}`}><Trash2 className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      )}
      {canUpload && isSharedCategoryAlbum(album.title) && photoIndex === null && (
        <button type="button" onClick={() => onUpload(album)} className="absolute bottom-2 right-2 z-10 inline-flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-black/90 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]" aria-label={`Upload photos to ${album.title}`}>
          <ImagePlus className="h-3.5 w-3.5" aria-hidden="true" /> Upload photos
        </button>
      )}
    </article>
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
  canUpload,
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ completed: 0, total: 0 });
  const [formError, setFormError] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ album: ClubAlbum; index: number } | null>(null);
  const [uploadAlbum, setUploadAlbum] = useState<ClubAlbum | null>(null);
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
    if (!viewer || viewer.album.photos.length === 0) return;
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
    setUploadAlbum(null);
    setTitle("");
    setDescription("");
    setEventDate("");
    setPendingPhotos([]);
    setFormError(null);
    setIsDragActive(false);
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

  const openUpload = (album: ClubAlbum) => {
    setEditorOpen(false);
    setEditingAlbum(null);
    setPendingPhotos([]);
    setFormError(null);
    setUploadProgress({ completed: 0, total: 0 });
    setUploadAlbum(album);
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

  const handlePhotoDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    void handleFiles(event.dataTransfer.files);
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

  const uploadPhotosToAlbum = async () => {
    if (!uploadAlbum) return;
    if (pendingPhotos.length === 0) {
      setFormError("Choose at least one photo to upload.");
      return;
    }

    setSaving(true);
    setFormError(null);
    let uploaded = 0;
    try {
      setUploadProgress({ completed: 0, total: pendingPhotos.length });
      for (const photo of pendingPhotos) {
        await apiUploadClubAlbumPhoto(clubId, uploadAlbum.id, {
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
      const albumTitle = uploadAlbum.title;
      resetEditor();
      toast.success(`${uploaded} photo${uploaded === 1 ? "" : "s"} added to ${albumTitle}`);
    } catch (error) {
      await loadAlbums();
      const message = error instanceof Error ? error.message : "Unable to upload photos";
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
    <section aria-label="Albums" className="mx-auto w-full max-w-5xl space-y-4">
      <header className={`border-b px-1 pb-5 sm:px-2 sm:pb-6 ${isDark ? "border-white/10 text-white" : "border-[#436850]/15 text-[#12372A]"}`}>
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative shrink-0 rounded-full p-[2px]" style={{ background: `linear-gradient(135deg, ${accent}, ${accent}66, ${accent})` }}>
            <div className={`rounded-full p-1 ${isDark ? "bg-[#06130d]" : "bg-white"}`}>
              <PlayerAvatar username={clubName} name={clubName} avatarUrl={clubAvatarUrl ?? undefined} size={72} showBadge={false} />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h2 id="club-albums-heading" className="truncate text-xl font-bold tracking-tight sm:text-2xl" style={{ fontFamily: "'Clash Display', sans-serif" }}>{clubName}</h2>
              <span className={`text-xs font-semibold uppercase tracking-[0.12em] ${muted}`}>Photos</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span><strong className="font-semibold">{totalPhotos}</strong> photos</span>
              <span><strong className="font-semibold">{albums.length}</strong> album{albums.length === 1 ? "" : "s"}</span>
            </div>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${muted}`}>A visual record of {clubName} tournament nights, meetups, and community moments.</p>
          </div>
          {canManage && (
            <Button type="button" onClick={openCreate} className="hidden h-11 shrink-0 rounded-xl px-4 font-semibold text-white sm:inline-flex" style={{ background: accent }}>
              <Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create album
            </Button>
          )}
        </div>
        {canManage && <Button type="button" onClick={openCreate} className="mt-4 h-11 w-full rounded-xl font-semibold text-white sm:hidden" style={{ background: accent }}><Plus className="mr-2 h-4 w-4" aria-hidden="true" /> Create album</Button>}
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

      {!loading && !loadError && albums.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 overflow-hidden rounded-2xl bg-black/20 sm:gap-2" aria-label="Club photo grid">
          {albums.flatMap((album) => {
            const photoIndexes = album.photos.length > 0 ? album.photos.map((_, index) => index) : [null];
            return photoIndexes.map((photoIndex) => (
              <AlbumGridItem key={`${album.id}-${photoIndex ?? "cover"}`} album={album} photoIndex={photoIndex} onOpen={(target, selectedIndex) => setViewer({ album: target, index: selectedIndex })} canManage={canManage} canUpload={canUpload} onEdit={openEdit} onDelete={setDeleteAlbumTarget} onUpload={openUpload} />
            ));
          })}
          {canManage && (
            <button type="button" onClick={openCreate} className={`group flex aspect-square flex-col items-center justify-center gap-2 border border-dashed text-center transition hover:border-[#4CAF50]/60 hover:bg-[#4CAF50]/5 focus:outline-none focus:ring-2 focus:ring-[#4CAF50] ${isDark ? "border-white/15 text-white/55" : "border-[#436850]/25 text-[#436850]/75"}`} aria-label="Create a new album">
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-current transition-transform duration-200 motion-safe:group-hover:scale-105"><Plus className="h-5 w-5" aria-hidden="true" /></span>
              <span className="px-2 text-xs font-semibold">New album</span>
            </button>
          )}
        </div>
      )}

      <Dialog open={editorOpen || uploadAlbum !== null} onOpenChange={(open) => { if (!saving && !open) { setEditorOpen(false); resetEditor(); } }}>
        <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto rounded-3xl border-white/10 bg-[#09170b] p-0 text-white shadow-2xl">
          <DialogHeader className="border-b border-white/8 px-5 py-5 text-left sm:px-6">
            <DialogTitle className="text-xl font-bold" style={{ fontFamily: "'Clash Display', sans-serif" }}>{uploadAlbum ? `Upload photos to ${uploadAlbum.title}` : editingAlbum ? "Edit album" : "Create album"}</DialogTitle>
            <DialogDescription className="text-sm text-white/50">{uploadAlbum ? "Add photos to this shared club album." : "Share event photos publicly on the club’s Album timeline."}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-5 py-5 sm:px-6">
            {!uploadAlbum && <>
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
            </>}

            <div className="space-y-3">
              <div>
                <p className="text-sm font-semibold text-white/85">Photos {editingAlbum ? <span className="font-normal text-white/35">(add more)</span> : null}</p>
                <p className="mt-1 text-xs text-white/45">JPEG, PNG, or WebP. Up to {MAX_FILES_PER_BATCH} photos per batch. Images are optimized before upload.</p>
              </div>
              <label htmlFor="club-album-files" className="sr-only">Event photos</label>
              <input id="club-album-files" ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => void handleFiles(event.target.files)} />
              <div
                role="button"
                tabIndex={preparingFiles || saving ? -1 : 0}
                aria-label="Drop photos here or choose event photos"
                aria-disabled={preparingFiles || saving}
                onClick={() => { if (!preparingFiles && !saving) fileInputRef.current?.click(); }}
                onKeyDown={(event) => {
                  if ((event.key === "Enter" || event.key === " ") && !preparingFiles && !saving) {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => { event.preventDefault(); if (!preparingFiles && !saving) setIsDragActive(true); }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsDragActive(false);
                }}
                onDrop={handlePhotoDrop}
                className={`flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed px-4 py-5 text-center text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[#4CAF50] ${preparingFiles || saving ? "cursor-not-allowed opacity-50" : "cursor-pointer"} ${isDragActive ? "border-[#4CAF50] bg-[#4CAF50]/10 text-white" : "border-white/15 bg-white/[0.025] text-white/65 hover:border-[#4CAF50]/50 hover:bg-[#4CAF50]/5 hover:text-white"}`}
              >
                {preparingFiles ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-5 w-5" aria-hidden="true" />}
                <span>{preparingFiles ? "Preparing photos…" : isDragActive ? "Drop photos to add them" : "Drop photos here or choose event photos"}</span>
                {!preparingFiles && <span className="text-xs font-normal text-white/40">JPEG, PNG, or WebP</span>}
              </div>

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
            <Button type="button" variant="ghost" onClick={() => { setEditorOpen(false); resetEditor(); }} disabled={saving} className="h-11 rounded-xl text-white/60 hover:bg-white/8 hover:text-white">Cancel</Button>
            <Button type="button" onClick={() => void (uploadAlbum ? uploadPhotosToAlbum() : saveAlbum())} disabled={saving || preparingFiles} className="h-11 rounded-xl px-5 font-semibold text-white" style={{ background: accent }}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
              {saving ? "Saving…" : uploadAlbum ? "Upload photos" : editingAlbum ? "Save changes" : "Publish album"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewer !== null} onOpenChange={(open) => { if (!open) setViewer(null); }}>
        <DialogContent showCloseButton={false} className="h-[100dvh] w-screen max-w-none gap-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white">
          <DialogTitle className="sr-only">{viewer?.album.title ?? "Album photo"}</DialogTitle>
          <DialogDescription className="sr-only">Full-screen club album photo viewer. Use the left and right arrow keys to navigate.</DialogDescription>
          {viewer && (currentPhoto || getCuratedClubAlbumCover(viewer.album.title) || viewer.album.coverImageUrl) && (
            <div className="relative flex h-full min-h-0 flex-col">
              <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent px-4 pb-10 pt-[calc(1rem+env(safe-area-inset-top,0px))] sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{viewer.album.title}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-white/60">{viewerCount ? `${viewer.index + 1} of ${viewerCount}` : "Album cover"}</p>
                </div>
                <div className="flex items-center gap-2">
                  {canUpload && isSharedCategoryAlbum(viewer.album.title) && (
                    <button type="button" onClick={() => { setViewer(null); openUpload(viewer.album); }} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#4CAF50] px-4 text-xs font-semibold text-white shadow-lg transition hover:bg-[#57bf59] focus:outline-none focus:ring-2 focus:ring-white" aria-label={`Upload photos to ${viewer.album.title}`}>
                      <ImagePlus className="h-4 w-4" aria-hidden="true" /> Upload photos
                    </button>
                  )}
                  {canManage && currentPhoto && (
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
                <img src={currentPhoto?.url ?? getCuratedClubAlbumCover(viewer.album.title) ?? viewer.album.coverImageUrl ?? ""} alt={currentPhoto?.altText || currentPhoto?.caption || `${viewer.album.title} album cover`} className="max-h-full max-w-full object-contain" />
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
                {currentPhoto?.caption && <p className="mx-auto max-w-2xl text-sm leading-relaxed text-white/85">{currentPhoto.caption}</p>}
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
