import { useState } from "react";

function initials(firstName, lastName) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

export default function Avatar({ firstName, lastName, photoUrl, photo_url, src, size = 40 }) {
  const url = photoUrl || photo_url || src;
  const [imgError, setImgError] = useState(false);

  if (url && !imgError) {
    return (
      <img
        src={url}
        alt={`${firstName || ""} ${lastName || ""}`.trim() || "Avatar"}
        className="avatar avatar-img"
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "2px solid rgba(255, 255, 255, 0.8)",
          boxShadow: "0 2px 6px rgba(0, 0, 0, 0.12)",
          flexShrink: 0,
          display: "block",
        }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        fontSize: size * 0.38,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 700,
        background: "linear-gradient(135deg, #3b82f6, #1d4ed8)",
        color: "#ffffff",
        flexShrink: 0,
        boxShadow: "0 2px 6px rgba(0, 0, 0, 0.1)",
      }}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </div>
  );
}