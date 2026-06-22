export default function Avatar({ src, name, size = 36, className = "" }) {
  if (src) return <img src={src} alt={name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover" }} className={className} />;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg, #f09433, #bc1888)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "white", fontWeight: 700, fontSize: size * 0.38, flexShrink: 0
    }} className={className}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}