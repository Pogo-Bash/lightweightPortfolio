import { useState, useEffect } from "react";
import SwapName from "./SwapName";

const API_URL = import.meta.env.PUBLIC_API_URL || "";

export default function VisitorTracker() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function trackVisitor() {
      try {
        // Record visit and get count
        const res = await fetch(`${API_URL}/api/visit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const data = await res.json();
        setCount(data.uniqueVisitors);
      } catch {
        // Fallback: try GET for count only
        try {
          const res = await fetch(`${API_URL}/api/visitors`);
          const data = await res.json();
          setCount(data.uniqueVisitors);
        } catch {
          setCount(0);
        }
      } finally {
        setLoading(false);
      }
    }

    trackVisitor();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center">
      {loading ? (
        <div className="w-full flex items-center justify-center" style={{ height: "280px" }}>
          <div className="font-mono text-swap-dim text-sm animate-pulse">
            loading...
          </div>
        </div>
      ) : (
        <SwapName visitorCount={count} />
      )}
    </div>
  );
}
