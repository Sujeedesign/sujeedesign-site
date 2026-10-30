"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import styles from "./ContactChat.module.css";

type Role = "agent" | "user";
type Message = { id: string; role: Role; text: string };

type Slot = { id: string; label: string };

type Booking = { reference: string; label: string; start: string; mail_sent?: boolean };

type Phase = "idle" | "streaming" | "done" | "offline";

type LeadField = { name: string; email: string; phone: string; project_type: string; budget: string };

const STEPS = [
  { key: "accueil", label: "Projet" },
  { key: "qualification", label: "Contexte" },
  { key: "recap", label: "Reformulation" },
  { key: "creneaux", label: "Créneau" },
  { key: "confirme", label: "Confirmé" },
] as const;

const PROJECT_TYPES = [
  "Identité de marque",
  "Site web ou e-commerce",
  "Direction artistique",
  "Photo, vidéo, motion",
  "Agents IA et automatisation",
  "Autre",
];

const WELCOME =
  "Bonjour, je suis l'assistant de Sujee. Dites-moi en quelques mots ce que vous avez en tête : je cadre le besoin, je vous donne une fourchette et je vous propose un créneau d'appel.";

const STORAGE_KEY = "sjd-contact-v1";

let counter = 0;
const nextId = () => `m${Date.now()}-${counter++}`;

/** Découpe un flux SSE en événements JSON exploitables. */
function parseBlock(block: string): { event: string; data: Record<string, unknown> } | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trim());
  }
  if (!data.length) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(data.join("\n")) as Record<string, unknown>;
  } catch {
    return null;
  }
  // Le serveur porte le nom de l'événement dans le champ `type` du JSON.
  if (event === "message" && typeof parsed.type === "string") event = parsed.type;
  return { event, data: parsed };
}

