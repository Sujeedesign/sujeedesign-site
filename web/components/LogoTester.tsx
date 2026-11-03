"use client";

import { useCallback, useRef, useState } from "react";
import { analyseLogo, readPixels, type LogoAnalysis } from "@/lib/logo-test";
import styles from "./LogoTester.module.css";

type Preview = {
  name: string;
  src: string;
  onDark?: boolean;
};

const SIZES = [16, 32, 64];

export function LogoTester() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [analysis, setAnalysis] = useState<LogoAnalysis | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = useCallback(() => {
    setPreviews([]);
    setAnalysis(null);
    setFileName("");
    setError("");
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

    try {
      const url = URL.createObjectURL(file);
      const image = await loadImage(url);
      const isVector = file.type === "image/svg+xml";
      const naturalWidth = image.naturalWidth || image.width;

      // Rendu de travail : on plafonne à 512 px de large pour rester rapide.
      const ratio = image.height / image.width;
      const width = Math.min(512, naturalWidth || 512);
      const height = Math.max(1, Math.round(width * ratio));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponible");
      context.drawImage(image, 0, 0, width, height);

      const ink = toneCanvas(canvas, "#0A0A0B");
      const paper = toneCanvas(canvas, "#F7F7F5");

      setPreviews([
        { name: "Original", src: canvas.toDataURL("image/png") },
        { name: "Niveaux de gris", src: canvas.toDataURL("image/png") },
        { name: "Un seul ton, sur papier", src: ink },
        { name: "Un seul ton, sur fond encre", src: paper, onDark: true },
      ]);

      setAnalysis(analyseLogo(readPixels(canvas), naturalWidth || width, isVector));
      URL.revokeObjectURL(url);
    } catch {
      setError("Impossible de lire cette image. Essaie un autre fichier.");
    } finally {
      setBusy(false);
    }
  }

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

          <div className={styles.sizes}>
            {SIZES.map((size) => (
              <div key={size} className={styles.sizeBox}>
                <div className={styles.sizeCanvas} style={{ background: "#F7F7F5" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previews[0]?.src}
                    alt={`Logo affiché à ${size} pixels`}
                    width={size}
                    height={size}
                    style={{ width: size, height: size, maxWidth: size, maxHeight: size, objectFit: "contain" }}
                  />
                </div>
                <p className={styles.sizeLabel}>
                  {size} px · {size === 16 ? "favicon" : size === 32 ? "icône" : "avatar"}
                </p>
              </div>
            ))}
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
                  <li key={metric.id} className={styles.metric}>
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
                ))}
              </ul>
              <p className={styles.disclaimer}>
                Ces mesures portent sur le fichier tel qu&apos;il est fourni. Un logo peut passer
                toutes les mesures et rester daté : c&apos;est une autre question, celle du
                positionnement.
              </p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
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
