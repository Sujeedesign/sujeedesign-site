"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { analyseLogo, readPixels, type LogoAnalysis } from "@/lib/logo-test";
import {
  detectIcon,
  reportIcon,
  scoreIcon,
  supportVerdicts,
  type IconDetection,
  type IconMetric,
  type IconScore,
  type IconReport,
  type Pixels,
  type Rect,
  type SupportVerdict,
} from "@/lib/logo-icon";
import { buildReportPdf } from "@/lib/report-pdf";
import { buildIco, buildManifest, buildZip } from "@/lib/favicon-pack";
import styles from "./LogoTester.module.css";

type Preview = {
  name: string;
  src: string;
  onDark?: boolean;
};

type SizePreview = {
  size: number;
  url: string;
};

type PlateKind = "none" | "ink" | "paper";

const WORK_MAX = 1400;
const ICON_SIZE = 512;

const FAVICON_SIZES = [
  { size: 16, label: "16 px", use: "Onglet du navigateur" },
  { size: 32, label: "32 px", use: "Barre de favoris" },
  { size: 48, label: "48 px", use: "Raccourci Windows" },
  { size: 180, label: "180 px", use: "Écran d'accueil iOS" },
  { size: 192, label: "192 px", use: "Android et PWA" },
  { size: 512, label: "512 px", use: "Store et source" },
];

