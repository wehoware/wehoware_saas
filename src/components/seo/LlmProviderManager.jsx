"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "react-hot-toast";
import {
  Loader2,
  KeyRound,
  Zap,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/auth-context";
import { ApiKeyDialog } from "./ApiKeyDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HEALTH_BADGE = {
  healthy: { label: "Healthy", variant: "default", className: "bg-green-100 text-green-700 border-green-200" },
  rate_limited: { label: "Rate Limited", variant: "default", className: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  error: { label: "Error", variant: "default", className: "bg-red-100 text-red-700 border-red-200" },
  circuit_open: { label: "Circuit Open", variant: "default", className: "bg-orange-100 text-orange-700 border-orange-200" },
  unknown: { label: "Unknown", variant: "secondary", className: "bg-gray-100 text-gray-500 border-gray-200" },
};

function HealthBadge({ status }) {
  const config = HEALTH_BADGE[status] || HEALTH_BADGE.unknown;
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  );
}

function formatNumber(num) {
  if (!num) return "0";
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "Never";
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function LlmProviderManager() {
  const { activeClient } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [providers, setProviders] = useState([]);
  const [settings, setSettings] = useState({
    providerMode: "auto",
    manualProvider: null,
    autoFailover: true,
  });
  const [keyStatus, setKeyStatus] = useState({});
  const [isApiKeyDialogOpen, setIsApiKeyDialogOpen] = useState(false);
  const [testingProvider, setTestingProvider] = useState(null);
  const [resettingProvider, setResettingProvider] = useState(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [availableModels, setAvailableModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelFilter, setModelFilter] = useState("free");
  const [savingModel, setSavingModel] = useState(null);

  const fetchData = useCallback(async () => {
    if (!activeClient?.id) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/seo/llm-providers");
      if (!res.ok) throw new Error("Failed to load LLM providers");
      const json = await res.json();
      setProviders(json.data || []);
      setSettings(json.settings || {});
      const statusMap = {};
      (json.data || []).forEach((p) => {
        statusMap[p.providerName] = p.isConfigured;
      });
      setKeyStatus(statusMap);
    } catch (error) {
      toast.error("Failed to load LLM providers. " + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeClient?.id]);

  useEffect(() => {
    if (activeClient?.id) {
      fetchData();
    } else {
      setIsLoading(false);
    }
  }, [activeClient?.id, fetchData]);

  const fetchModels = useCallback(async (filter = modelFilter) => {
    setModelsLoading(true);
    try {
      const res = await fetch(`/api/v1/seo/llm-providers/models?filter=${filter}`);
      if (!res.ok) throw new Error("Failed to fetch models");
      const json = await res.json();
      setAvailableModels(json.data || []);
    } catch (error) {
      toast.error("Failed to load models. " + error.message);
      setAvailableModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [modelFilter]);

  useEffect(() => {
    if (activeClient?.id) {
      fetchModels();
    }
  }, [activeClient?.id, fetchModels]);

  const handleSaveKeys = async (keys) => {
    const res = await fetch("/api/v1/seo/llm-providers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keys }),
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.error || "Failed to save API keys");
    }
    toast.success("API keys saved successfully!");
    setIsApiKeyDialogOpen(false);
    fetchData();
  };

  const handleTestProvider = async (providerName) => {
    setTestingProvider(providerName);
    try {
      const res = await fetch(
        `/api/v1/seo/llm-providers/${providerName}/test`,
        { method: "POST" }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(
          `${providerName} is healthy (${json.latencyMs}ms, model: ${json.model})`
        );
      } else {
        toast.error(`${providerName} test failed: ${json.error || "Unknown error"}`);
      }
      fetchData();
    } catch (error) {
      toast.error("Test request failed. " + error.message);
    } finally {
      setTestingProvider(null);
    }
  };

  const handleToggleProvider = async (providerName, currentEnabled) => {
    try {
      const res = await fetch(
        `/api/v1/seo/llm-providers/${providerName}/toggle`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to toggle provider");
      const json = await res.json();
      toast.success(
        `${providerName} ${json.isEnabled ? "enabled" : "disabled"}`
      );
      fetchData();
    } catch (error) {
      toast.error("Failed to toggle provider. " + error.message);
    }
  };

  const handleResetProvider = async (providerName) => {
    setResettingProvider(providerName);
    try {
      const res = await fetch(
        `/api/v1/seo/llm-providers/${providerName}/reset`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to reset provider");
      toast.success(`${providerName} health state reset.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to reset provider. " + error.message);
    } finally {
      setResettingProvider(null);
    }
  };

  const handleModelChange = async (providerName, modelType, value) => {
    setSavingModel(`${providerName}-${modelType}`);
    try {
      const res = await fetch("/api/v1/seo/llm-providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerName,
          [`${modelType}Model`]: value,
        }),
      });
      if (!res.ok) throw new Error("Failed to update model");
      toast.success(`${modelType} model updated for ${providerName}.`);
      fetchData();
    } catch (error) {
      toast.error("Failed to update model. " + error.message);
    } finally {
      setSavingModel(null);
    }
  };

  const handleModelFilterChange = (newFilter) => {
    setModelFilter(newFilter);
    fetchModels(newFilter);
  };

  const handleModeChange = async (newMode) => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/v1/seo/llm-providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerMode: newMode }),
      });
      if (!res.ok) throw new Error("Failed to update mode");
      setSettings((prev) => ({ ...prev, providerMode: newMode }));
      toast.success(`Switched to ${newMode} mode.`);
    } catch (error) {
      toast.error("Failed to update mode. " + error.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAutoFailoverChange = async (value) => {
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/v1/seo/llm-providers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoFailover: value }),
      });
      if (!res.ok) throw new Error("Failed to update failover setting");
      setSettings((prev) => ({ ...prev, autoFailover: value }));
      toast.success(`Auto-failover ${value ? "enabled" : "disabled"}.`);
    } catch (error) {
      toast.error("Failed to update failover setting. " + error.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!activeClient?.id) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Please select a client to configure LLM providers.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Mode + Failover Settings Card */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>LLM Provider Configuration</CardTitle>
          <CardDescription>
            Configure how the SEO Analyser accesses free LLM APIs. Keys are
            encrypted with AES-256-GCM before storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Mode Toggle */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Mode</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleModeChange("auto")}
                  disabled={isSavingSettings}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    settings.providerMode === "auto"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Auto
                </button>
                <button
                  type="button"
                  onClick={() => handleModeChange("manual")}
                  disabled={isSavingSettings}
                  className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                    settings.providerMode === "manual"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {/* Auto Failover Toggle */}
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium">Auto Failover</Label>
              <Switch
                checked={settings.autoFailover}
                onCheckedChange={handleAutoFailoverChange}
                disabled={isSavingSettings}
              />
              <span className="text-xs text-muted-foreground">
                {settings.autoFailover
                  ? "Switch to next provider on failure"
                  : "Stop on first provider failure"}
              </span>
            </div>

            {/* API Keys Button */}
            <div className="ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsApiKeyDialogOpen(true)}
              >
                <KeyRound className="h-4 w-4 mr-2" />
                Configure API Keys
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Providers Table */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Providers</CardTitle>
              <CardDescription>
                Free-tier LLM providers for SEO analysis. Test connectivity, toggle
                availability, and monitor usage.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground">Model Filter</Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleModelFilterChange("free")}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    modelFilter === "free"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => handleModelFilterChange("all")}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    modelFilter === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-white text-gray-600 border-gray-300 hover:border-gray-400"
                  }`}
                >
                  All
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {providers.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No providers configured. Click &ldquo;Configure API Keys&rdquo; to get
              started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>API Key</TableHead>
                  <TableHead>Models</TableHead>
                  <TableHead>Usage</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {providers.map((provider) => (
                  <TableRow key={provider.providerName}>
                    <TableCell>
                      <div className="font-medium">
                        {provider.displayName}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {provider.freeQuota
                          ? `${provider.freeQuota.rpm} RPM / ${provider.freeQuota.rpd} RPD`
                          : ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      <HealthBadge status={provider.healthStatus} />
                      {provider.lastErrorMessage && (
                        <div
                          className="text-xs text-red-500 mt-1 max-w-xs truncate"
                          title={provider.lastErrorMessage}
                        >
                          {provider.lastErrorMessage}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {provider.isConfigured ? (
                        <span className="inline-flex items-center text-xs text-green-600">
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Set
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-xs text-gray-400">
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Not set
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2 min-w-[200px]">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Analysis Model</Label>
                          <Select
                            value={provider.modelOverrides?.analysis || provider.models?.analysis || ""}
                            onValueChange={(v) => handleModelChange(provider.providerName, "analysis", v)}
                            disabled={savingModel === `${provider.providerName}-analysis`}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {modelsLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              )}
                              {!modelsLoading && availableModels.length === 0 && (
                                <div className="text-xs text-muted-foreground px-3 py-2">
                                  No models available
                                </div>
                              )}
                              {!modelsLoading && availableModels.length > 0 && (
                                <>
                                  <SelectItem value="__reset__" className="text-xs italic text-muted-foreground">
                                    Reset to default
                                  </SelectItem>
                                  {availableModels.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                      <span className="truncate">{m.name}</span>
                                      {m.isFree && (
                                        <span className="ml-1 text-green-600 text-[10px]">free</span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          {provider.modelOverrides?.analysis && (
                            <span className="text-[10px] text-blue-600">override active</span>
                          )}
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1 block">Suggestion Model</Label>
                          <Select
                            value={provider.modelOverrides?.suggestion || provider.models?.suggestion || ""}
                            onValueChange={(v) => handleModelChange(provider.providerName, "suggestion", v)}
                            disabled={savingModel === `${provider.providerName}-suggestion`}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Select model" />
                            </SelectTrigger>
                            <SelectContent className="max-h-[300px]">
                              {modelsLoading && (
                                <div className="flex items-center justify-center py-4">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                </div>
                              )}
                              {!modelsLoading && availableModels.length === 0 && (
                                <div className="text-xs text-muted-foreground px-3 py-2">
                                  No models available
                                </div>
                              )}
                              {!modelsLoading && availableModels.length > 0 && (
                                <>
                                  <SelectItem value="__reset__" className="text-xs italic text-muted-foreground">
                                    Reset to default
                                  </SelectItem>
                                  {availableModels.map((m) => (
                                    <SelectItem key={m.id} value={m.id} className="text-xs">
                                      <span className="truncate">{m.name}</span>
                                      {m.isFree && (
                                        <span className="ml-1 text-green-600 text-[10px]">free</span>
                                      )}
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                          {provider.modelOverrides?.suggestion && (
                            <span className="text-[10px] text-blue-600">override active</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs">
                        <div>{formatNumber(provider.totalRequests)} requests</div>
                        <div className="text-muted-foreground">
                          {formatNumber(provider.totalTokensUsed)} tokens
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(provider.lastUsedAt)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={provider.isEnabled}
                        onCheckedChange={() =>
                          handleToggleProvider(
                            provider.providerName,
                            provider.isEnabled
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleTestProvider(provider.providerName)
                          }
                          disabled={testingProvider === provider.providerName}
                          title="Test connectivity"
                        >
                          {testingProvider === provider.providerName ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Zap className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleResetProvider(provider.providerName)
                          }
                          disabled={
                            resettingProvider === provider.providerName
                          }
                          title="Reset health state"
                        >
                          {resettingProvider === provider.providerName ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <RotateCcw className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <ApiKeyDialog
        open={isApiKeyDialogOpen}
        onOpenChange={setIsApiKeyDialogOpen}
        keyStatus={keyStatus}
        onSave={handleSaveKeys}
      />
    </div>
  );
}

export default LlmProviderManager;
