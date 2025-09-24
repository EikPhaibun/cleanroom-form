import React from "react";

export default function DocNoField({ value, onChange, onGenerate, loading }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <input
        className="inp"
        type="text"
        value={value}
        placeholder="auto from cloud..."
        onChange={(e) => onChange?.(e.target.value)}
      />
      <button
        type="button"
        className="btn"
        onClick={onGenerate}
        disabled={loading}
        title="ขอเลขเอกสารอัตโนมัติ"
      >
        {loading ? "..." : "Generate"}
      </button>
    </div>
  );
}
