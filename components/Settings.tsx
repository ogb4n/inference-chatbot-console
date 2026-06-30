"use client";

import { useEffect, useState } from "react";
import {
  type ApiConfig,
  type Provider,
  PRESETS,
  resolveEndpoint,
} from "@/lib/config";
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

  function applyPreset(partial: Partial<ApiConfig>) {
    setDraft((d) => ({ ...d, ...partial }));
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
        : "Connexion impossible ou liste de modèles indisponible."
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
          <h2 className="settings__title">Serveur d&apos;inférence</h2>
          <button className="settings__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </div>

        <div className="settings__presets">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="settings__preset"
              onClick={() => applyPreset(p.config)}
            >
              {p.label}
            </button>
          ))}
        </div>

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
          <span>URL du serveur</span>
          <input
            type="text"
            value={draft.baseUrl}
            onChange={(e) => set("baseUrl", e.target.value)}
            placeholder="http://localhost:11434"
          />
        </label>

        <label className="settings__field">
          <span>Modèle</span>
          <input
            type="text"
            value={draft.model}
            onChange={(e) => set("model", e.target.value)}
            placeholder="llama3"
            list="model-options"
          />
          <datalist id="model-options">
            {models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        </label>

        <label className="settings__field">
          <span>Clé API (optionnelle)</span>
          <input
            type="password"
            value={draft.apiKey}
            onChange={(e) => set("apiKey", e.target.value)}
            placeholder="vide pour Ollama / Triton local"
          />
        </label>

        <label className="settings__check">
          <input
            type="checkbox"
            checked={draft.stream}
            onChange={(e) => set("stream", e.target.checked)}
          />
          <span>Réponse en streaming (mot à mot)</span>
        </label>

        <p className="settings__endpoint">
          Endpoint : <code>{resolveEndpoint(draft)}</code>
        </p>

        <div className="settings__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={probe}
            disabled={probing}
          >
            {probing ? "Test…" : "Tester la connexion"}
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
