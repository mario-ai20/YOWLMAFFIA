"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Image from "next/image";
import type { AgeMode, Language, ThemeChoice } from "@prisma/client";
import { getDictionary } from "@/lib/i18n";
import { storeLoginBackground } from "@/lib/login-preferences";

type ThreadSummary = {
  id: string;
  title: string;
  updatedAt: string;
  isNsfw: boolean;
  preview: string;
};

type ChatMessage = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
};

type SettingsData = {
  language: Language;
  theme: ThemeChoice;
  backgroundImage: string | null;
  loginBackground: string | null;
  introSound: string | null;
  backgroundSound: string | null;
  memoryEnabled: boolean;
  allowAdultMemory: boolean;
  nsfwPlusEnabled: boolean;
  parentalControl: boolean;
  personality: string;
  ageMode: AgeMode;
};

type Assets = {
  backgrounds: string[];
  loginBackgrounds: string[];
  introSounds: string[];
  backgroundSounds: string[];
};

type GitUpdateStatus = {
  available: boolean;
  branch: string | null;
  head: string | null;
  remoteHead: string | null;
  behind: number;
  ahead: number;
  dirty: boolean;
  canUpdate: boolean;
  reason: string | null;
};

type DetectedFace = {
  boundingBox: {
    width: number;
    height: number;
  };
};

type FaceDetectorLike = {
  detect: (input: HTMLCanvasElement) => Promise<DetectedFace[]>;
};

type WindowWithFaceDetector = Window & {
  FaceDetector?: new (options?: { fastMode?: boolean; maxDetectedFaces?: number }) => FaceDetectorLike;
};

const themeStyles: Record<
  ThemeChoice,
  {
    shell: string;
    sidebar: string;
    panel: string;
    line: string;
    muted: string;
    card: string;
    accent: string;
    assistantBubble: string;
    userBubble: string;
  }
> = {
  SUNSET: {
    shell: "linear-gradient(160deg, rgba(255,145,108,0.38), rgba(255,218,176,0.22) 36%, rgba(255,248,236,0.78) 80%)",
    sidebar: "bg-transparent text-[#f6ece8] border-[#44302a]",
    panel: "bg-transparent text-[#2f1a15] border-[#efc8b9]",
    line: "border-[#e8c2b2]",
    muted: "text-[#7d5c52]",
    card: "bg-[#fff2eb] border-[#e6beb0]",
    accent: "#df5f35",
    assistantBubble: "bg-[#fff2ea] border-[#f0cdc0]",
    userBubble: "bg-[#2a1b16] text-[#fff5f0]",
  },
  OCEAN: {
    shell: "linear-gradient(160deg, rgba(83,186,246,0.35), rgba(145,213,255,0.28) 36%, rgba(243,251,255,0.8) 80%)",
    sidebar: "bg-transparent text-[#e7f4ff] border-[#1f455f]",
    panel: "bg-transparent text-[#0b2335] border-[#a9d7f3]",
    line: "border-[#b6d9eb]",
    muted: "text-[#4a6c82]",
    card: "bg-[#ecf7ff] border-[#b8ddf3]",
    accent: "#1677be",
    assistantBubble: "bg-[#eaf7ff] border-[#b6ddf3]",
    userBubble: "bg-[#133146] text-[#f2f9ff]",
  },
  FOREST: {
    shell: "linear-gradient(160deg, rgba(126,185,103,0.3), rgba(194,225,149,0.26) 36%, rgba(249,255,239,0.78) 80%)",
    sidebar: "bg-transparent text-[#e8f6e1] border-[#31503b]",
    panel: "bg-transparent text-[#1e311f] border-[#b8d39f]",
    line: "border-[#c4dcaf]",
    muted: "text-[#536c52]",
    card: "bg-[#edf8e7] border-[#c5dfb0]",
    accent: "#2f7a2f",
    assistantBubble: "bg-[#eef9e8] border-[#c4e0ad]",
    userBubble: "bg-[#1f3a23] text-[#f4fff0]",
  },
  MIDNIGHT: {
    shell: "linear-gradient(155deg, rgba(48,68,121,0.5), rgba(18,34,69,0.58) 40%, rgba(11,19,38,0.82) 100%)",
    sidebar: "bg-transparent text-[#d8e8ff] border-[#213658]",
    panel: "bg-transparent text-[#e2edff] border-[#2a4369]",
    line: "border-[#2a4369]",
    muted: "text-[#8ca8cc]",
    card: "bg-[#15243bd9] border-[#2f4d74]",
    accent: "#43a8ff",
    assistantBubble: "bg-[#162940] border-[#2f5076]",
    userBubble: "bg-[#2d4f7a] text-[#f5faff]",
  },
};

function localeFromLanguage(language: Language): string {
  if (language === "FR") return "fr-FR";
  if (language === "DE") return "de-DE";
  if (language === "EL") return "el-GR";
  return "nl-BE";
}

function encodeAssetPath(assetPath: string): string {
  return assetPath
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function getDisplayFileName(assetPath: string): string {
  const parts = assetPath.split("/");
  return parts[parts.length - 1] ?? assetPath;
}

function isVideoFile(fileName: string): boolean {
  return /\.(mp4|webm|ogg)$/i.test(fileName);
}

function getVideoMimeType(fileName: string): string {
  if (/\.webm$/i.test(fileName)) {
    return "video/webm";
  }

  if (/\.ogg$/i.test(fileName)) {
    return "video/ogg";
  }

  return "video/mp4";
}

const MAX_INTRO_SOUND_SECONDS = 5;
const LEGACY_LOGIN_BACKGROUND_VALUES = new Set(["Intro 1.mp4", "Intro1.mp4"]);

function setDocumentIcon(href: string) {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel*="icon"]'));
  if (links.length === 0) {
    const link = document.createElement("link");
    link.rel = "icon";
    link.href = href;
    document.head.appendChild(link);
    return;
  }

  for (const link of links) {
    link.href = href;
  }
}

type BackgroundCategory = {
  key: string;
  label: string;
  order: number;
};

type BuilderDiagnostic = {
  label: string;
  value: string;
};

const backgroundCategories: BackgroundCategory[] = [
  { key: "standaard", label: "Standaard", order: 0 },
  { key: "intens", label: "Intens", order: 1 },
  { key: "space", label: "Space", order: 2 },
  { key: "the sun", label: "The Sun", order: 3 },
  { key: "the moon", label: "The Moon", order: 4 },
  { key: "the earth", label: "The Earth", order: 5 },
  { key: "nsfw", label: "NSFW", order: 6 },
  { key: "builder", label: "Builder", order: 7 },
  { key: "overig", label: "Overig", order: 99 },
];

function isNsfwBackground(filePath: string): boolean {
  const parts = filePath.split("/");
  const folderName = parts.length > 1 ? parts[0].toLowerCase() : "";
  const fileName = getDisplayFileName(filePath).toLowerCase();
  return folderName === "nsfw" || fileName.startsWith("nsfw");
}

function getBackgroundCategory(filePath: string): BackgroundCategory {
  const parts = filePath.split("/");
  const folderName = parts.length > 1 ? parts[0].toLowerCase() : "";
  const fileName = getDisplayFileName(filePath).toLowerCase();
  const categorySource = folderName || fileName;

  if (categorySource.startsWith("standaard")) {
    return backgroundCategories[0];
  }

  if (categorySource.startsWith("intens")) {
    return backgroundCategories[1];
  }

  if (categorySource.startsWith("space")) {
    return backgroundCategories[2];
  }

  if (categorySource.startsWith("the sun") || categorySource.startsWith("sun")) {
    return backgroundCategories[3];
  }

  if (categorySource.startsWith("the moon") || categorySource.startsWith("moon")) {
    return backgroundCategories[4];
  }

  if (categorySource.startsWith("the earth") || categorySource.startsWith("earth")) {
    return backgroundCategories[5];
  }

  if (categorySource.startsWith("nsfw")) {
    return backgroundCategories[6];
  }

  if (categorySource.startsWith("builder")) {
    return backgroundCategories[7];
  }

  return backgroundCategories[7];
}

