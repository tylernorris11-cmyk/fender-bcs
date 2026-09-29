/** The yellow H that marks a delivery needing a hiab (lorry crane) to unload. */
export function HiabBadge({ size = 18 }: { size?: number }) {
  return (
    <span
      className="inline-grid place-items-center rounded-full bg-yellow-400 text-black font-extrabold leading-none ring-1 ring-black/20"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.6) }}
      title="Needs a hiab"
      aria-label="Needs a hiab"
    >
      H
    </span>
  );
}
