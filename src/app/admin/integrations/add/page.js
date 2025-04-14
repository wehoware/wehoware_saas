"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, InfoIcon } from "lucide-react";
import { toast } from "react-hot-toast";

export default function AddIntegrationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const providerId = searchParams.get("provider");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [providers, setProviders] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState(null);

  const [integration, setIntegration] = useState({
    name: "",
    provider_id: providerId || "",
    api_key: "",
    api_secret: "",
    config: {},
    status: "Active",
    sync_frequency: "daily",
  });

  useEffect(() => {
    fetchProviders();
  }, []);

  useEffect(() => {
    if (providerId && providers.length > 0) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider) {
        setSelectedProvider(provider);
        setIntegration((prev) => ({
          ...prev,
          name: `${provider.name} Integration`,
          provider_id: provider.id,
        }));
      }
    }
  }, [providerId, providers]);

  async function fetchProviders() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("wehoware_integration_providers")
        .select("*")
        .order("name");

      if (error) throw error;
      setProviders(data || []);
    } catch (error) {
      console.error("Error fetching providers:", error.message);
      toast.error("Failed to load integration providers");
    } finally {
      setLoading(false);
    }
  }

  const handleProviderChange = (e) => {
    const id = e.target.value;
    const provider = providers.find((p) => p.id === id);
    setSelectedProvider(provider);
    setIntegration({
      ...integration,
      provider_id: id,
      name: provider ? `${provider.name} Integration` : "",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setIntegration({ ...integration, [name]: value });
  };

  const handleConfigChange = (key, value) => {
    setIntegration({
      ...integration,
      config: { ...(integration.config || {}), [key]: value },
    });
  };

  const saveIntegration = async (e) => {
    e.preventDefault();

    if (!integration.name || !integration.provider_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setSaving(true);

      const { data, error } = await supabase
        .from("wehoware_integrations")
        .insert([
          {
            ...integration,
            config: integration.config || {},
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        toast.success("Integration added successfully");
        router.push("/admin/integrations");
      }
    } catch (error) {
      console.error("Error saving integration:", error.message);
      toast.error("Failed to save integration");
    } finally {
      setSaving(false);
    }
  };

  // Function to render provider-specific configuration fields
  const renderProviderConfig = () => {
    if (!selectedProvider) return null;

    switch (selectedProvider.name) {
      case "Mailchimp":
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                List ID
              </label>
              <input
                type="text"
                value={integration.config?.list_id || ""}
                onChange={(e) => handleConfigChange("list_id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. abc123def"
              />
              <p className="mt-1 text-xs text-gray-500">
                Your Mailchimp list/audience ID
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Server
              </label>
              <input
                type="text"
                value={integration.config?.server || ""}
                onChange={(e) => handleConfigChange("server", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="e.g. us1"
              />
              <p className="mt-1 text-xs text-gray-500">
                The server prefix from your API key (e.g. &quot;us1&quot;)
              </p>
            </div>
          </>
        );

      case "HubSpot":
        return (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Portal ID
              </label>
              <input
                type="text"
                value={integration.config?.portal_id || ""}
                onChange={(e) =>
                  handleConfigChange("portal_id", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Form ID
              </label>
              <input
                type="text"
                value={integration.config?.form_id || ""}
                onChange={(e) => handleConfigChange("form_id", e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: For form submissions
              </p>
            </div>
          </>
        );

      case "Google Analytics":
        return (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tracking ID
            </label>
            <input
              type="text"
              value={integration.config?.tracking_id || ""}
              onChange={(e) =>
                handleConfigChange("tracking_id", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="e.g. UA-XXXXXXXXX-X or G-XXXXXXXXXX"
            />
          </div>
        );

      default:
        return (
          <div className="bg-blue-50 p-4 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <InfoIcon className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  Basic configuration for {selectedProvider.name} integration.
                  Additional settings may be required based on your specific use
                  case.
                </p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <h1 className="text-2xl font-bold">Add New Integration</h1>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading...</p>
        </div>
      ) : (
        <form
          onSubmit={saveIntegration}
          className="bg-white rounded-lg shadow overflow-hidden max-w-3xl mx-auto"
        >
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Integration Provider <span className="text-red-500">*</span>
              </label>
              <select
                value={integration.provider_id}
                onChange={handleProviderChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select a provider</option>
                {providers.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.name} ({provider.category})
                  </option>
                ))}
              </select>
            </div>

            {selectedProvider && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Integration Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={integration.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    A name to identify this integration
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="api_key"
                    value={integration.api_key}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    API Secret
                  </label>
                  <input
                    type="password"
                    name="api_secret"
                    value={integration.api_secret}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Only required for some providers
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sync Frequency
                  </label>
                  <select
                    name="sync_frequency"
                    value={integration.sync_frequency}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="manual">Manual Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    name="status"
                    value={integration.status}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="Active">Active</option>
                    <option value="Paused">Paused</option>
                  </select>
                </div>

                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-md font-medium mb-3">
                    Provider-Specific Configuration
                  </h3>
                  {renderProviderConfig()}
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <Link
              href="/admin/integrations"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving || !selectedProvider}
              className={`px-4 py-2 rounded-md text-white ${
                selectedProvider
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {saving ? "Saving..." : "Save Integration"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
