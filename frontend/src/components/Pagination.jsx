import React from "react";
import "./Pagination.css";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  totalItems,
  pageSize,
}) {
  if (totalPages <= 1) return null;

  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    pages.push(i);
  }

  return (
    <div className="pg-wrap">
      {totalItems !== undefined && (
        <span className="pg-info">
          Affichage de {Math.min((currentPage - 1) * pageSize + 1, totalItems)}–
          {Math.min(currentPage * pageSize, totalItems)} sur {totalItems} résultats
        </span>
      )}

      <div className="pg-controls">
        <button
          type="button"
          className="pg-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          ← Précédent
        </button>

        <div className="pg-numbers">
          {pages.map((p) => (
            <button
              key={p}
              type="button"
              className={`pg-num ${p === currentPage ? "is-active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="pg-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
