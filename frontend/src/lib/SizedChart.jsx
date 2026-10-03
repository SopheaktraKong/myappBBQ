import { useEffect, useRef, useState } from "react";

/** Measures a container and gives you numeric width; children are only rendered when width > 0. */
export default function SizedChart({ children, height = 256, className = "" }) {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const measure = () => {
      const w = el.clientWidth;
      if (w > 0) setWidth(w);
    };
    measure();
    const obs = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = Math.floor(e.contentRect.width);
        if (w > 0) setWidth(w);
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: "100%", height }} className={className}>
      {width > 0 && children({ width, height })}
    </div>
  );
}