export function ChatShell({
  userName,
  isBuilder,
  initialThreads,
  initialThreadId,
  initialMessages,
  initialSettings,
  assets,
}: {
  userName: string | null;
  isBuilder: boolean;
  initialThreads: ThreadSummary[];
  initialThreadId: string | null;
  initialMessages: ChatMessage[];
  initialSettings: SettingsData;
  assets: Assets;
}) {
  const [threads, setThreads] = useState<ThreadSummary[]>(initialThreads);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [query, setQuery] = useState("");
  const [messageInput, setMessageInput] = useState("");
  const [settings, setSettings] = useState<SettingsData>(initialSettings);
  const [assetState, setAssetState] = useState<Assets>(assets);
  const [showSettings, setShowSettings] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);
  const [showIntroOverlay, setShowIntroOverlay] = useState(true);
  const [introPlaybackBlocked, setIntroPlaybackBlocked] = useState(false);
  const [showNsfwVerifyModal, setShowNsfwVerifyModal] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saved">("idle");
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [gitUpdateStatus, setGitUpdateStatus] = useState<GitUpdateStatus | null>(null);
  const [gitUpdateLoading, setGitUpdateLoading] = useState(false);
  const [gitUpdateError, setGitUpdateError] = useState<string | null>(null);
  const [gitUpdateMessage, setGitUpdateMessage] = useState<string | null>(null);
  const [nsfwBirthDateCheck, setNsfwBirthDateCheck] = useState("");
  const [nsfwFaceVerified, setNsfwFaceVerified] = useState(false);
  const [nsfwSelfieDataUrl, setNsfwSelfieDataUrl] = useState<string | null>(null);
  const [nsfwVerifyError, setNsfwVerifyError] = useState<string | null>(null);
  const [nsfwFaceDetectionAvailable, setNsfwFaceDetectionAvailable] = useState(false);
  const [nsfwCameraReady, setNsfwCameraReady] = useState(false);
  const [nsfwLiveFaceDetected, setNsfwLiveFaceDetected] = useState(false);
  const [nsfwDetectedFacesCount, setNsfwDetectedFacesCount] = useState(0);
  const [nsfwCameraDevices, setNsfwCameraDevices] = useState<MediaDeviceInfo[]>([]);
  const [nsfwSelectedCameraId, setNsfwSelectedCameraId] = useState("");
  const [backgroundFilter, setBackgroundFilter] = useState("");
  const [loginBackgroundFilter, setLoginBackgroundFilter] = useState("");
  const [backgroundCategoryFilter, setBackgroundCategoryFilter] = useState<string>("all");
  const [settingsSearch, setSettingsSearch] = useState("");
  const [introSoundFilter, setIntroSoundFilter] = useState("");
  const [introSoundCategoryFilter, setIntroSoundCategoryFilter] = useState<"all" | "short" | "long">("all");
  const [backgroundSoundFilter, setBackgroundSoundFilter] = useState("");
  const [introSoundDurations, setIntroSoundDurations] = useState<Record<string, number | null>>({});
  const [builderNormalView, setBuilderNormalView] = useState(false);
  const [builderFps, setBuilderFps] = useState<number | null>(null);
  const [builderFpsSmoothed, setBuilderFpsSmoothed] = useState<number | null>(null);
  const [builderDiagnostics, setBuilderDiagnostics] = useState<BuilderDiagnostic[]>([]);

  const introAudioRef = useRef<HTMLAudioElement | null>(null);
  const bgAudioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const nsfwVideoRef = useRef<HTMLVideoElement | null>(null);
  const nsfwCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nsfwLiveDetectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nsfwStreamRef = useRef<MediaStream | null>(null);
  const nsfwFaceDetectorRef = useRef<FaceDetectorLike | null>(null);
  const introOverlayInitRef = useRef(false);
  const introPreviewInitRef = useRef(false);

  const t = useMemo(() => getDictionary(settings.language), [settings.language]);
  const palette = themeStyles[settings.theme];
  const builderPreviewAll = isBuilder && !builderNormalView;
  const builderMatrixActive = isBuilder && !builderNormalView;

  const selectedBackgroundImage =
    settings.backgroundImage &&
    (!isNsfwBackground(settings.backgroundImage) || settings.nsfwPlusEnabled || builderPreviewAll)
      ? settings.backgroundImage
      : null;
  const backgroundImageUrl = selectedBackgroundImage
    ? `/backgrounds/${encodeAssetPath(selectedBackgroundImage)}`
    : null;
  const introLogoUrl = "/intro-assets/feline%20kalebassen.jpg";
  const settingsQuery = settingsSearch.trim().toLowerCase();

  useEffect(() => {
    setDocumentIcon(introLogoUrl);
  }, [introLogoUrl]);

  const allowedBackgrounds = useMemo(() => {
    if (settings.nsfwPlusEnabled || builderPreviewAll) {
      return assetState.backgrounds;
    }

    return assetState.backgrounds.filter((file) => !isNsfwBackground(file));
  }, [assetState.backgrounds, builderPreviewAll, settings.nsfwPlusEnabled]);

  const filteredBackgrounds = useMemo(() => {
    const queryText = `${backgroundFilter} ${settingsQuery}`.trim().toLowerCase();
    const result = allowedBackgrounds.filter((file) => file.toLowerCase().includes(queryText));

    if (
      settings.backgroundImage &&
      (!isNsfwBackground(settings.backgroundImage) || settings.nsfwPlusEnabled || builderPreviewAll) &&
      !result.includes(settings.backgroundImage)
    ) {
      return [settings.backgroundImage, ...result];
    }

    return result;
  }, [allowedBackgrounds, backgroundFilter, builderPreviewAll, settings.backgroundImage, settings.nsfwPlusEnabled, settingsQuery]);

  const filteredLoginBackgrounds = useMemo(() => {
    const queryText = `${loginBackgroundFilter} ${settingsQuery}`.trim().toLowerCase();
    const result = assetState.loginBackgrounds.filter((file) => file.toLowerCase().includes(queryText));

    if (settings.loginBackground && !result.includes(settings.loginBackground)) {
      return [settings.loginBackground, ...result];
    }

    return result;
  }, [assetState.loginBackgrounds, loginBackgroundFilter, settings.loginBackground, settingsQuery]);

  const visibleBackgrounds = useMemo(() => {
    const activeBackgroundCategoryFilter =
      !settings.nsfwPlusEnabled && !builderPreviewAll && backgroundCategoryFilter === "nsfw"
        ? "all"
        : backgroundCategoryFilter;

    if (activeBackgroundCategoryFilter === "all") {
      return filteredBackgrounds;
    }

    return filteredBackgrounds.filter((file) => getBackgroundCategory(file).key === activeBackgroundCategoryFilter);
  }, [backgroundCategoryFilter, builderPreviewAll, filteredBackgrounds, settings.nsfwPlusEnabled]);

  const visibleBackgroundCategories = useMemo(
    () => backgroundCategories.filter((category) => category.key !== "nsfw" || settings.nsfwPlusEnabled || builderPreviewAll),
    [builderPreviewAll, settings.nsfwPlusEnabled],
  );

  const backgroundSections = useMemo(() => {
    const sectionMap = new Map<string, { label: string; order: number; files: string[] }>();

    for (const file of visibleBackgrounds) {
      const category = getBackgroundCategory(file);
      const existing = sectionMap.get(category.key);

      if (existing) {
        existing.files.push(file);
        continue;
      }

      sectionMap.set(category.key, {
        label: category.label,
        order: category.order,
        files: [file],
      });
    }

    return Array.from(sectionMap.values())
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
      .filter((section) => section.files.length > 0);
  }, [visibleBackgrounds]);

  const builderBackgroundSections = useMemo(() => {
    if (!isBuilder) {
      return [];
    }

    return backgroundSections.filter((section) => section.label.toLowerCase().startsWith("builder"));
  }, [backgroundSections, isBuilder]);

  const builderBackgrounds = useMemo(
    () => builderBackgroundSections.flatMap((section) => section.files),
    [builderBackgroundSections],
  );

  const makeBuilderHex = useCallback((length: number) => {
    const chars = "0123456789ABCDEF";
    let out = "";
    for (let i = 0; i < length; i += 1) {
      out += chars[Math.floor(Math.random() * chars.length)] ?? "0";
    }
    return out;
  }, []);

  const makeBuilderCode = useCallback(
    (prefix: string) => `${prefix}-${makeBuilderHex(4)}-${makeBuilderHex(4)}`,
    [makeBuilderHex],
  );

  const selectedLoginBackground = useMemo(
    () =>
      settings.loginBackground && !LEGACY_LOGIN_BACKGROUND_VALUES.has(settings.loginBackground)
        ? settings.loginBackground
        : "Standaard.mp4",
    [settings.loginBackground],
  );

  const filteredIntroSounds = useMemo(() => {
    const queryText = `${introSoundFilter} ${settingsQuery}`.trim().toLowerCase();
    const result = assetState.introSounds.filter((file) => file.toLowerCase().includes(queryText));

    if (settings.introSound && !result.includes(settings.introSound)) {
      return [settings.introSound, ...result];
    }

    return result;
  }, [assetState.introSounds, introSoundFilter, settings.introSound, settingsQuery]);

  const visibleIntroSounds = useMemo(() => {
    const bucketed = filteredIntroSounds.filter((file) => {
      const duration = introSoundDurations[file];

      if (introSoundCategoryFilter === "short") {
        return typeof duration !== "number" || duration <= MAX_INTRO_SOUND_SECONDS;
      }

      if (introSoundCategoryFilter === "long") {
        return typeof duration === "number" && duration > MAX_INTRO_SOUND_SECONDS;
      }

      return true;
    });

    if (settings.introSound && !bucketed.includes(settings.introSound)) {
      return [settings.introSound, ...bucketed];
    }

    return bucketed;
  }, [filteredIntroSounds, introSoundCategoryFilter, introSoundDurations, settings.introSound]);

  const filteredBackgroundSounds = useMemo(() => {
    const queryText = `${backgroundSoundFilter} ${settingsQuery}`.trim().toLowerCase();
    const result = assetState.backgroundSounds.filter((file) => file.toLowerCase().includes(queryText));

    if (settings.backgroundSound && !result.includes(settings.backgroundSound)) {
      return [settings.backgroundSound, ...result];
    }

    return result;
  }, [assetState.backgroundSounds, backgroundSoundFilter, settings.backgroundSound, settingsQuery]);

  useEffect(() => {
    let cancelled = false;

    const missingIntroSounds = assetState.introSounds.filter((file) => introSoundDurations[file] === undefined);
    if (missingIntroSounds.length === 0) {
      return undefined;
    }

    for (const file of missingIntroSounds) {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = `/intro-music/${encodeAssetPath(file)}`;

      const handleLoaded = () => {
        if (cancelled) return;
        setIntroSoundDurations((prev) => (prev[file] === undefined ? { ...prev, [file]: audio.duration } : prev));
      };

      const handleError = () => {
        if (cancelled) return;
        setIntroSoundDurations((prev) => (prev[file] === undefined ? { ...prev, [file]: null } : prev));
      };

      audio.addEventListener("loadedmetadata", handleLoaded, { once: true });
      audio.addEventListener("error", handleError, { once: true });
      audio.load();
    }

    return () => {
      cancelled = true;
    };
  }, [assetState.introSounds, introSoundDurations]);

  const playIntroAudio = useCallback(async () => {
    const introAudio = introAudioRef.current;
    if (!settings.introSound || !introAudio) {
      return false;
    }

    try {
      introAudio.currentTime = 0;
      await introAudio.play();
      setIntroPlaybackBlocked(false);
      return true;
    } catch {
      setIntroPlaybackBlocked(true);
      return false;
    }
  }, [settings.introSound]);

  useEffect(() => {
    document.documentElement.lang = settings.language.toLowerCase();
  }, [settings.language]);

  useEffect(() => {
    if (!isBuilder) {
      return undefined;
    }

    let rafId = 0;
    let frameCount = 0;
    let lastSample = performance.now();

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastSample;

      if (elapsed >= 1000) {
        const rawFps = Math.round((frameCount * 1000) / elapsed);
        setBuilderFps(rawFps);
        setBuilderFpsSmoothed((prev) => {
          if (prev === null) {
            return rawFps;
          }

          return Math.round(prev * 0.7 + rawFps * 0.3);
        });
        frameCount = 0;
        lastSample = now;
      }

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => window.cancelAnimationFrame(rafId);
  }, [isBuilder]);

  useEffect(() => {
    if (!isBuilder) {
      return undefined;
    }

    const refreshDiagnostics = () => {
      const now = new Date();
      const sequence = [
        { label: "SYS", value: makeBuilderCode("SYNC") },
        { label: "DB", value: `${makeBuilderCode("DB")} / ${now.getSeconds().toString().padStart(2, "0")}s` },
        { label: "ROUTE", value: makeBuilderCode("API") },
        { label: "CACHE", value: makeBuilderCode("MEM") },
        { label: "TRACE", value: `${makeBuilderCode("TRACE")} @ ${now.toLocaleTimeString("nl-BE", { hour12: false })}` },
      ];

      setBuilderDiagnostics(sequence);
    };

    refreshDiagnostics();
    const timer = window.setInterval(refreshDiagnostics, 950);
    return () => window.clearInterval(timer);
  }, [isBuilder, makeBuilderCode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  useEffect(() => {
    if (introOverlayInitRef.current) {
      return;
    }

    introOverlayInitRef.current = true;

    let isClosed = false;
    const finishIntro = () => {
      if (!isClosed) {
        setShowIntroOverlay(false);
      }
    };

    const fallbackTimeout = window.setTimeout(
      finishIntro,
      settings.introSound ? 6500 : 1200,
    );

    const introAudio = introAudioRef.current;
    let handleEnded: (() => void) | null = null;

    if (settings.introSound && introAudio) {
      handleEnded = () => finishIntro();
      introAudio.addEventListener("ended", handleEnded);
      introAudio.preload = "auto";
      void playIntroAudio().catch(() => {
        window.setTimeout(finishIntro, 1400);
      });
    }

    return () => {
      isClosed = true;
      window.clearTimeout(fallbackTimeout);
      if (handleEnded && introAudio) {
        introAudio.removeEventListener("ended", handleEnded);
      }
    };
  }, [playIntroAudio, settings.introSound]);

  useEffect(() => {
    if (!introPreviewInitRef.current) {
      introPreviewInitRef.current = true;
      return;
    }

    if (!settings.introSound || !introAudioRef.current) {
      return;
    }

    void playIntroAudio().catch(() => {
      // Browsers can block autoplay. This is safe to ignore.
    });
  }, [playIntroAudio, settings.introSound]);

  useEffect(() => {
    if (!bgAudioRef.current) {
      return;
    }

    if (!settings.backgroundSound) {
      bgAudioRef.current.pause();
      return;
    }

    bgAudioRef.current.volume = 0.35;
    void bgAudioRef.current.play().catch(() => {
      // Browsers can block autoplay. This is safe to ignore.
    });
  }, [settings.backgroundSound]);

  const refreshAssets = useCallback(async () => {
    try {
      const response = await fetch("/api/settings", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { assets?: Assets };
      if (payload.assets) {
        setAssetState(payload.assets);
      }
    } catch {
      // Keep existing lists if refresh fails.
    }
  }, []);

  const refreshGitUpdateStatus = useCallback(async () => {
    setGitUpdateLoading(true);
    setGitUpdateError(null);
    setGitUpdateMessage(null);

    try {
      const response = await fetch("/api/update", {
        method: "GET",
        cache: "no-store",
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: GitUpdateStatus; error?: string }
        | null;

      if (!response.ok) {
        setGitUpdateError(payload?.error ?? "GitHub-status kon niet worden opgehaald.");
        return;
      }

      if (payload?.status) {
        setGitUpdateStatus(payload.status);
      }
    } catch {
      setGitUpdateError("GitHub-status kon niet worden opgehaald.");
    } finally {
      setGitUpdateLoading(false);
    }
  }, []);

  const applyGitUpdate = useCallback(async () => {
    setGitUpdateLoading(true);
    setGitUpdateError(null);
    setGitUpdateMessage(null);

    try {
      const response = await fetch("/api/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const payload = (await response.json().catch(() => null)) as
        | { status?: GitUpdateStatus; output?: string; error?: string }
        | null;

      if (!response.ok) {
        setGitUpdateError(payload?.error ?? "Update kon niet worden uitgevoerd.");
        return;
      }

      if (payload?.status) {
        setGitUpdateStatus(payload.status);
      }

      setGitUpdateMessage(payload?.output ?? "Update voltooid.");
      window.setTimeout(() => window.location.reload(), 1200);
    } catch {
      setGitUpdateError("Update kon niet worden uitgevoerd.");
    } finally {
      setGitUpdateLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!showSettings) {
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshGitUpdateStatus();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [refreshGitUpdateStatus, showSettings]);

  const ensureFaceDetector = useCallback((): FaceDetectorLike | null => {
    if (nsfwFaceDetectorRef.current) {
      return nsfwFaceDetectorRef.current;
    }

    const faceDetectorCtor = (window as WindowWithFaceDetector).FaceDetector;
    if (!faceDetectorCtor) {
      return null;
    }

    nsfwFaceDetectorRef.current = new faceDetectorCtor({
      fastMode: false,
      maxDetectedFaces: 3,
    });

    return nsfwFaceDetectorRef.current;
  }, []);

  const detectFacesFromCanvas = useCallback(async (canvas: HTMLCanvasElement): Promise<DetectedFace[]> => {
    const detector = ensureFaceDetector();
    if (!detector) {
      return [];
    }

    try {
      const faces = await detector.detect(canvas);
      return faces;
    } catch {
      return [];
    }
  }, [ensureFaceDetector]);

  useEffect(() => {
    if (!showNsfwVerifyModal) {
      if (nsfwStreamRef.current) {
        for (const track of nsfwStreamRef.current.getTracks()) {
          track.stop();
        }
        nsfwStreamRef.current = null;
      }
      return;
    }

    let cancelled = false;
    let detectIntervalId: number | null = null;

    async function startCamera() {
      const detector = ensureFaceDetector();
      const canDetectFaces = Boolean(detector);
      setNsfwFaceDetectionAvailable(canDetectFaces);

      if (!navigator.mediaDevices?.getUserMedia) {
        setNsfwVerifyError("Camera wordt niet ondersteund op dit toestel.");
        return;
      }

      try {
        const usePreferredCamera = Boolean(nsfwSelectedCameraId);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: usePreferredCamera
            ? {
                deviceId: { exact: nsfwSelectedCameraId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              }
            : {
                facingMode: "user",
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) {
            track.stop();
          }
          return;
        }

        nsfwStreamRef.current = stream;
        if (nsfwVideoRef.current) {
          nsfwVideoRef.current.srcObject = stream;
          await nsfwVideoRef.current.play().catch(() => {
            // Some browsers require user interaction before play.
          });
        }
        setNsfwCameraReady(true);

        const videoTrack = stream.getVideoTracks()[0];
        const currentDeviceId = videoTrack?.getSettings().deviceId ?? nsfwSelectedCameraId;
        if (currentDeviceId && currentDeviceId !== nsfwSelectedCameraId) {
          setNsfwSelectedCameraId(currentDeviceId);
        }

        if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!cancelled) {
            const videoDevices = devices.filter((device) => device.kind === "videoinput");
            setNsfwCameraDevices(videoDevices);

            if (!nsfwSelectedCameraId && currentDeviceId) {
              setNsfwSelectedCameraId(currentDeviceId);
            }
          }
        }

        if (canDetectFaces) {
          detectIntervalId = window.setInterval(async () => {
            const video = nsfwVideoRef.current;
            const liveCanvas = nsfwLiveDetectCanvasRef.current;
            if (!video || !liveCanvas || video.videoWidth === 0 || video.videoHeight === 0) {
              return;
            }

            liveCanvas.width = video.videoWidth;
            liveCanvas.height = video.videoHeight;
            const context = liveCanvas.getContext("2d");
            if (!context) {
              return;
            }

            context.drawImage(video, 0, 0, liveCanvas.width, liveCanvas.height);
            const faces = await detectFacesFromCanvas(liveCanvas);
            const hasValidFace = faces.some(
              (face) => face.boundingBox.width >= 90 && face.boundingBox.height >= 90,
            );

            setNsfwDetectedFacesCount(faces.length);
            setNsfwLiveFaceDetected(hasValidFace);
          }, 650);
        } else {
          setNsfwDetectedFacesCount(0);
          setNsfwLiveFaceDetected(false);
          setNsfwVerifyError(null);
        }
      } catch {
        if (nsfwSelectedCameraId) {
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
              audio: false,
            });

            if (cancelled) {
              for (const track of fallbackStream.getTracks()) {
                track.stop();
              }
              return;
            }

            nsfwStreamRef.current = fallbackStream;
            if (nsfwVideoRef.current) {
              nsfwVideoRef.current.srcObject = fallbackStream;
              await nsfwVideoRef.current.play().catch(() => {
                // Some browsers require user interaction before play.
              });
            }
            setNsfwSelectedCameraId("");
            setNsfwCameraReady(true);
            setNsfwVerifyError("Gekozen camera niet beschikbaar, standaardcamera gebruikt.");
            return;
          } catch {
            // Fall through to generic error below.
          }
        }
        setNsfwVerifyError("Ik krijg geen toegang tot je camera voor gezichtsverificatie.");
      }
    }

    void startCamera();

    return () => {
      cancelled = true;
      if (detectIntervalId !== null) {
        window.clearInterval(detectIntervalId);
      }
      setNsfwCameraReady(false);
      if (nsfwStreamRef.current) {
        for (const track of nsfwStreamRef.current.getTracks()) {
          track.stop();
        }
        nsfwStreamRef.current = null;
      }
    };
  }, [detectFacesFromCanvas, ensureFaceDetector, nsfwSelectedCameraId, showNsfwVerifyModal]);

  useEffect(() => {
    const handle = setTimeout(async () => {
      const response = await fetch(`/api/chats?query=${encodeURIComponent(query)}`);
      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as { threads: ThreadSummary[] };
      setThreads(payload.threads);
    }, 250);

    return () => clearTimeout(handle);
  }, [query]);

  async function loadThread(threadId: string) {
    const response = await fetch(`/api/chats/${threadId}`);
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      thread: {
        messages: ChatMessage[];
      };
    };

    setSelectedThreadId(threadId);
    setMessages(payload.thread.messages);
  }

  async function createNewChat() {
    const response = await fetch("/api/chats", { method: "POST" });
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as {
      thread: { id: string; title: string; updatedAt: string; isNsfw: boolean };
    };

    const nextThread: ThreadSummary = {
      id: payload.thread.id,
      title: payload.thread.title,
      updatedAt: payload.thread.updatedAt,
      isNsfw: payload.thread.isNsfw,
      preview: "",
    };

    setThreads((prev) => [nextThread, ...prev]);
    setSelectedThreadId(payload.thread.id);
    setMessages([]);
    setQuery("");
  }

  async function refreshThreads() {
    const response = await fetch("/api/chats");
    if (!response.ok) return;
    const payload = (await response.json()) as { threads: ThreadSummary[] };
    setThreads(payload.threads);
    const nextSelected = payload.threads.find((thread) => thread.id === selectedThreadId) ?? payload.threads[0] ?? null;

    if (nextSelected) {
      setSelectedThreadId(nextSelected.id);
      await loadThread(nextSelected.id);
    } else {
      setSelectedThreadId(null);
      setMessages([]);
    }
  }

  async function deleteThread(threadId: string) {
    if (deletingThreadId) {
      return;
    }

    const thread = threads.find((item) => item.id === threadId);
    const threadTitle = thread?.title ?? "deze chat";
    const confirmed = window.confirm(`Wil je "${threadTitle}" verwijderen?`);

    if (!confirmed) {
      return;
    }

    setDeletingThreadId(threadId);

    try {
      const response = await fetch(`/api/chats/${threadId}`, { method: "DELETE" });
      if (!response.ok) {
        return;
      }

      const remaining = threads.filter((item) => item.id !== threadId);
      setThreads(remaining);

      if (selectedThreadId === threadId) {
        const nextId = remaining[0]?.id ?? null;

        if (!nextId) {
          setSelectedThreadId(null);
          setMessages([]);
          return;
        }

        await loadThread(nextId);
      }
    } finally {
      setDeletingThreadId(null);
    }
  }

  async function sendMessage() {
    if (!selectedThreadId || !messageInput.trim() || isSending) {
      return;
    }

    const content = messageInput.trim();
    setMessageInput("");
    setIsSending(true);

    const optimisticMessage: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "USER",
      content,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);

    const response = await fetch(`/api/chats/${selectedThreadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });

    if (response.ok) {
      const payload = (await response.json()) as { message: ChatMessage };
      setMessages((prev) => [...prev, payload.message]);
      await refreshThreads();
    }

    setIsSending(false);
  }

  async function saveSettings(snapshot: SettingsData = settings) {
    setIsSaving(true);
    setSettingsError(null);
    const nsfwModeChanged = snapshot.nsfwPlusEnabled !== settings.nsfwPlusEnabled;

    if (snapshot.introSound) {
      const introDuration = introSoundDurations[snapshot.introSound];
      if (typeof introDuration === "number" && introDuration > MAX_INTRO_SOUND_SECONDS) {
        setSettingsError(`Intro sound mag maximaal ${MAX_INTRO_SOUND_SECONDS} seconden zijn.`);
        setIsSaving(false);
        return;
      }
    }

    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...snapshot,
        nsfwBirthDateCheck,
        nsfwFaceVerified,
      }),
    });

    if (response.ok) {
      storeLoginBackground(snapshot.loginBackground ?? "Standaard.mp4");
      if (nsfwModeChanged) {
        await refreshThreads();
      }
      setSaveState("saved");
      if (!snapshot.nsfwPlusEnabled) {
        setNsfwBirthDateCheck("");
        setNsfwFaceVerified(false);
        setNsfwSelfieDataUrl(null);
      }
      setTimeout(() => setSaveState("idle"), 1400);
    } else {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      setSettingsError(payload?.error ?? "Instellingen konden niet opgeslagen worden.");
    }

    setIsSaving(false);
  }

  function openNsfwVerificationModal() {
    setNsfwVerifyError(null);
    setNsfwBirthDateCheck("");
    setNsfwFaceVerified(false);
    setNsfwSelfieDataUrl(null);
    setNsfwCameraReady(false);
    setNsfwFaceDetectionAvailable(false);
    setNsfwLiveFaceDetected(false);
    setNsfwDetectedFacesCount(0);
    setNsfwCameraDevices([]);
    setNsfwSelectedCameraId("");
    setShowNsfwVerifyModal(true);
  }

  function cancelNsfwVerificationModal() {
    setShowNsfwVerifyModal(false);
    setNsfwVerifyError(null);
    setNsfwBirthDateCheck("");
    setNsfwFaceVerified(false);
    setNsfwSelfieDataUrl(null);
    setNsfwCameraReady(false);
    setNsfwFaceDetectionAvailable(false);
    setNsfwLiveFaceDetected(false);
    setNsfwDetectedFacesCount(0);
    setNsfwCameraDevices([]);
    setNsfwSelectedCameraId("");
  }

  async function captureNsfwSelfie() {
    const video = nsfwVideoRef.current;
    const canvas = nsfwCanvasRef.current;

    if (!video || !canvas || video.videoWidth === 0 || video.videoHeight === 0) {
      setNsfwVerifyError("Camera is nog niet klaar. Probeer opnieuw.");
      return;
    }

    if (nsfwFaceDetectionAvailable && !nsfwLiveFaceDetected) {
      setNsfwVerifyError("Geen duidelijk gezicht gedetecteerd. Kijk recht in de camera.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setNsfwVerifyError("Selfie kon niet verwerkt worden.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    if (nsfwFaceDetectionAvailable) {
      const faces = await detectFacesFromCanvas(canvas);
      const hasValidFace = faces.some(
        (face) => face.boundingBox.width >= 90 && face.boundingBox.height >= 90,
      );

      setNsfwDetectedFacesCount(faces.length);
      if (!hasValidFace) {
        setNsfwFaceVerified(false);
        setNsfwSelfieDataUrl(null);
        setNsfwVerifyError("Selfie afgekeurd: er moet een duidelijk gezicht zichtbaar zijn.");
        return;
      }
    }

    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    setNsfwSelfieDataUrl(dataUrl);
    setNsfwFaceVerified(true);
    setNsfwVerifyError(null);
  }

  function confirmNsfwVerificationModal() {
    if (!nsfwBirthDateCheck) {
      setNsfwVerifyError("Vul je geboortedatum in.");
      return;
    }

    if (!nsfwFaceVerified) {
      setNsfwVerifyError("Neem eerst een selfie voor gezichtsverificatie.");
      return;
    }

    if (nsfwFaceDetectionAvailable && !nsfwLiveFaceDetected) {
      setNsfwVerifyError("Live gezichtsdetectie is niet actief. Kijk in de camera en probeer opnieuw.");
      return;
    }

    setSettings((prev) => ({
      ...prev,
      nsfwPlusEnabled: true,
      parentalControl: false,
    }));

    setShowNsfwVerifyModal(false);
    setNsfwVerifyError(null);
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        backgroundImage: backgroundImageUrl
          ? `${palette.shell}, url('${backgroundImageUrl}')`
          : palette.shell,
        backgroundSize: backgroundImageUrl ? "cover, cover" : "cover",
        backgroundPosition: backgroundImageUrl ? "center, center" : "center",
        backgroundRepeat: backgroundImageUrl ? "no-repeat, no-repeat" : "no-repeat",
      }}
    >
      {builderMatrixActive && (
        <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(105,255,199,0.2),transparent_34%),linear-gradient(180deg,rgba(2,8,23,0.92),rgba(9,14,26,0.94))]" />
          <div className="absolute inset-0 builder-code-grid opacity-65" />
          <div className="absolute inset-0 builder-code-rain opacity-40" />
          <div className="absolute left-4 top-4 flex flex-col gap-2 sm:left-6 sm:top-6">
            {builderDiagnostics.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-emerald-300/25 bg-slate-950/55 px-3 py-2 text-[11px] text-emerald-100 shadow-2xl backdrop-blur-sm"
              >
                <div className="font-semibold tracking-[0.24em] text-emerald-300/80">{item.label}</div>
                <div className="mt-1 font-mono text-[10px] leading-4 text-emerald-50/90">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showIntroOverlay && (
        <div className="absolute inset-0 z-40 grid place-items-center bg-black/55 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-3xl bg-black/45 px-8 py-7 text-white">
            <div className="relative h-28 w-28 overflow-hidden rounded-2xl border border-white/30">
              <Image src={introLogoUrl} alt="Feline intro" fill sizes="112px" className="object-cover" />
            </div>
            <p className="font-title text-2xl">Feline wordt wakker...</p>
            <div className="feline-typing text-white">
              <span />
              <span />
              <span />
            </div>
            {introPlaybackBlocked && settings.introSound && (
              <button
                type="button"
                onClick={() => {
                  void playIntroAudio();
                }}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:scale-[1.02]"
              >
                Speel intro af
              </button>
            )}
          </div>
        </div>
      )}

      <div className="relative mx-auto grid min-h-screen max-w-[1500px] grid-cols-1 gap-3 p-3 lg:grid-cols-[300px_1fr]">
        <aside
          className={`feline-rise rounded-3xl p-4 ${palette.sidebar}`}
          style={{ animationDelay: "40ms" }}
        >
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 overflow-hidden rounded-xl border border-white/25 bg-white/10">
              <Image src={introLogoUrl} alt="Feline logo" fill sizes="44px" className="object-contain" unoptimized />
            </div>
            <div>
              <h1 className="font-title text-2xl leading-tight">Feline AI</h1>
              <p className="truncate text-xs text-white/70">{userName ?? "Gebruiker"}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={createNewChat}
            className="mt-4 w-full rounded-xl px-3 py-2 text-left font-semibold text-white transition hover:translate-y-[-1px]"
            style={{ backgroundColor: palette.accent }}
          >
            + {t.newChat}
          </button>

          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.searchChats}
            className="mt-3 w-full rounded-xl bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/45 outline-none ring-white/30 focus:ring"
          />

          <h2 className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/60">{t.recentChats}</h2>

          <div className="mt-2 space-y-2 overflow-y-auto pb-2">
            {threads.length === 0 && (
              <p className="rounded-xl border border-dashed border-white/25 px-3 py-2 text-sm text-white/65">
                {t.noChats}
              </p>
            )}

            {threads.map((thread) => {
              const selected = selectedThreadId === thread.id;
              const deleting = deletingThreadId === thread.id;

              return (
                <div
                  key={thread.id}
                  className={`group flex items-center gap-2 rounded-xl px-2 py-2 transition ${
                    selected ? "bg-white/20" : "bg-black/20 hover:bg-white/10"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => loadThread(thread.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-semibold text-white">{thread.title}</p>
                    <p className="truncate text-xs text-white/60">{thread.preview || "..."}</p>
                  </button>

                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void deleteThread(thread.id);
                    }}
                    disabled={Boolean(deletingThreadId)}
                    aria-label={`Verwijder ${thread.title}`}
                    title="Verwijder chat"
                    className="grid h-8 w-8 place-items-center rounded-lg bg-black/30 text-white/80 transition hover:bg-red-500/80 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deleting ? (
                      <span className="text-xs">...</span>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <section
          className={`relative z-10 feline-rise flex min-h-[88vh] flex-col rounded-3xl ${palette.panel}`}
          style={{ animationDelay: "100ms" }}
        >
          <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-title text-2xl">{t.appName}</p>
              <p className={`text-xs uppercase tracking-[0.14em] ${palette.muted}`}>Ollama llama3.1</p>
            </div>

            <div className="flex gap-2">
              {isBuilder && (
                <span className="builder-fps-badge rounded-xl bg-black/70 px-3 py-2 text-sm font-semibold text-white">
                  FPS {builderFpsSmoothed ?? builderFps ?? "…"}
                </span>
              )}
              {isBuilder && (
                <button
                  type="button"
                  onClick={() => setBuilderNormalView((prev) => !prev)}
                  className="rounded-xl bg-white/80 px-3 py-2 text-sm font-semibold text-black transition hover:scale-[1.02]"
                  title={builderNormalView ? "Schakel naar builder-overzicht" : "Schakel naar normale weergave"}
                >
                  {builderNormalView ? "Builder: alles" : "Builder: normaal"}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const next = !showSettings;
                  if (next) {
                    void refreshAssets();
                  }
                  setShowSettings(next);
                }}
                aria-label={t.settings}
                title={t.settings}
                className="grid h-11 w-11 place-items-center rounded-full bg-white/75 text-black transition hover:scale-[1.03]"
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
                  <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .5-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.5H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.4.1Z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => signOut()}
                className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                {t.logout}
              </button>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-4xl space-y-4">
              {messages.length === 0 && (
                <div className={`rounded-2xl border border-dashed p-7 text-center text-sm ${palette.line} ${palette.muted}`}>
                  {t.noMessages}
                </div>
              )}

              {messages.map((message, index) => {
                const isUser = message.role === "USER";
                return (
                  <article
                    key={message.id}
                    className={`feline-rise flex ${isUser ? "justify-end" : "justify-start"}`}
                    style={{ animationDelay: `${Math.min(index * 45, 320)}ms` }}
                  >
                    <div
                      className={`max-w-[92%] rounded-2xl border px-4 py-3 shadow-md sm:max-w-[80%] ${
                        isUser ? palette.userBubble : palette.assistantBubble
                      }`}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                      <time className="mt-2 block text-[10px] opacity-65">
                        {new Date(message.createdAt).toLocaleString(localeFromLanguage(settings.language))}
                      </time>
                    </div>
                  </article>
                );
              })}

              {isSending && (
                <article className="feline-rise flex justify-start" style={{ animationDelay: "90ms" }}>
                  <div className={`rounded-2xl border px-4 py-3 shadow-md ${palette.assistantBubble}`}>
                    <div className="feline-typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <footer className="px-4 py-3 sm:px-6">
            <div className="mx-auto flex w-full max-w-4xl gap-2 rounded-2xl bg-white/65 p-2 backdrop-blur-sm">
              <textarea
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                rows={2}
                placeholder={t.typeMessage}
                className="w-full resize-none rounded-xl bg-transparent px-3 py-2 outline-none ring-orange-300 focus:ring"
              />
              <button
                type="button"
                onClick={sendMessage}
                disabled={isSending || !selectedThreadId}
                className="rounded-xl px-4 py-2 font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-gray-400"
                style={{ backgroundColor: palette.accent }}
              >
                {isSending ? "..." : t.send}
              </button>
            </div>
          </footer>

          {showSettings && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/35"
                onClick={() => setShowSettings(false)}
                aria-label="Close settings backdrop"
              />
              <aside className="fixed inset-x-4 bottom-4 top-4 z-50 ml-auto w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-black/15 bg-white/96 p-4 shadow-2xl feline-rise touch-pan-y">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="font-title text-2xl">{t.settings}</h3>
                  <button
                    type="button"
                    onClick={() => {
                      void refreshAssets();
                    }}
                    className="rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold hover:bg-black/5"
                  >
                    Mappen vernieuwen
                  </button>
                </div>

                <input
                  value={settingsSearch}
                  onChange={(event) => setSettingsSearch(event.target.value)}
                  placeholder="Zoek in instellingen..."
                  className="mb-3 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm"
                />

                <div className="mt-3 grid gap-3">
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.language}</span>
                    <select
                      value={settings.language}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          language: event.target.value as Language,
                        }))
                      }
                      className="w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    >
                      <option value="NL">Nederlands</option>
                      <option value="FR">Francais</option>
                      <option value="DE">Deutsch</option>
                      <option value="EL">Greek</option>
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.theme}</span>
                    <select
                      value={settings.theme}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          theme: event.target.value as ThemeChoice,
                        }))
                      }
                      className="w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    >
                      {Object.entries(t.themes).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.background}</span>
                    <input
                      value={backgroundFilter}
                      onChange={(event) => setBackgroundFilter(event.target.value)}
                      placeholder={t.searchFiles}
                      className="mb-2 w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    />
                    <div className="mb-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setBackgroundCategoryFilter("all")}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                          backgroundCategoryFilter === "all"
                            ? "border-black/40 bg-black/10"
                            : "border-black/15 bg-white hover:bg-black/5"
                        }`}
                      >
                        Alle
                      </button>
                      {visibleBackgroundCategories
                        .filter((category) => category.key !== "overig" || filteredBackgrounds.length > 0)
                        .map((category) => (
                          <button
                            key={category.key}
                            type="button"
                            onClick={() => setBackgroundCategoryFilter(category.key)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                              backgroundCategoryFilter === category.key
                                ? "border-black/40 bg-black/10"
                                : "border-black/15 bg-white hover:bg-black/5"
                            }`}
                          >
                            {category.label}
                          </button>
                        ))}
                    </div>
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-black/15 bg-white p-2">
                      <button
                        type="button"
                        onClick={() =>
                          {
                            const next = { ...settings, backgroundImage: null };
                            setSettings(next);
                            void saveSettings(next);
                          }
                        }
                        className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          settings.backgroundImage === null
                            ? "border-black/40 bg-black/10"
                            : "border-black/15 bg-white hover:bg-black/5"
                        }`}
                      >
                        <span>{t.noFile}</span>
                        {settings.backgroundImage === null && <span className="text-xs font-semibold">Gekozen</span>}
                      </button>

                      <div className="space-y-4">
                        {builderBackgrounds.length > 0 && isBuilder && (
                          <div className="rounded-2xl border border-dashed border-black/15 bg-white/70 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                                Builder achtergrond
                              </p>
                              <span className="text-xs text-black/45">{builderBackgrounds.length} items</span>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {builderBackgrounds.map((file) => {
                                const selected = settings.backgroundImage === file;
                                return (
                                  <button
                                    key={file}
                                    type="button"
                                    onClick={() => {
                                      const next = { ...settings, backgroundImage: file };
                                      setSettings(next);
                                      void saveSettings(next);
                                    }}
                                    className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                                      selected
                                        ? "border-black/40 bg-black/10"
                                        : "border-black/15 bg-white hover:bg-black/5"
                                    }`}
                                  >
                                    <span className="block truncate">{getDisplayFileName(file)}</span>
                                    {selected && <span className="mt-1 block text-xs font-semibold">Gekozen</span>}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {backgroundSections.map((section) => (
                          <div key={section.label} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/55">
                                {section.label}
                              </p>
                              <span className="text-xs text-black/50">{section.files.length}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {section.files.map((file) => {
                                const selected = settings.backgroundImage === file;
                                return (
                            <button
                              key={file}
                              type="button"
                              onClick={() => {
                                const next = { ...settings, backgroundImage: file };
                                setSettings(next);
                                void saveSettings(next);
                              }}
                                    className={`overflow-hidden rounded-lg border text-left transition ${
                                      selected
                                        ? "border-black/45 bg-black/8 ring-2 ring-black/20"
                                        : "border-black/15 bg-white hover:border-black/30"
                                    }`}
                                    title={file}
                                  >
                                    <div className="relative aspect-video w-full">
                                      <Image
                                        src={`/backgrounds/${encodeAssetPath(file)}`}
                                        alt={getDisplayFileName(file)}
                                        fill
                                        sizes="(max-width: 640px) 45vw, 180px"
                                        className="object-cover"
                                      />
                                    </div>
                                    <div className="px-2 py-1.5">
                                      <p className="truncate text-[11px] font-medium leading-4">
                                        {getDisplayFileName(file)}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <span className="mt-1 block text-xs text-black/60">
                      {visibleBackgrounds.length} / {allowedBackgrounds.length}
                    </span>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">Inlog achtergrond</span>
                    <input
                      value={loginBackgroundFilter}
                      onChange={(event) => setLoginBackgroundFilter(event.target.value)}
                      placeholder={t.searchFiles}
                      className="mb-2 w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    />
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-black/15 bg-white p-2">
                      <button
                        type="button"
                        onClick={() =>
                          {
                            const next = { ...settings, loginBackground: null };
                            setSettings(next);
                            void saveSettings(next);
                          }
                        }
                        className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          settings.loginBackground === null
                            ? "border-black/40 bg-black/10"
                            : "border-black/15 bg-white hover:bg-black/5"
                        }`}
                      >
                        <span>Standaard ({selectedLoginBackground})</span>
                        {settings.loginBackground === null && <span className="text-xs font-semibold">Gekozen</span>}
                      </button>

                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {filteredLoginBackgrounds.map((file) => {
                          const selected = selectedLoginBackground === file;
                          return (
                            <button
                              key={file}
                              type="button"
                              onClick={() => {
                                const next = { ...settings, loginBackground: file };
                                setSettings(next);
                                void saveSettings(next);
                              }}
                              className={`overflow-hidden rounded-lg border text-left transition ${
                                selected
                                  ? "border-black/45 bg-black/8 ring-2 ring-black/20"
                                  : "border-black/15 bg-white hover:border-black/30"
                              }`}
                              title={file}
                            >
                              <div className="relative aspect-video w-full bg-black/5">
                                {isVideoFile(file) ? (
                                  <video className="h-full w-full object-cover" muted playsInline preload="metadata">
                                    <source
                                      src={`/inlog-background/${encodeAssetPath(file)}`}
                                      type={getVideoMimeType(file)}
                                    />
                                  </video>
                                ) : (
                                  <Image
                                    src={`/inlog-background/${encodeAssetPath(file)}`}
                                    alt={getDisplayFileName(file)}
                                    fill
                                    sizes="(max-width: 640px) 45vw, 180px"
                                    className="object-cover"
                                  />
                                )}
                              </div>
                              <div className="px-2 py-1.5">
                                <p className="truncate text-[11px] font-medium leading-4">
                                  {getDisplayFileName(file)}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="mt-1 block text-xs text-black/60">
                      {filteredLoginBackgrounds.length} / {assetState.loginBackgrounds.length}
                    </span>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.introSound}</span>
                    <input
                      value={introSoundFilter}
                      onChange={(event) => setIntroSoundFilter(event.target.value)}
                      placeholder={t.searchFiles}
                      className="mb-2 w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    />
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-black/15 bg-white p-2">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setIntroSoundCategoryFilter("all")}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            introSoundCategoryFilter === "all"
                              ? "border-black/40 bg-black/10"
                              : "border-black/15 bg-white hover:bg-black/5"
                          }`}
                        >
                          Alle
                        </button>
                        <button
                          type="button"
                          onClick={() => setIntroSoundCategoryFilter("short")}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            introSoundCategoryFilter === "short"
                              ? "border-black/40 bg-black/10"
                              : "border-black/15 bg-white hover:bg-black/5"
                          }`}
                        >
                          Kort
                        </button>
                        <button
                          type="button"
                          onClick={() => setIntroSoundCategoryFilter("long")}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            introSoundCategoryFilter === "long"
                              ? "border-black/40 bg-black/10"
                              : "border-black/15 bg-white hover:bg-black/5"
                          }`}
                        >
                          Te lang
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          {
                            const next = { ...settings, introSound: null };
                            setSettings(next);
                            void saveSettings(next);
                          }
                        }
                        className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          settings.introSound === null
                            ? "border-black/40 bg-black/10"
                            : "border-black/15 bg-white hover:bg-black/5"
                        }`}
                      >
                        <span>{t.noFile}</span>
                        {settings.introSound === null && <span className="text-xs font-semibold">Gekozen</span>}
                      </button>

                      <div className="space-y-2">
                        {visibleIntroSounds.map((file) => {
                          const selected = settings.introSound === file;
                          const duration = introSoundDurations[file];
                          const tooLong = typeof duration === "number" && duration > MAX_INTRO_SOUND_SECONDS;
                          return (
                            <button
                              key={file}
                              type="button"
                              disabled={tooLong}
                              onClick={() => {
                                if (tooLong) {
                                  return;
                                }
                                const next = { ...settings, introSound: file };
                                setSettings(next);
                                void saveSettings(next);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-black/40 bg-black/10"
                                  : "border-black/15 bg-white hover:bg-black/5"
                              } ${tooLong ? "cursor-not-allowed opacity-55" : ""}`}
                              title={file}
                            >
                              <span className="truncate">
                                {getDisplayFileName(file)}
                                {typeof duration === "number" ? ` • ${duration.toFixed(1)}s` : ""}
                              </span>
                              {tooLong ? (
                                <span className="text-xs font-semibold text-red-600">Te lang</span>
                              ) : selected ? (
                                <span className="text-xs font-semibold">Gekozen</span>
                              ) : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="mt-1 block text-xs text-black/60">
                      {visibleIntroSounds.length} / {assetState.introSounds.length}
                    </span>
                    <span className="mt-1 block text-xs text-black/55">
                      Alleen intro-sounds van maximaal {MAX_INTRO_SOUND_SECONDS} seconden zijn toegestaan.
                    </span>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.backgroundSound}</span>
                    <input
                      value={backgroundSoundFilter}
                      onChange={(event) => setBackgroundSoundFilter(event.target.value)}
                      placeholder={t.searchFiles}
                      className="mb-2 w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    />
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-black/15 bg-white p-2">
                      <button
                        type="button"
                        onClick={() =>
                          {
                            const next = { ...settings, backgroundSound: null };
                            setSettings(next);
                            void saveSettings(next);
                          }
                        }
                        className={`mb-2 flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                          settings.backgroundSound === null
                            ? "border-black/40 bg-black/10"
                            : "border-black/15 bg-white hover:bg-black/5"
                        }`}
                      >
                        <span>{t.noFile}</span>
                        {settings.backgroundSound === null && (
                          <span className="text-xs font-semibold">Gekozen</span>
                        )}
                      </button>

                      <div className="space-y-2">
                        {filteredBackgroundSounds.map((file) => {
                          const selected = settings.backgroundSound === file;
                          return (
                            <button
                              key={file}
                              type="button"
                              onClick={() => {
                                const next = { ...settings, backgroundSound: file };
                                setSettings(next);
                                void saveSettings(next);
                              }}
                              className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                                selected
                                  ? "border-black/40 bg-black/10"
                                  : "border-black/15 bg-white hover:bg-black/5"
                              }`}
                              title={file}
                            >
                              <span className="truncate">{getDisplayFileName(file)}</span>
                              {selected && <span className="text-xs font-semibold">Gekozen</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <span className="mt-1 block text-xs text-black/60">
                      {filteredBackgroundSounds.length} / {assetState.backgroundSounds.length}
                    </span>
                  </label>

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.personality}</span>
                    <textarea
                      value={settings.personality}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          personality: event.target.value,
                        }))
                      }
                      rows={3}
                      className="w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.memoryEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          memoryEnabled: event.target.checked,
                          allowAdultMemory: event.target.checked ? prev.allowAdultMemory : false,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <span>{t.memoryToggle}</span>
                  </label>

                  <label
                    className={`flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm ${
                      !settings.memoryEnabled ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.allowAdultMemory}
                      disabled={!settings.memoryEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          allowAdultMemory: event.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <span>{t.adultMemoryToggle}</span>
                  </label>

                  <label className="flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={settings.nsfwPlusEnabled}
                      onChange={(event) => {
                        if (event.target.checked) {
                          openNsfwVerificationModal();
                          return;
                        }

                        setSettings((prev) => ({
                          ...prev,
                          nsfwPlusEnabled: false,
                        }));
                        setNsfwBirthDateCheck("");
                        setNsfwFaceVerified(false);
                        setNsfwSelfieDataUrl(null);
                      }}
                      className="h-4 w-4"
                    />
                    <span>{t.nsfwPlusToggle}</span>
                  </label>

                  {settings.nsfwPlusEnabled && (
                    <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      NSFW+ staat aan na leeftijds- en gezichtsverificatie.
                    </p>
                  )}

                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.ageMode}</span>
                    <select
                      value={settings.ageMode}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          ageMode: event.target.value as AgeMode,
                        }))
                      }
                      className="w-full rounded-lg border border-black/15 bg-white px-2 py-2"
                    >
                      {Object.entries(t.aiAgeModes).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label
                    className={`flex items-center gap-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm ${
                      settings.nsfwPlusEnabled ? "opacity-60" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.parentalControl}
                      disabled={settings.nsfwPlusEnabled}
                      onChange={(event) =>
                        setSettings((prev) => ({
                          ...prev,
                          parentalControl: event.target.checked,
                        }))
                      }
                      className="h-4 w-4"
                    />
                    <span>{t.parentalControl}</span>
                  </label>

                  <div className="rounded-lg border border-black/10 bg-white p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">GitHub updates</p>
                        <p className="text-xs text-black/60">
                          Haal nieuwe commits uit GitHub binnen in deze lokale installatie.
                          Je lokale data en mediabestanden worden eerst geback-upt.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          void refreshGitUpdateStatus();
                        }}
                        className="rounded-lg border border-black/15 px-3 py-2 text-xs font-semibold hover:bg-black/5"
                        disabled={gitUpdateLoading}
                      >
                        Vernieuwen
                      </button>
                    </div>

                    {gitUpdateStatus && (
                      <div className="mt-3 space-y-1 text-xs text-black/70">
                        <p>
                          Branch: <span className="font-semibold">{gitUpdateStatus.branch ?? "onbekend"}</span>
                        </p>
                        <p>
                          Status:{" "}
                          <span className="font-semibold">
                            {gitUpdateStatus.behind > 0
                              ? `${gitUpdateStatus.behind} update(s) beschikbaar`
                              : "bijgewerkt"}
                          </span>
                        </p>
                        <p>
                          Werkmap:{" "}
                          <span className="font-semibold">
                            {gitUpdateStatus.dirty ? "lokale wijzigingen aanwezig" : "schoon"}
                          </span>
                        </p>
                        {gitUpdateStatus.reason && <p className="text-black/55">{gitUpdateStatus.reason}</p>}
                        <p className="text-black/55">
                          Accounts, chats en eigen media blijven lokaal bewaard; de update maakt eerst een backup.
                        </p>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        void applyGitUpdate();
                      }}
                      disabled={gitUpdateLoading || !gitUpdateStatus?.canUpdate}
                      className="mt-3 w-full rounded-lg bg-black px-3 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:bg-black/30"
                    >
                      {gitUpdateLoading ? "Bezig..." : "Update vanuit GitHub"}
                    </button>

                    {gitUpdateMessage && <p className="mt-2 text-xs text-emerald-700">{gitUpdateMessage}</p>}
                    {gitUpdateError && <p className="mt-2 text-xs text-red-700">{gitUpdateError}</p>}
                  </div>

                  {settingsError && (
                    <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {settingsError}
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      void saveSettings();
                    }}
                    disabled={isSaving}
                    className="rounded-lg bg-black px-3 py-2 font-semibold text-white"
                  >
                    {isSaving ? t.saving : saveState === "saved" ? t.saved : t.save}
                  </button>
                </div>
              </aside>
            </>
          )}

          {showNsfwVerifyModal && (
            <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-title text-3xl">NSFW+ verificatie</h3>
                    <p className="mt-1 text-sm text-black/70">
                      Bevestig je leeftijd en doe een gezichtsverificatie om NSFW+ te activeren.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={cancelNsfwVerificationModal}
                    className="rounded-lg border border-black/20 px-3 py-2 text-sm font-semibold hover:bg-black/5"
                  >
                    Sluiten
                  </button>
                </div>

                <div className="mt-5 grid gap-5 lg:grid-cols-2">
                  <label className="text-sm">
                    <span className="mb-1 block font-semibold">{t.nsfwBirthDate}</span>
                    <input
                      type="date"
                      value={nsfwBirthDateCheck}
                      onChange={(event) => setNsfwBirthDateCheck(event.target.value)}
                      className="w-full rounded-xl border border-black/15 bg-white px-3 py-2"
                    />
                    <span className="mt-1 block text-xs text-black/60">Je moet 18+ zijn.</span>
                  </label>

                  <div className="text-sm">
                    <span className="mb-1 block font-semibold">Gezichtsverificatie</span>
                    <label className="mb-2 block">
                      <span className="mb-1 block text-xs font-semibold text-black/70">Camera kiezen</span>
                      <select
                        value={nsfwSelectedCameraId}
                        onChange={(event) => {
                          setNsfwSelectedCameraId(event.target.value);
                          setNsfwCameraReady(false);
                          setNsfwFaceVerified(false);
                          setNsfwSelfieDataUrl(null);
                          setNsfwVerifyError(null);
                        }}
                        className="w-full rounded-xl border border-black/15 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">Standaard camera</option>
                        {nsfwCameraDevices.map((device, index) => (
                          <option key={device.deviceId} value={device.deviceId}>
                            {device.label?.trim() || `Camera ${index + 1}`}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="overflow-hidden rounded-2xl border border-black/15 bg-black">
                      {nsfwSelfieDataUrl ? (
                        <Image
                          src={nsfwSelfieDataUrl}
                          alt="Selfie verificatie"
                          width={1280}
                          height={720}
                          unoptimized
                          className="h-56 w-full object-cover"
                        />
                      ) : (
                        <video
                          ref={nsfwVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="h-56 w-full object-cover"
                        />
                      )}
                    </div>
                    {!nsfwCameraReady && !nsfwSelfieDataUrl && (
                      <p className="mt-2 text-xs text-red-600">
                        Camera nog niet actief. Sta cameratoegang toe in je browser en probeer opnieuw.
                      </p>
                    )}

                    <canvas ref={nsfwCanvasRef} className="hidden" />
                    <canvas ref={nsfwLiveDetectCanvasRef} className="hidden" />

                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void captureNsfwSelfie();
                        }}
                        className="rounded-lg bg-black px-3 py-2 text-sm font-semibold text-white"
                      >
                        {nsfwSelfieDataUrl ? "Nieuwe selfie" : "Selfie nemen"}
                      </button>
                      {nsfwFaceVerified && (
                        <span className="inline-flex items-center rounded-lg bg-emerald-100 px-3 py-2 text-xs font-semibold text-emerald-800">
                          Gezicht bevestigd
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-black/70">
                      {nsfwFaceDetectionAvailable
                        ? nsfwLiveFaceDetected
                          ? `Gezicht live gedetecteerd (${nsfwDetectedFacesCount}).`
                          : "Geen duidelijk gezicht live gedetecteerd."
                        : "Gezichtsdetectie niet beschikbaar in deze browser, camera-selfie fallback actief."}
                    </p>
                  </div>
                </div>

                {nsfwVerifyError && (
                  <p className="mt-4 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {nsfwVerifyError}
                  </p>
                )}

                <div className="mt-5 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={cancelNsfwVerificationModal}
                    className="rounded-xl border border-black/20 px-4 py-2 font-semibold hover:bg-black/5"
                  >
                    Annuleren
                  </button>
                  <button
                    type="button"
                    onClick={confirmNsfwVerificationModal}
                    className="rounded-xl bg-[#df5f35] px-4 py-2 font-semibold text-white hover:bg-[#c9502b]"
                  >
                    Verificatie bevestigen
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <audio
        ref={introAudioRef}
        src={settings.introSound ? `/intro-music/${encodeAssetPath(settings.introSound)}` : undefined}
        preload="auto"
        hidden
      />
      <audio
        ref={bgAudioRef}
        src={
          settings.backgroundSound
            ? `/background-music/${encodeAssetPath(settings.backgroundSound)}`
            : undefined
        }
        preload="auto"
        loop
        hidden
      />
    </div>
  );
}

