"use client";

import { useEffect, useState } from "react";
import { type ApiConfig, type Provider } from "@/lib/config";
import { listModels } from "@/lib/api";

interface Props {
  config: ApiConfig;
  onChange: (config: ApiConfig) => void;
  onClose: () => void;
}

export default function Settings({ config, onChange, onClose }: Props) {
  const [draft, setDraft] = useState<ApiConfig>(config);
  const [models, setModels] = useState<string[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeMsg, setProbeMsg] = useState("");

  useEffect(() => setDraft(config), [config]);

  function set<K extends keyof ApiConfig>(key: K, value: ApiConfig[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  async function probe() {
    setProbing(true);
    setProbeMsg("");
    setModels([]);
    const found = await listModels(draft);
    setModels(found);
    setProbeMsg(
      found.length
        ? `${found.length} modèle(s) détecté(s).`
        : "Aucun modèle détecté (vérifie la config serveur INFERENCE_BASE_URL / INFERENCE_API_KEY)."
    );
    setProbing(false);
  }

  function save() {
    onChange(draft);
    onClose();
  }

  return (
    <div className="settings__backdrop" onClick={onClose}>
      <aside className="settings" onClick={(e) => e.stopPropagation()}>
        <div className="settings__head">
          <h2 className="settings__title">Modèle &amp; protocole</h2>
          <button className="settings__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <p className="settings__note">
          L&apos;URL du serveur et la clé d&apos;API sont configurées côté serveur
          (variables <code>INFERENCE_BASE_URL</code> /{" "}
          <code>INFERENCE_API_KEY</code>). Les appels passent par le proxy{" "}
          <code>/api/chat</code> — aucune clé n&apos;est exposée au navigateur.
        </p>

        <label className="settings__field">
          <span>Protocole</span>
          <select
            value={draft.provider}
            onChange={(e) => set("provider", e.target.value as Provider)}
          >
            <option value="ollama">Ollama (natif)</option>
            <option value="openai">OpenAI-compatible (Triton / maison)</option>
          </select>
        </label>

        <label className="settings__field">
          <span>Modèle</span>
          <input
            type="text"
            value={draft.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="phi3.5"
            list="model-options"
          />
          <datalist id="model-options">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={draft.stream}
            onChange={(e) => set("stream", e.target.checked)}
          />
          <span>Réponse en streaming (mot à mot)</span>
        </label>

        <div className="settings__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={probe}
            disabled={probing}
          >
            {probing ? "Test…" : "Détecter les modèles"}
          </button>
          <button type="button" className="btn btn--primary" onClick={save}>
            Enregistrer
          </button>
        </div>

        {probeMsg && <p className="settings__probe">{probeMsg}</p>}
      </aside>
    </div>
  );
}
