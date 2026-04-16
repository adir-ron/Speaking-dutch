export default function BrandWordmark() {
  return (
    <div
      className="font-serif"
      style={{
        fontSize: 18,
        fontWeight: 500,
        color: "var(--ink)",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span style={{ color: "var(--accent)", fontSize: 10 }}>&#9679;</span>
      Speaking <em>Dutch</em>
    </div>
  );
}