export default function ContactChat() {
  const [messages, setMessages] = useState<Message[]>([{ id: "welcome", role: "agent", text: WELCOME }]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [stepKey, setStepKey] = useState<string>("accueil");
  const [ratio, setRatio] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [lead, setLead] = useState<LeadField>({ name: "", email: "", phone: "", project_type: "", budget: "" });
  const [leadState, setLeadState] = useState<"idle" | "sending" | "sent">("idle");
  const [leadRef, setLeadRef] = useState<string | null>(null);
  const [leadErrors, setLeadErrors] = useState<Record<string, string>>({});

  const logRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Reprise de la conversation après un rechargement de page.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        sessionId?: string;
        messages?: Message[];
        stepKey?: string;
        ratio?: number;
        booking?: Booking | null;
        leadRef?: string | null;
      };
      if (saved.sessionId) setSessionId(saved.sessionId);
      if (Array.isArray(saved.messages) && saved.messages.length) setMessages(saved.messages);
      if (saved.stepKey) setStepKey(saved.stepKey);
      if (typeof saved.ratio === "number") setRatio(saved.ratio);
      if (saved.booking) setBooking(saved.booking);
      if (saved.leadRef) setLeadRef(saved.leadRef);
    } catch {
      /* stockage indisponible : la conversation repart de zéro */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ sessionId, messages, stepKey, ratio, booking, leadRef }),
      );
    } catch {
      /* quota ou mode privé : pas bloquant */
    }
  }, [sessionId, messages, stepKey, ratio, booking, leadRef]);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages, phase, slots, booking]);

  const stepIndex = Math.max(
    0,
    STEPS.findIndex((step) => step.key === stepKey),
  );
  const progress = Math.min(100, Math.round(((stepIndex + ratio) / STEPS.length) * 100));

  const handleEvent = useCallback((name: string, data: Record<string, unknown>) => {
    if ((name === "delta" || name === "token") && typeof data.text === "string") {
      const chunk = data.text as string;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "agent" && last.id.startsWith("live-")) {
          return [...prev.slice(0, -1), { ...last, text: last.text + chunk }];
        }
        return [...prev, { id: `live-${nextId()}`, role: "agent", text: chunk }];
      });
      return;
    }
    if (name === "message" && typeof data.text === "string") {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id.startsWith("live-")) {
          return [...prev.slice(0, -1), { ...last, id: nextId(), text: data.text as string }];
        }
        return [...prev, { id: nextId(), role: "agent", text: data.text as string }];
      });
      return;
    }
    if (name === "progress") {
      const filled = Number(data.filled ?? 0);
      const total = Number(data.total ?? 0);
      setRatio(total > 0 ? Math.min(0.95, filled / total) : 0);
      return;
    }
    if (name === "done" && typeof data.step === "string") {
      setStepKey(data.step as string);
      setRatio(0);
      return;
    }
    if (name === "slots" && Array.isArray(data.slots)) {
      setSlots(data.slots as Slot[]);
      return;
    }
    if (name === "booking") {
      setBooking(data as unknown as Booking);
      setSlots([]);
      return;
    }
    if (name === "lead" && typeof data.reference === "string") {
      setLeadRef(data.reference as string);
      return;
    }
    if (name === "handoff") {
      setHandoffOpen(true);
      setShowForm(true);
      return;
    }
    if (name === "error") {
      setError(typeof data.message === "string" ? data.message : "Une erreur est survenue.");
    }
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || phase === "streaming") return;
      setError(null);
      setDraft("");
      setSlots([]);
      setPhase("streaming");
      setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        let sid = sessionId;
        if (!sid) {
          const opening = await fetch("/api/agent/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: controller.signal,
          });
          if (!opening.ok) throw new Error(`HTTP ${opening.status}`);
          const opened = (await opening.json()) as { session_id?: string };
          if (!opened.session_id) throw new Error("Session sans identifiant");
          sid = opened.session_id;
          setSessionId(sid);
        }
        const response = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sid, message: text }),
          signal: controller.signal,
        });

        if (response.status === 404) {
          // Session expirée côté serveur : on en ouvre une neuve et on rejoue le message.
          sessionStorage.removeItem(STORAGE_KEY);
          setSessionId(null);
          setPhase("idle");
          setError("La conversation a expiré, renvoyez votre message.");
          return;
        }
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const blocks = buffer.split("\n\n");
          buffer = blocks.pop() ?? "";
          for (const block of blocks) {
            const parsed = parseBlock(block);
            if (parsed) handleEvent(parsed.event, parsed.data);
          }
        }
        setPhase((prev) => (prev === "offline" ? prev : "done"));
      } catch (caught) {
        if ((caught as Error).name === "AbortError") return;
        setPhase("offline");
        setError("L'assistant ne répond pas pour le moment. Le formulaire reste disponible juste en dessous.");
      } finally {
        abortRef.current = null;
      }
    },
    [handleEvent, phase, sessionId],
  );

  useEffect(() => () => abortRef.current?.abort(), []);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(draft);
    }
  };

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadState === "sending") return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const payload: Record<string, string> = {
      name: String(values.get("name") ?? ""),
      email: String(values.get("email") ?? ""),
      phone: String(values.get("phone") ?? ""),
      project_type: String(values.get("project_type") ?? ""),
      budget: String(values.get("budget") ?? ""),
      message: String(values.get("message") ?? ""),
      consent: values.get("consent") ? "on" : "",
      session_id: sessionId ?? "",
    };
    setLeadState("sending");
    setLeadErrors({});
    try {
      const response = await fetch("/api/agent/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (response.status === 422) {
        const body = (await response.json()) as { detail?: { errors?: Record<string, string> } };
        setLeadErrors(body.detail?.errors ?? {});
        setLeadState("idle");
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { reference: string; session_id?: string };
      setLeadRef(body.reference);
      if (body.session_id) setSessionId(body.session_id);
      setLeadState("sent");
    } catch {
      setLeadState("idle");
      setError("L'envoi a échoué. Réessayez ou écrivez directement à s.sujeepan.pro@gmail.com.");
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    sessionStorage.removeItem(STORAGE_KEY);
    setMessages([{ id: "welcome", role: "agent", text: WELCOME }]);
    setSessionId(null);
    setPhase("idle");
    setDraft("");
    setError(null);
    setStepKey("accueil");
    setRatio(0);
    setSlots([]);
    setBooking(null);
    setShowForm(false);
    setHandoffOpen(false);
    setLeadRef(null);
    setLeadState("idle");
    setLeadErrors({});
    inputRef.current?.focus();
  };

  const busy = phase === "streaming";

  return (
    <div className={styles.shell}>
      <section className={styles.brief} aria-label="Comment ça marche">
        <p className="kick">
          <span className="live-dot" aria-hidden="true" />
          Assistant · réponse immédiate
        </p>
        <h1 className={`display ${styles.title}`}>
          Parlons de <em>votre projet</em>.
        </h1>
        <p className={styles.lead}>
          Décrivez votre besoin en quelques phrases. L'assistant cerne le contexte, propose une fourchette
          budgétaire, puis vous ouvre un créneau d'appel de 30 minutes avec Sujee.
        </p>

        <ol className={styles.steps} aria-label="Progression de la conversation">
          {STEPS.map((step, index) => {
            const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "todo";
            return (
              <li key={step.key} className={styles[`step_${state}`]}>
                <span className={styles.stepDot} aria-hidden="true" />
                <span className={styles.stepLabel}>{step.label}</span>
              </li>
            );
          })}
        </ol>

        <dl className={styles.facts}>
          <div>
            <dt>Réponse</dt>
            <dd>Sous 24 h ouvrées</dd>
          </div>
          <div>
            <dt>Premier échange</dt>
            <dd>30 min, sans engagement</dd>
          </div>
          <div>
            <dt>Zone</dt>
            <dd>Paris · Cergy · à distance</dd>
          </div>
        </dl>

        <div className={styles.direct}>
          <p>Vous préférez le direct ?</p>
          <a href="mailto:s.sujeepan.pro@gmail.com?subject=Un%20projet">s.sujeepan.pro@gmail.com</a>
          <a href="tel:+33612345678">06 12 34 56 78</a>
        </div>
      </section>

      <section className={styles.panel} aria-label="Conversation avec l'assistant">
        <div className={styles.halo} aria-hidden="true" />
        <div className={styles.frame}>
          <header className={styles.panelHead}>
            <div className={styles.ident}>
              <span className={styles.pulse} aria-hidden="true" />
              <span className={styles.identText}>
                <strong>Assistant Sujee</strong>
                <span>{busy ? "écrit…" : "en ligne"}</span>
              </span>
            </div>
            <div className={styles.meter} aria-hidden="true">
              <span className={styles.meterLabel}>{String(progress).padStart(3, "0")}%</span>
              <span className={styles.meterTrack}>
                <span className={styles.meterFill} style={{ transform: `scaleX(${progress / 100})` }} />
              </span>
            </div>
          </header>

          <div className={styles.log} ref={logRef} aria-live="polite" aria-busy={busy}>
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? styles.turnUser : styles.turnAgent}>
                <span className={styles.turnLabel}>{message.role === "user" ? "Vous" : "Assistant"}</span>
                <p className={styles.bubble}>{message.text}</p>
              </div>
            ))}

            {busy && (
              <div className={styles.turnAgent}>
                <span className={styles.turnLabel}>Assistant</span>
                <span className={styles.typing} aria-label="L'assistant écrit">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            )}

            {slots.length > 0 && (
              <div className={styles.slots}>
                {slots.map((slot) => (
                  <button key={slot.id} type="button" onClick={() => void send(slot.label)} disabled={busy}>
                    {slot.label}
                  </button>
                ))}
              </div>
            )}

            {booking && (
              <div className={styles.confirm} role="status">
                <span className={styles.confirmTag}>Créneau réservé</span>
                <strong>{booking.label}</strong>
                <span className={styles.ref}>Réf. {booking.reference}</span>
                <p>
                  {booking.mail_sent
                    ? "Une confirmation vient de partir par email. Sujee vous rappelle au numéro indiqué."
                    : "Sujee vous confirme le créneau par email sous 24 h ouvrées."}
                </p>
              </div>
            )}
          </div>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <form className={styles.composer} onSubmit={onSubmit}>
            <textarea
              id="contact-message"
              ref={inputRef}
              aria-label="Votre message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              placeholder={busy ? "L'assistant répond…" : "Décrivez votre projet, votre deadline, votre budget…"}
              rows={1}
              maxLength={4000}
              disabled={busy}
            />
            <button type="submit" className={styles.send} disabled={busy || !draft.trim()} aria-label="Envoyer">
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M4 12h15M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </form>

          <div className={styles.panelFoot}>
            <button type="button" className={styles.linkish} onClick={() => setShowForm((value) => !value)}>
              {showForm ? "Masquer le formulaire" : "Je préfère écrire un message"}
            </button>
            {messages.length > 1 && (
              <button type="button" className={styles.linkish} onClick={reset}>
                Recommencer
              </button>
            )}
          </div>

          {showForm && (
            <form className={styles.handoff} onSubmit={submitLead} noValidate>
              {leadRef && leadState === "sent" ? (
                <div className={styles.leadDone} role="status">
                  <span className={styles.confirmTag}>Demande enregistrée</span>
                  <strong>Réf. {leadRef}</strong>
                  <p>Votre message est arrivé. Sujee revient vers vous sous 24 h ouvrées.</p>
                </div>
              ) : (
                <>
                  <p className={styles.handoffIntro}>
                    {handoffOpen
                      ? "On continue par écrit : laissez vos coordonnées, Sujee reprend la conversation."
                      : "Laissez vos coordonnées et votre besoin, Sujee vous répond personnellement."}
                  </p>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span>Nom</span>
                      <input
                        name="name"
                        required
                        autoComplete="name"
                        defaultValue={lead.name}
                        onChange={(event) => setLead({ ...lead, name: event.target.value })}
                        aria-invalid={Boolean(leadErrors["cf-name"])}
                      />
                      {leadErrors["cf-name"] && <em>{leadErrors["cf-name"]}</em>}
                    </label>
                    <label className={styles.field}>
                      <span>Email</span>
                      <input
                        name="email"
                        type="email"
                        required
                        autoComplete="email"
                        onChange={(event) => setLead({ ...lead, email: event.target.value })}
                        aria-invalid={Boolean(leadErrors["cf-email"])}
                      />
                      {leadErrors["cf-email"] && <em>{leadErrors["cf-email"]}</em>}
                    </label>
                  </div>
                  <div className={styles.row}>
                    <label className={styles.field}>
                      <span>Téléphone</span>
                      <input
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        onChange={(event) => setLead({ ...lead, phone: event.target.value })}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Budget envisagé</span>
                      <input
                        name="budget"
                        placeholder="ex. 3 000 à 5 000 €"
                        onChange={(event) => setLead({ ...lead, budget: event.target.value })}
                      />
                    </label>
                  </div>
                  <label className={styles.field}>
                    <span>Type de projet</span>
                    <select
                      name="project_type"
                      defaultValue=""
                      onChange={(event) => setLead({ ...lead, project_type: event.target.value })}
                    >
                      <option value="">Choisir</option>
                      {PROJECT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Votre projet</span>
                    <textarea
                      name="message"
                      rows={3}
                      required
                      maxLength={4000}
                      aria-invalid={Boolean(leadErrors["cf-message"])}
                    />
                    {leadErrors["cf-message"] && <em>{leadErrors["cf-message"]}</em>}
                  </label>
                  <label className={styles.consent}>
                    <input type="checkbox" name="consent" required />
                    <span>
                      J'accepte que mes données soient utilisées pour répondre à ma demande. Aucune revente,
                      aucun spam.
                    </span>
                  </label>
                  {leadErrors["cf-consent"] && <em className={styles.fieldError}>{leadErrors["cf-consent"]}</em>}
                  <button type="submit" className="btn-fill" disabled={leadState === "sending"}>
                    {leadState === "sending" ? "Envoi…" : "Envoyer ma demande"}
                  </button>
                </>
              )}
            </form>
          )}

          <p className={styles.legal}>
            Données utilisées uniquement pour traiter votre demande, conservées 24 mois.{" "}
            <a href="/mentions-legales">En savoir plus</a>
          </p>
        </div>
      </section>
    </div>
  );
}
