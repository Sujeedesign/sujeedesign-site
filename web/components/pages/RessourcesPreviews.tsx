import styles from "./RessourcesPreviews.module.css";

/** Marque abstraite réutilisée dans l'aperçu du test de logo. */
function Mark({ size = 24, color = "#0A0A0B" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="9" cy="12" r="6.2" fill="none" stroke={color} strokeWidth="1.8" />
      <path d="M13 5.8h6v12.4h-6" fill="none" stroke={color} strokeWidth="1.8" />
    </svg>
  );
}

export function CalculateurPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.chips}>
        <span className={`${styles.chip} ${styles.chipOn}`}>Refonte</span>
        <span className={`${styles.chip} ${styles.chipOn}`}>Carte de visite</span>
        <span className={styles.chip}>Brochure</span>
      </div>
      <div className={styles.range}>
        <span className={styles.rangeValue}>1 050 €</span>
        <span className={styles.rangeTrack}>
          <span className={styles.rangeFill} />
        </span>
        <span className={styles.rangeValue}>1 950 €</span>
      </div>
      <div className={styles.lines}>
        <span className={styles.line} />
        <span className={styles.line} />
        <span className={styles.line} />
      </div>
    </div>
  );
}

export function BriefPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.progress}>
        <span className={styles.progressTrack}>
          <span className={styles.progressFill} />
        </span>
        <span className={styles.progressLabel}>7/7</span>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>01 · ACTIVITÉ</span>
        <span className={`${styles.fieldBox} ${styles.fieldBoxFilled}`}>
          <span />
        </span>
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>02 · PROMESSE</span>
        <span className={`${styles.fieldBox} ${styles.fieldBoxFilled}`}>
          <span />
        </span>
      </div>
      <span className={styles.stamp}>PDF</span>
    </div>
  );
}

export function LogoPreview() {
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.tiles}>
        <span className={styles.tileLabel}>
          <span className={styles.logoTile} style={{ height: 34 }}>
            <Mark size={12} />
          </span>
          <span className={styles.logoCaption}>16 px</span>
        </span>
        <span className={styles.tileLabel}>
          <span className={styles.logoTile} style={{ height: 34 }}>
            <Mark size={18} />
          </span>
          <span className={styles.logoCaption}>32 px</span>
        </span>
        <span className={styles.tileLabel}>
          <span className={styles.logoTile} style={{ height: 34, filter: "grayscale(1)" }}>
            <Mark size={22} color="#6a6a63" />
          </span>
          <span className={styles.logoCaption}>gris</span>
        </span>
        <span className={styles.tileLabel}>
          <span className={`${styles.logoTile} ${styles.logoTileDark}`} style={{ height: 34 }}>
            <Mark size={22} color="#F7F7F5" />
          </span>
          <span className={styles.logoCaption}>1 ton</span>
        </span>
      </div>
      <div className={styles.lines}>
        <span className={styles.line} />
        <span className={styles.line} />
      </div>
    </div>
  );
}

export function GuidePreview() {
  const rows = [
    { offre: "Essentiel", prix: "650 – 900 €" },
    { offre: "Signature", prix: "1 200 – 1 800 €" },
    { offre: "Identité Starter", prix: "1 500 – 2 200 €" },
    { offre: "Identité Complète", prix: "2 500 – 3 500 €" },
  ];
  return (
    <div className={styles.preview} aria-hidden="true">
      <div className={styles.table}>
        {rows.map((row) => (
          <span key={row.offre} className={styles.row}>
            <span>
              <strong>{row.offre}</strong>
            </span>
            <span>{row.prix}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
