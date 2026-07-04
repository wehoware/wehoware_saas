"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";
import { Loader2, Save, ExternalLink, CheckCircle2, XCircle } from "lucide-react";

const PROVIDER_FIELDS = [
  {
    name: "openrouter",
    label: "OpenRouter API Key",
    placeholder: "sk-or-v1-...",
    signupUrl: "https://openrouter.ai/keys",
    description: "Free models: Llama 3.3 70B, Kimi K2.6, and more",
  },
];

export function ApiKeyDialog({ open, onOpenChange, keyStatus, onSave }) {
  const [keys, setKeys] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setKeys({});
    }
  }, [open]);

  const handleKeyChange = (providerName, value) => {
    setKeys((prev) => ({ ...prev, [providerName]: value }));
  };

  const handleSave = async () => {
    const hasChanges = Object.values(keys).some(
      (v) => v !== undefined && v !== ""
    );
    if (!hasChanges) {
      toast.error("No API keys entered to save.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(keys);
      setKeys({});
    } catch (error) {
      toast.error("Failed to save API keys. " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure LLM API Keys</DialogTitle>
          <DialogDescription>
            Enter your API keys below. Keys are encrypted with AES-256-GCM
            before storage. Leave blank to clear an existing key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {PROVIDER_FIELDS.map((field) => {
            const isConfigured = keyStatus?.[field.name] ?? false;
            const hasNewValue = keys[field.name]?.length > 0;

            return (
              <div key={field.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={field.name} className="text-sm font-medium">
                    {field.label}
                  </Label>
                  <div className="flex items-center gap-2">
                    {isConfigured && !hasNewValue ? (
                      <span className="inline-flex items-center text-xs text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Configured
                      </span>
                    ) : hasNewValue ? (
                      <span className="inline-flex items-center text-xs text-blue-600">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        New key entered
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs text-gray-400">
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Not set
                      </span>
                    )}
                    <a
                      href={field.signupUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs text-blue-500 hover:text-blue-600"
                    >
                      Get Key
                      <ExternalLink className="h-3 w-3 ml-0.5" />
                    </a>
                  </div>
                </div>
                <Input
                  id={field.name}
                  type="password"
                  placeholder={field.placeholder}
                  value={keys[field.name] || ""}
                  onChange={(e) => handleKeyChange(field.name, e.target.value)}
                  autoComplete="off"
                />
                <p className="text-xs text-muted-foreground">
                  {field.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">
            Your API keys are encrypted at rest using AES-256-GCM. They are
            never exposed to the client after saving. If no key is set here,
            the system falls back to server-wide environment variables.
          </p>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" /> Save Keys
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApiKeyDialog;
