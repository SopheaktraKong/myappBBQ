import { useEffect, useRef, useState } from "react";

/** Defers children render until the wrapper has non-zero width (avoids Recharts -1/-1 warning). */
export default function SizeReady({ children, height = 256, className = "" }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    if (el.clientWidth > 0) { setReady(true); return; }
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.contentRect.width > 0) { setReady(true); obs.disconnect(); break; }
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height }} className={className}>
      {ready && children}
    </div>
  );
}
