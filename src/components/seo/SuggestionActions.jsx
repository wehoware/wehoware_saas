"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, X, Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

/**
 * Approve / Reject / Apply action buttons for a single suggestion.
 *
 * @param {Object} props
 * @param {string} props.suggestionId - The suggestion ID
 * @param {string} props.status - Current suggestion status
 * @param {Function} [props.onActioned] - Callback after an action completes
 */
export default function SuggestionActions({ suggestionId, status, onActioned }) {
  const [loading, setLoading] = useState(null);

  const handleAction = async (action) => {
    setLoading(action);
    try {
      const res = await fetch("/api/v1/seo-analyser/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} suggestion`);
      toast.success(`Suggestion ${action === "apply" ? "applied" : action + "d"} successfully`);
      if (onActioned) onActioned(action);
    } catch {
      toast.error(`Failed to ${action} suggestion`);
    } finally {
      setLoading(null);
    }
  };

  if (status !== "pending") return null;

  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={() => handleAction("apply")} disabled={loading !== null}>
        {loading === "apply" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Check className="h-3 w-3 mr-1" />}
        Apply Fix
      </Button>
      <Button size="sm" variant="outline" onClick={() => handleAction("approve")} disabled={loading !== null}>
        Approve
      </Button>
      <Button size="sm" variant="ghost" onClick={() => handleAction("reject")} disabled={loading !== null}>
        {loading === "reject" ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <X className="h-3 w-3 mr-1" />}
        Reject
      </Button>
    </div>
  );
}
