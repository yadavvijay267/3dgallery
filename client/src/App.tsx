import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SafeAreaTopScrim, fileToBase64 } from "@hatch/space-sdk/client";
import { actionFields } from "@hatch/space-sdk/fields" with { type: "macro" };
import type { Actions } from "../../server/src/actions";
import { api, type ApiResponse } from "./api";
import { GalleryScene, SLOT_COUNT } from "./GalleryScene";

const FIELDS = actionFields<typeof Actions>();

type Photo = ApiResponse<typeof api, "listPhotos">["photos"][number];

const MAX_BYTES = 10 * 1024 * 1024;

function readAspect(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 4 / 3);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(4 / 3);
    };
    img.src = url;
  });
}

const barButton =
  "inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-4 py-2 text-sm text-[#ece5d8] backdrop-blur transition hover:bg-black/75 disabled:cursor-not-allowed disabled:opacity-40";
const barButtonAccent =
  "inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-1.5 rounded-full border border-[#c9a35c] bg-[#c9a35c] px-4 py-2 text-sm font-semibold text-[#1c1710] backdrop-blur transition hover:bg-[#d8b56e]";

export function App() {
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<GalleryScene | null>(null);
  const photosRef = useRef<Photo[]>([]);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [manageOpen, setManageOpen] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [sceneError, setSceneError] = useState<string | null>(null);

  const photosQuery = useQuery({
    queryKey: ["photos"],
    queryFn: () => api.listPhotos({}),
  });
  const photos = photosQuery.data?.photos ?? [];
  photosRef.current = photos;

  const selectedIndex =
    selectedId === null ? -1 : photos.findIndex((p) => p.id === selectedId);
  const selectedPhoto = selectedIndex >= 0 ? photos[selectedIndex] : undefined;

  const addPhoto = useMutation({
    mutationFn: (args: {
      dataBase64: string;
      mimeType: string;
      caption: string;
      aspect: number;
    }) => api.addPhoto(args),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
    onError: (error) => {
      setUploadError(error.message);
    },
  });

  // Create the 3D scene once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const scene = new GalleryScene(
      container,
      {
        onSelect: (id) => {
          if (id !== null) setSelectedId(id);
        },
        onUserGesture: () => {
          setSelectedId(null);
          setAuto(false);
        },
        onError: (message) => setSceneError(message),
      },
      { reducedMotion: reduced },
    );
    sceneRef.current = scene;
    if (reduced) setAuto(false);
    scene.setPhotos(photosRef.current);
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Surface scene errors readably instead of a black canvas.
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (e.message) setSceneError(e.message);
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  useEffect(() => {
    sceneRef.current?.setPhotos(photos);
  }, [photos]);

  useEffect(() => {
    sceneRef.current?.focusIndex(selectedIndex >= 0 ? selectedIndex : null);
  }, [selectedIndex]);

  useEffect(() => {
    sceneRef.current?.setAutoRotate(auto);
  }, [auto]);

  // A deleted photo clears the selection.
  useEffect(() => {
    if (selectedId !== null && selectedIndex === -1 && photos.length >= 0) {
      if (photosQuery.data) setSelectedId(null);
    }
  }, [selectedId, selectedIndex, photos.length, photosQuery.data]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploadError(null);
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        setUploadError(`"${file.name}" photo nahi hai — sirf image file chalegi.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        setUploadError(`"${file.name}" 10 MB se badi hai — chhoti photo try karo.`);
        continue;
      }
      setUploadingName(file.name);
      try {
        const { dataBase64, mimeType } = await fileToBase64(file);
        const aspect = await readAspect(file);
        await addPhoto.mutateAsync({
          dataBase64,
          mimeType,
          caption: "",
          aspect,
        });
      } catch {
        // onError above already surfaced the message; keep uploading the rest.
      }
    }
    setUploadingName(null);
  }

  function step(dir: 1 | -1) {
    if (photos.length === 0) return;
    const cur = selectedIndex >= 0 ? selectedIndex : dir === 1 ? -1 : 0;
    const nextIdx = (cur + dir + photos.length) % photos.length;
    const target = photos[nextIdx];
    if (target) setSelectedId(target.id);
  }

  const isLoading = photosQuery.isPending;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[var(--bg)] text-[var(--text)]">
      <SafeAreaTopScrim backgroundColor="#141a17" />

      {/* 3D room */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Photo count chip */}
      <div className="pointer-events-none absolute left-3 top-3 pt-safe">
        <span className="inline-block rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs text-[#ece5d8] backdrop-blur">
          {isLoading
            ? "Gallery khul rahi hai…"
            : photos.length === 0
              ? "Abhi koi photo nahi"
              : `${photos.length} photo${photos.length > 1 ? "s" : ""} gallery me`}
        </span>
      </div>

      {/* Manage button */}
      <div className="absolute right-3 top-3 pt-safe">
        <button
          type="button"
          className={barButton}
          aria-expanded={manageOpen}
          onClick={() => setManageOpen((v) => !v)}
        >
          Photos manage karo
        </button>
      </div>

      {/* Scene error overlay */}
      {sceneError && (
        <div className="absolute inset-x-4 top-16 rounded-xl border border-[#e08a7a]/50 bg-[#2a1712]/95 p-3 text-sm text-[#f3c4b8]">
          Gallery me kuch gadbad hui: {sceneError}
          <button
            type="button"
            className="ml-3 underline"
            onClick={() => setSceneError(null)}
          >
            Band karo
          </button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && photos.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5">
          <div className="pointer-events-auto w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)]/92 p-6 text-center shadow-2xl backdrop-blur">
            <h1 className="font-display text-2xl text-[var(--text)]">
              Gallery abhi khaali hai
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--dim)]">
              Apni photos upload karo — wo is 3D hall ki deewaron par sunehri
              frame me lag jayengi. Phir andar ghum ke, har photo ke paas ja ke
              dekho.
            </p>
            <label htmlFor="photo-upload" className={`${barButtonAccent} mt-4`}>
              + Photo upload karo
            </label>
            <p className="mt-3 text-xs text-[var(--dim)]">
              JPG, PNG, WebP ya GIF — ek photo 10 MB tak
            </p>
          </div>
        </div>
      )}

      {/* Selected photo caption bar */}
      {selectedPhoto && !manageOpen && (
        <div className="absolute inset-x-0 bottom-44 flex justify-center px-4 sm:bottom-28">
          <div className="flex max-w-md items-center gap-3 rounded-full border border-white/15 bg-black/60 py-2 pl-5 pr-2 backdrop-blur">
            <span className="font-display text-sm italic text-[#ece5d8]">
              {selectedPhoto.caption.trim()
                ? selectedPhoto.caption
                : `Photo ${selectedIndex + 1}`}
            </span>
            <span className="text-xs text-white/60">
              {selectedIndex + 1} / {photos.length}
            </span>
            <button
              type="button"
              aria-label="Photo band karo"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-base text-white"
              onClick={() => setSelectedId(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Bottom control bar */}
      <div className="absolute inset-x-0 bottom-0 pb-safe">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-1.5 px-3 pb-3">
          {uploadError && (
            <p className="rounded-lg bg-[#2a1712]/90 px-3 py-1.5 text-center text-xs text-[#f3c4b8]">
              {uploadError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <input
              id="photo-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              aria-label="Photo upload karo"
              onChange={(e) => {
                void handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <label htmlFor="photo-upload" className={barButtonAccent}>
              {uploadingName ? `Upload ho raha hai…` : "+ Photo upload karo"}
            </label>
            <button
              type="button"
              className={barButton}
              aria-label="Pichli photo"
              disabled={photos.length === 0}
              onClick={() => step(-1)}
            >
              ← Pichli
            </button>
            <button
              type="button"
              className={barButton}
              aria-label="Agli photo"
              disabled={photos.length === 0}
              onClick={() => step(1)}
            >
              Agli →
            </button>
            {selectedId !== null && (
              <button
                type="button"
                className={barButton}
                onClick={() => setSelectedId(null)}
              >
                Poora hall
              </button>
            )}
            <button
              type="button"
              className={barButton}
              aria-pressed={auto}
              aria-label="Auto tour chalu ya band karo"
              onClick={() => setAuto((v) => !v)}
            >
              Auto tour: {auto ? "On" : "Off"}
            </button>
          </div>
          <p className="text-center text-[11px] text-white/55">
            Drag karke ghumao • Photo par tap karke paas se dekho
          </p>
        </div>
      </div>

      {/* Manage sheet */}
      {manageOpen && (
        <div className="absolute inset-x-0 bottom-0 max-h-[74vh] overflow-y-auto rounded-t-2xl border-t border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <div className="mx-auto max-w-2xl p-4 pb-safe">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg">Photos manage karo</h2>
              <button
                type="button"
                className="rounded-full border border-[var(--border)] px-3 py-1.5 text-sm"
                onClick={() => setManageOpen(false)}
              >
                Band karo
              </button>
            </div>
            {photos.length > SLOT_COUNT && (
              <p className="mt-2 text-xs text-[var(--dim)]">
                Deewaron par {SLOT_COUNT} frame hain — pehli {SLOT_COUNT} photos
                wahan lagi hain, baaki yahan list me hain.
              </p>
            )}
            {photos.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--dim)]">
                Abhi koi photo nahi hai. Neeche wale button se upload karo.
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {photos.map((photo, i) => (
                  <PhotoRow
                    key={photo.id}
                    photo={photo}
                    index={i}
                    onFocus={(id) => {
                      setSelectedId(id);
                      setManageOpen(false);
                    }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PhotoRow({
  photo,
  index,
  onFocus,
}: {
  photo: Photo;
  index: number;
  onFocus: (id: number) => void;
}) {
  const queryClient = useQueryClient();
  const [caption, setCaption] = useState(photo.caption);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const saveCaption = useMutation({
    mutationFn: () => api.updateCaption({ id: photo.id, caption }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      setRowError(null);
    },
    onError: (error) => setRowError(error.message),
  });

  const deletePhoto = useMutation({
    mutationFn: () => api.deletePhoto({ id: photo.id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["photos"] });
    },
    onError: (error) => setRowError(error.message),
  });

  return (
    <li className="flex gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-alt)] p-3">
      <img
        src={photo.url}
        alt={photo.caption.trim() ? photo.caption : `Photo ${index + 1}`}
        className="h-20 w-20 shrink-0 rounded-lg object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--dim)]">Photo {index + 1}</p>
        <div className="mt-1 flex gap-2">
          <input
            {...FIELDS.updateCaption.caption}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Caption likho…"
            aria-label={`Photo ${index + 1} ka caption`}
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)]"
          />
          <button
            type="button"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-semibold text-[#1c1710] disabled:opacity-50"
            disabled={saveCaption.isPending || caption === photo.caption}
            onClick={() => saveCaption.mutate()}
          >
            Save
          </button>
        </div>
        {rowError && (
          <p className="mt-1 text-xs text-[var(--danger)]">{rowError}</p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
            onClick={() => onFocus(photo.id)}
          >
            3D me dekho
          </button>
          {confirmDelete ? (
            <>
              <button
                type="button"
                className="rounded-lg bg-[#a03d2d] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                disabled={deletePhoto.isPending}
                onClick={() => deletePhoto.mutate()}
              >
                Pakka hatao
              </button>
              <button
                type="button"
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Rehne do
              </button>
            </>
          ) : (
            <button
              type="button"
              className="rounded-lg border border-[#a03d2d]/60 px-3 py-1.5 text-sm text-[#e8a294]"
              onClick={() => setConfirmDelete(true)}
            >
              Hatao
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
