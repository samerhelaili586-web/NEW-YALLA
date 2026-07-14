function initials(firstName, lastName) {
  return `${firstName?.[0] || ""}${lastName?.[0] || ""}`.toUpperCase();
}

export default function Avatar({ firstName, lastName, size = 40 }) {
  return (
    <div
      className="avatar"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials(firstName, lastName)}
    </div>
  );
}