export function LogoTester() {
  const inputRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLCanvasElement | null>(null);
  const iconRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ x: number; y: number; origin: Rect } | null>(null);

  const [fileName, setFileName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceSize, setSourceSize] = useState({ width: 1, height: 1 });
  const [detection, setDetection] = useState<IconDetection | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const [plate, setPlate] = useState<PlateKind>("none");
  const [iconUrl, setIconUrl] = useState("");
  const [iconReport, setIconReport] = useState<IconReport | null>(null);
  const [iconPixels, setIconPixels] = useState<Pixels | null>(null);
  const [siteName, setSiteName] = useState("");
  const [exporting, setExporting] = useState(false);
  const [sizePreviews, setSizePreviews] = useState<SizePreview[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [analysis, setAnalysis] = useState<LogoAnalysis | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [packing, setPacking] = useState(false);

  const reset = useCallback(() => {
    setPreviews([]);
    setAnalysis(null);
    setFileName("");
    setError("");
    setSourceUrl("");
    setDetection(null);
    setCrop(null);
    setIconUrl("");
    setIconReport(null);
    setIconPixels(null);
    setSiteName("");
    setSizePreviews([]);
    sourceRef.current = null;
    iconRef.current = null;
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  async function handleFile(file: File) {
    reset();
    if (!file.type.startsWith("image/")) {
      setError("Ce fichier n'est pas une image. Utilise un PNG, un JPG, un WebP ou un SVG.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Fichier trop lourd pour le navigateur (8 Mo maximum). Réduis la taille de l'image.");
      return;
    }

    setBusy(true);
    setFileName(file.name);
    setSiteName(siteNameFromFile(file.name));

    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      const isVector = file.type === "image/svg+xml";
      const naturalWidth = image.naturalWidth || image.width || ICON_SIZE;

      // Rendu de travail : assez fin pour un favicon 512 px, plafonné pour rester rapide.
      const width = Math.min(WORK_MAX, Math.max(ICON_SIZE, naturalWidth));
      const height = Math.max(1, Math.round((width * image.height) / image.width));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponible");
      context.drawImage(image, 0, 0, width, height);

      sourceRef.current = canvas;
      setSourceSize({ width, height });
      setSourceUrl(canvas.toDataURL("image/png"));

      const pixels = readPixels(canvas);
      const found = detectIcon(pixels);
      setDetection(found);
      setCrop(found.ink ? found.region : { x: 0, y: 0, w: Math.min(width, height), h: Math.min(width, height) });

      const ink = toneCanvas(canvas, "#0A0A0B");
      const paper = toneCanvas(canvas, "#F7F7F5");
      setPreviews([
        { name: "Logo entier", src: canvas.toDataURL("image/png") },
        { name: "Niveaux de gris", src: canvas.toDataURL("image/png") },
        { name: "Un seul ton, sur papier", src: ink },
        { name: "Un seul ton, sur fond encre", src: paper, onDark: true },
      ]);

      setAnalysis(analyseLogo(pixels, naturalWidth || width, isVector));
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de lire cette image. Essaie un autre fichier.");
    } finally {
      setBusy(false);
    }
  }

  // Recalcul de l'icône et des aperçus, légèrement différé pour garder le glisser fluide.
  useEffect(() => {
    const source = sourceRef.current;
    if (!source || !crop) return;
    const timer = window.setTimeout(() => {
      const square = cropSquare(source, crop, ICON_SIZE, plate);
      iconRef.current = square;
      setIconUrl(square.toDataURL("image/png"));
      const iconPixels = readPixels(square);
      setIconPixels(iconPixels);
      setIconReport(reportIcon(iconPixels));
      setSizePreviews(
        FAVICON_SIZES.map(({ size }) => ({ size, url: resized(square, size).toDataURL("image/png") })),
      );
    }, 70);
    return () => window.clearTimeout(timer);
  }, [crop, sourceUrl, plate]);

  const supports = useMemo<SupportVerdict[]>(
    () => (iconPixels && iconReport ? supportVerdicts(iconPixels, iconReport) : []),
    [iconPixels, iconReport],
  );
  const score = useMemo<IconScore | null>(
    () => (supports.length > 0 ? scoreIcon(supports, iconReport ?? undefined) : null),
    [supports, iconReport],
  );
  const failures = useMemo(() => supports.filter((item) => item.state !== "ok"), [supports]);

  const maxSide = useMemo(
    () => Math.max(8, Math.min(sourceSize.width, sourceSize.height)),
    [sourceSize],
  );

  const baseName = useMemo(() => {
    const raw = fileName.replace(/\.[^.]+$/, "").trim() || "logo";
    return raw
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "logo";
  }, [fileName]);

  function moveTo(side: number) {
    if (!crop) return;
    const factor = clamp(side, 8, maxSide) / crop.w;
    const w = Math.round(clamp(crop.w * factor, 8, sourceSize.width));
    const h = Math.round(clamp(crop.h * factor, 8, sourceSize.height));
    const cx = crop.x + crop.w / 2;
    const cy = crop.y + crop.h / 2;
    setCrop({
      x: Math.round(clamp(cx - w / 2, 0, sourceSize.width - w)),
      y: Math.round(clamp(cy - h / 2, 0, sourceSize.height - h)),
      w,
      h,
    });
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!crop) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, origin: crop };
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    const scaleX = sourceSize.width / rect.width;
    const scaleY = sourceSize.height / rect.height;
    const x = clamp(drag.origin.x + (event.clientX - drag.x) * scaleX, 0, sourceSize.width - drag.origin.w);
    const y = clamp(drag.origin.y + (event.clientY - drag.y) * scaleY, 0, sourceSize.height - drag.origin.h);
    setCrop({ ...drag.origin, x: Math.round(x), y: Math.round(y) });
  }

  function onPointerUp() {
    dragRef.current = null;
  }

  async function downloadPack() {
    const icon = iconRef.current;
    if (!icon || !crop) return;
    setPacking(true);
    try {
      const rendered = await Promise.all(
        [16, 32, 48, 180, 192, 512].map((size) => canvasBytes(resized(icon, size))),
      );
      const [png16, png32, png48, png180, png192, png512] = rendered as [
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
        Uint8Array,
      ];
      const ico = buildIco([
        { size: 16, png: png16 },
        { size: 32, png: png32 },
        { size: 48, png: png48 },
      ]);
      const manifest = buildManifest(baseName.replace(/-/g, " "), themeColor(icon));
      const zip = buildZip([
        { name: "favicon.ico", data: ico },
        { name: "favicon-16x16.png", data: png16 },
        { name: "favicon-32x32.png", data: png32 },
        { name: "favicon-48x48.png", data: png48 },
        { name: "apple-touch-icon.png", data: png180 },
        { name: "android-chrome-192x192.png", data: png192 },
        { name: "android-chrome-512x512.png", data: png512 },
        { name: "site.webmanifest", data: new TextEncoder().encode(manifest) },
        { name: "lisez-moi.txt", data: new TextEncoder().encode(readme(baseName)) },
      ]);
      downloadBlob(
        new Blob([new Uint8Array(zip).buffer as ArrayBuffer], { type: "application/zip" }),
        `favicons-${baseName}.zip`,
      );
    } catch {
      setError("Le pack n'a pas pu être généré. Réessaie avec un fichier plus simple.");
    } finally {
      setPacking(false);
    }
  }

  async function downloadReportPdf() {
    const icon = iconRef.current;
    if (!icon || !iconReport || supports.length === 0) return;
    setExporting(true);
    try {
      const background = exportBackground(icon);
      const icons = await Promise.all(
        [16, 32, 48, 512].map(async (size) => {
          const canvas = flattened(resized(icon, size * 2), background);
          return {
            label: `${size} px`,
            jpeg: await canvasJpeg(canvas),
            width: size * 2,
            height: size * 2,
            // 512 sert de preuve de définition, pas de poster : on le garde petit.
            draw: Math.min(size, 96),
          };
        }),
      );
      const pdf = buildReportPdf({
        fileName,
        siteName: siteName || siteNameFromFile(fileName),
        date: new Date().toLocaleDateString("fr-FR", {
          day: "numeric",
          month: "long",
          year: "numeric",
        }),
        score: score ?? { value: 0, grade: "E", label: "Refonte de l'icône nécessaire" },
        verdict: iconReport.verdict,
        supports: supports.map((item) => ({
          label: item.label,
          context: item.context,
          state: item.state,
          note: item.note,
        })),
        metrics: iconReport.metrics.map((metric) => ({
          label: metric.label,
          value: metric.value,
          state: metric.state,
          detail: metric.detail,
        })),
        icons,
      });
      downloadBlob(
        new Blob([pdf.buffer as ArrayBuffer], { type: "application/pdf" }),
        `analyse-logo-${baseName}.pdf`,
      );
    } catch {
      setError("Le PDF n'a pas pu être généré. Réessaie avec un autre fichier.");
    } finally {
      setExporting(false);
    }
  }

  function downloadIcon() {
    const icon = iconRef.current;
    if (!icon) return;
    icon.toBlob((blob) => {
      if (blob) downloadBlob(blob, `icone-${baseName}-512.png`);
    }, "image/png");
  }

  const cropLeft = crop && sourceSize.width > 0 ? (crop.x / sourceSize.width) * 100 : 0;
  const cropTop = crop && sourceSize.height > 0 ? (crop.y / sourceSize.height) * 100 : 0;
  const cropWidth = crop && sourceSize.width > 0 ? (crop.w / sourceSize.width) * 100 : 0;
  const cropHeight = crop && sourceSize.height > 0 ? (crop.h / sourceSize.height) * 100 : 0;

  return (
    <div className={styles.wrapper}>
      {previews.length === 0 ? (
        <div
          className={styles.dropzone}
          onDragOver={(event) => {
            event.preventDefault();
          }}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
        >
          <input
            ref={inputRef}
            id="logo-file"
            className={styles.fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <label htmlFor="logo-file" className={styles.dropLabel}>
            <span className={styles.dropTitle}>Glissez votre logo ici</span>
            <span className={styles.dropHint}>
              PNG, JPG, WebP ou SVG, 8 Mo maximum. Le fichier reste dans votre navigateur : il
              n&apos;est ni envoyé, ni enregistré sur le serveur.
            </span>
            <span className="btn-line">Choisir un fichier</span>
          </label>
        </div>
      ) : null}

      {error.length > 0 ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {busy ? <p className={styles.busy}>Lecture du fichier…</p> : null}

      {previews.length > 0 ? (
        <>
          <div className={styles.head}>
            <p className={styles.fileName}>{fileName}</p>
            <button type="button" className={styles.reset} onClick={reset}>
              Tester un autre fichier
            </button>
          </div>

          {score ? (
            <section
              className={styles.scorePanel}
              aria-label={`Note du logo : ${score.value} sur 100`}
            >
              <div className={styles.scoreLeft}>
                <p className={styles.scoreKick}>Note du logo</p>
                <p className={styles.scoreValue}>
                  {score.value}
                  <span className={styles.scoreMax}>/100</span>
                  <span className={styles.scoreGrade}>{score.grade}</span>
                </p>
                <p className={styles.scoreVerdict}>{score.label}</p>
              </div>
              <ul className={styles.scoreList}>
                {supports.map((support) => (
                  <li
                    key={support.id}
                    className={`${styles.scoreItem} ${
                      support.state === "ko"
                        ? styles.scoreKo
                        : support.state === "watch"
                          ? styles.scoreWatch
                          : styles.scoreOk
                    }`}
                  >
                    <span className={styles.scoreItemName}>
                      {support.label}
                      <span className={styles.scoreItemSize}>{support.context}</span>
                    </span>
                    <span className={styles.scoreItemState}>
                      {support.state === "ko"
                        ? "échoue"
                        : support.state === "watch"
                          ? "fragile"
                          : "passe"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 1. Extraction de l'icône */}
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <p className={styles.step}>1</p>
              <div>
                <h2 className={styles.blockTitle}>L&apos;icône du logo</h2>
                <p className={styles.blockIntro}>
                  {detection?.message ??
                    "Le cadre isole le symbole du fichier : c'est lui qui deviendra le favicon."}
                </p>
              </div>
            </div>

            <div className={styles.iconLayout}>
              <div
                ref={stageRef}
                className={styles.stage}
                style={{ aspectRatio: `${sourceSize.width} / ${sourceSize.height}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="Logo déposé" className={styles.stageImg} />
                {crop ? (
                  <div
                    className={styles.cropBox}
                    style={{
                      left: `${cropLeft}%`,
                      top: `${cropTop}%`,
                      width: `${cropWidth}%`,
                      height: `${cropHeight}%`,
                    }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    role="presentation"
                  >
                    <span className={styles.safeZone} aria-hidden="true" />
                    <span className={styles.cropHandle} aria-hidden="true" />
                  </div>
                ) : null}
              </div>

              <div className={styles.iconSide}>
                <div className={styles.iconWell}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {iconUrl ? <img src={iconUrl} alt="Icône extraite" width={112} height={112} /> : null}
                </div>

                <div className={styles.plateRow} role="group" aria-label="Plaque de fond">
                  <span className={styles.plateLabel}>Fond</span>
                  {([
                    { id: "none", name: "Aucun" },
                    { id: "ink", name: "Encre" },
                    { id: "paper", name: "Papier" },
                  ] as { id: PlateKind; name: string }[]).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={plate === item.id ? styles.plateChipOn : styles.plateChip}
                      onClick={() => setPlate(item.id)}
                      aria-pressed={plate === item.id}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>

                <label className={styles.slider}>
                  <span>
                    Taille du cadre <span className={styles.sliderValue}>{crop ? `${crop.w} px` : "—"}</span>
                  </span>
                  <input
                    type="range"
                    min={8}
                    max={maxSide}
                    step={1}
                    value={crop?.w ?? 8}
                    onChange={(event) => moveTo(Number(event.target.value))}
                  />
                </label>

                <p className={styles.hint}>
                  Glisse le carré pour le déplacer, règle la taille si le fichier contient aussi du
                  texte. Rien n&apos;est envoyé.
                </p>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.ghost}
                    onClick={() => detection?.ink && setCrop(detection.region)}
                    disabled={!detection?.ink}
                  >
                    Revenir au cadre auto
                  </button>
                  <button type="button" className={styles.ghost} onClick={downloadIcon}>
                    Icône 512 px (PNG)
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Aperçus favicon */}
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <p className={styles.step}>2</p>
              <div>
                <h2 className={styles.blockTitle}>Le favicon en situation</h2>
                <p className={styles.blockIntro}>
                  L&apos;icône seule, aux tailles réellement utilisées par les navigateurs et les
                  systèmes.
                </p>
              </div>
            </div>

            <div className={styles.tabRow}>
              {[
                { name: "Onglet, fond clair", dark: false },
                { name: "Onglet, fond sombre", dark: true },
              ].map((tab) => (
                <div key={tab.name} className={tab.dark ? `${styles.tab} ${styles.tabDark}` : styles.tab}>
                  <span className={styles.tabDot} aria-hidden="true" />
                  <span className={styles.tabSite}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={sizePreviews.find((item) => item.size === 16)?.url ?? iconUrl}
                      alt=""
                      width={16}
                      height={16}
                      className={styles.tabIcon}
                    />
                    {siteName || "Votre site"}
                  </span>
                  <span className={styles.tabClose} aria-hidden="true">
                    ×
                  </span>
                </div>
              ))}
            </div>

            <label className={styles.siteNameField}>
              <span className={styles.siteNameLabel}>Nom affiché dans l&apos;onglet</span>
              <input
                type="text"
                value={siteName}
                maxLength={34}
                placeholder="Votre site"
                onChange={(event) => setSiteName(event.target.value)}
              />
              <span className={styles.siteNameHint}>
                Les deux onglets ci-dessus simulent votre navigateur : le favicon y est vu à sa
                taille réelle, avec le titre de votre site.
              </span>
            </label>

            <div className={styles.faviconGrid}>
              {FAVICON_SIZES.map(({ size, label, use }) => {
                const preview = sizePreviews.find((item) => item.size === size);
                return (
                  <figure key={size} className={styles.faviconCard}>
                    <div className={styles.faviconWell}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {preview ? (
                        <img
                          src={preview.url}
                          alt={`Favicon à ${label}`}
                          width={size}
                          height={size}
                        />
                      ) : null}
                    </div>
                    <figcaption className={styles.faviconCaption}>
                      <span className={styles.faviconLabel}>{label}</span>
                      <span className={styles.faviconUse}>{use}</span>
                    </figcaption>
                  </figure>
                );
              })}
              <figure className={styles.faviconCard}>
                <div className={styles.faviconWell}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {iconUrl ? (
                    <img
                      src={sizePreviews.find((item) => item.size === 32)?.url ?? iconUrl}
                      alt="Favicon agrandi quatre fois"
                      width={128}
                      height={128}
                      style={{ width: 128, height: 128, imageRendering: "pixelated" }}
                    />
                  ) : null}
                </div>
                <figcaption className={styles.faviconCaption}>
                  <span className={styles.faviconLabel}>× 4</span>
                  <span className={styles.faviconUse}>Zoom sur le 32 px</span>
                </figcaption>
              </figure>
            </div>

            <div className={styles.downloadBar}>
              <button type="button" className="btn-fill" onClick={() => void downloadPack()} disabled={packing}>
                {packing ? "Préparation du pack…" : "Télécharger le pack favicon (.zip)"}
              </button>
              <button
                type="button"
                className={styles.pdfButton}
                onClick={() => void downloadReportPdf()}
                disabled={exporting || !score}
              >
                {exporting ? "Rédaction du PDF…" : "Télécharger l'analyse (.pdf)"}
              </button>
              <p className={styles.downloadNote}>
                ICO 16/32/48, PNG 16 à 512, manifeste et mode d&apos;emploi. Le PDF reprend la note,
                le verdict support par support et l&apos;icône aux quatre tailles clés. Tout est
                généré dans votre navigateur.
              </p>
            </div>

            {iconReport ? (
              <div className={styles.report}>
                <p className={styles.verdict}>{iconReport.verdict}</p>
                {failures.length > 0 ? (
                  <div className={styles.failBox}>
                    <p className={styles.failTitle}>
                      {failures.length === 1
                        ? "Un support ne passe pas"
                        : `${failures.length} supports ne passent pas`}
                    </p>
                    <ul className={styles.failList}>
                      {failures.map((support) => (
                        <li key={support.id} className={styles.failItem}>
                          <strong>{support.label}</strong>
                          <span>{support.context}</span>
                          <em>
                            {support.state === "ko" ? "Échec" : "À surveiller"} · {support.note}
                          </em>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <ul className={styles.metrics}>
                  {iconReport.metrics.map((metric) => (
                    <MetricRow key={metric.id} metric={metric} />
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          {/* 3. Qualité du fichier */}
          <section className={styles.block}>
            <div className={styles.blockHead}>
              <p className={styles.step}>3</p>
              <div>
                <h2 className={styles.blockTitle}>La qualité du fichier</h2>
                <p className={styles.blockIntro}>
                  Le logo entier, mesuré tel qu&apos;il est fourni.
                </p>
              </div>
            </div>

            <div className={styles.grid}>
              {previews.map((preview) => (
                <figure
                  key={preview.name}
                  className={preview.onDark ? `${styles.figure} ${styles.figureDark}` : styles.figure}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.src}
                    alt={`Aperçu : ${preview.name}`}
                    className={styles.previewImg}
                    style={preview.name === "Niveaux de gris" ? { filter: "grayscale(1)" } : undefined}
                  />
                  <figcaption className={styles.caption}>{preview.name}</figcaption>
                </figure>
              ))}
            </div>

            {analysis && analysis.metrics.some((m) => m.id === "transparence" && m.state !== "ok") ? (
              <p className={styles.opaqueNote}>
                Le fichier a un fond opaque : les deux aperçus en un seul ton deviennent des blocs
                pleins. C&apos;est exactement ce qui se passe sur un tampon, une gravure ou une
                broderie. La correction tient en une version détourée.
              </p>
            ) : null}

            {analysis ? (
              <div className={styles.analysis}>
                <p className={styles.verdict}>{analysis.verdict}</p>
                <ul className={styles.metrics}>
                  {analysis.metrics.map((metric) => (
                    <MetricRow key={metric.id} metric={metric} />
                  ))}
                </ul>
                <p className={styles.disclaimer}>
                  Ces mesures portent sur le fichier tel qu&apos;il est fourni. Un logo peut passer
                  toutes les mesures et rester daté : c&apos;est une autre question, celle du
                  positionnement.
                </p>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricRow({ metric }: { metric: IconMetric }) {
  return (
    <li className={styles.metric}>
      <span
        className={`${styles.dot} ${metric.state === "ok" ? styles.dotOk : metric.state === "watch" ? styles.dotWatch : styles.dotKo}`}
        aria-hidden="true"
      />
      <div>
        <p className={styles.metricHead}>
          {metric.label} <span className={styles.metricValue}>{metric.value}</span>
        </p>
        <p className={styles.metricDetail}>{metric.detail}</p>
      </div>
    </li>
  );
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image illisible"));
    image.src = url;
  });
}

/** Silhouette pleine couleur : tout ce qui est opaque prend la teinte demandée. */
function toneCanvas(source: HTMLCanvasElement, color: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(source, 0, 0);
  context.globalCompositeOperation = "source-in";
  context.fillStyle = color;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const PLATES: Record<PlateKind, string | null> = {
  none: null,
  ink: "#0A0A0B",
  paper: "#F7F7F5",
};

/** Découpe la zone choisie et la recentre dans un carré 512 px, sans déformation. */
function cropSquare(
  source: HTMLCanvasElement,
  region: Rect,
  size: number,
  plate: PlateKind = "none",
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    const fill = PLATES[plate];
    // Une plaque pleine impose une marge : le dessin doit respirer dans le carré.
    const box = fill ? size * 0.76 : size;
    const offset = (size - box) / 2;
    if (fill) {
      context.fillStyle = fill;
      context.fillRect(0, 0, size, size);
    }
    const scale = Math.min(box / region.w, box / region.h);
    const w = region.w * scale;
    const h = region.h * scale;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      source,
      region.x,
      region.y,
      region.w,
      region.h,
      Math.round(offset + (box - w) / 2),
      Math.round(offset + (box - h) / 2),
      Math.round(w),
      Math.round(h),
    );
  }
  return canvas;
}

function resized(source: HTMLCanvasElement, size: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context) {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, 0, 0, size, size);
  }
  return canvas;
}

function canvasBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("PNG indisponible"));
        return;
      }
      blob
        .arrayBuffer()
        .then((buffer) => resolve(new Uint8Array(buffer)))
        .catch(reject);
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Couleur moyenne des pixels opaques, pour le theme_color du manifeste. */
function themeColor(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext("2d");
  if (!context) return "#0A0A0B";
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 40) continue;
    r += data[i] ?? 0;
    g += data[i + 1] ?? 0;
    b += data[i + 2] ?? 0;
    n += 1;
  }
  if (n === 0) return "#0A0A0B";
  const hex = (value: number) => Math.round(value / n).toString(16).padStart(2, "0");
  return `#${hex(r)}${hex(g)}${hex(b)}`.toUpperCase();
}

function readme(base: string): string {
  return [
    "Pack favicon généré dans votre navigateur par sujeedesign.com.",
    "",
    "Fichiers :",
    "- favicon.ico : onglet, barre de favoris, raccourcis (16, 32 et 48 px)",
    "- favicon-16x16.png / favicon-32x32.png / favicon-48x48.png",
    "- apple-touch-icon.png : écran d'accueil iOS (180 px)",
    "- android-chrome-192x192.png / android-chrome-512x512.png",
    "- site.webmanifest : à placer à la racine du site",
    "",
    "À déposer à la racine du site, puis à relier dans le <head> :",
    "",
    '<link rel="icon" href="/favicon.ico" sizes="any" />',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />',
    '<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />',
    '<link rel="manifest" href="/site.webmanifest" />',
    "",
    `Cadre choisi : ${base}.`,
    "",
  ].join("\n");
}

/** Nom de site proposé pour l'onglet simulé, tiré du nom de fichier. */
function siteNameFromFile(file: string): string {
  const words = file
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\b(logo|lockup|final|vector|vectoriel|svg|png|jpg|jpeg|webp|v\d+|copy|copie|1|2|3)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return "Votre site";
  const nice = words
    .split(" ")
    .slice(0, 4)
    .map((word) => (word.length > 2 ? word[0]?.toUpperCase() + word.slice(1) : word))
    .join(" ");
  return nice.slice(0, 34);
}

/** Aplatit l'icône sur un fond choisi pour l'export JPEG (le JPEG n'a pas d'alpha). */
function flattened(source: HTMLCanvasElement, background: string): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (context) {
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0);
  }
  return canvas;
}

/** Fond de l'export : papier pour un logo sombre, encre pour un logo clair. */
function exportBackground(canvas: HTMLCanvasElement): string {
  const context = canvas.getContext("2d");
  if (!context) return "#F7F7F5";
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let luma = 0;
  let n = 0;
  for (let i = 0; i < data.length; i += 4) {
    if ((data[i + 3] ?? 0) < 64) continue;
    luma += ((data[i] ?? 0) * 0.299 + (data[i + 1] ?? 0) * 0.587 + (data[i + 2] ?? 0) * 0.114) / 255;
    n += 1;
  }
  return n > 0 && luma / n > 0.6 ? "#0A0A0B" : "#F7F7F5";
}

function canvasJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("JPEG indisponible"));
          return;
        }
        blob
          .arrayBuffer()
          .then((buffer) => resolve(new Uint8Array(buffer)))
          .catch(reject);
      },
      "image/jpeg",
      quality,
    );
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
