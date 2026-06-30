"use client";

import { type Conversation, sortByRecent } from "@/lib/conversations";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  open: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

export default function Sidebar({
  conversations,
  activeId,
  open,
  onSelect,
  onNew,
  onDelete,
  onClose,
}: Props) {
  const sorted = sortByRecent(conversations);

  return (
    <>
      {open && <div className="sidebar__backdrop" onClick={onClose} />}
      <aside className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <button className="sidebar__new" onClick={onNew}>
          + Nouvelle conversation
        </button>

        <div className="sidebar__list">
          {sorted.length === 0 && (
            <p className="sidebar__empty">Aucune conversation</p>
          )}
          {sorted.map((c) => (
            <div
              key={c.id}
              className={`conv ${c.id === activeId ? "conv--active" : ""}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="conv__main">
                <span className="conv__title">{c.title}</span>
                <span className="conv__time">{formatDate(c.updatedAt)}</span>
              </div>
              <button
                className="conv__del"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                aria-label="Supprimer la conversation"
                title="Supprimer"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
