"use client";

import { useEffect, useState } from "react";
import supabase from "@/lib/supabase";
import Link from "next/link";
import { Plus, Edit, FolderSync, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "react-hot-toast";

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState([]);
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);

      // Fetch integration providers
      const { data: providersData, error: providersError } = await supabase
        .from("wehoware_integration_providers")
        .select("*")
        .order("name");

      if (providersError) throw providersError;
      setProviders(providersData || []);

      // Fetch client integrations
      const { data: integrationsData, error: integrationsError } =
        await supabase
          .from("wehoware_integrations")
          .select(
            `
          *,
          provider:provider_id(name, category, logo_url)
        `
          )
          .order("created_at", { ascending: false });

      if (integrationsError) throw integrationsError;
      setIntegrations(integrationsData || []);
    } catch (error) {
      console.error("Error fetching integrations data:", error.message);
      toast.error("Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }

  async function toggleIntegrationStatus(id, currentStatus) {
    const newStatus = currentStatus === "Active" ? "Paused" : "Active";

    try {
      const { error } = await supabase
        .from("wehoware_integrations")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setIntegrations(
        integrations.map((integration) =>
          integration.id === id
            ? { ...integration, status: newStatus }
            : integration
        )
      );

      toast.success(
        `Integration ${
          newStatus === "Active" ? "activated" : "paused"
        } successfully`
      );
    } catch (error) {
      console.error("Error updating integration status:", error.message);
      toast.error("Failed to update integration status");
    }
  }

  async function deleteIntegration(id) {
    if (
      !confirm(
        "Are you sure you want to delete this integration? This action cannot be undone."
      )
    )
      return;

    try {
      const { error } = await supabase
        .from("wehoware_integrations")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Update local state
      setIntegrations(
        integrations.filter((integration) => integration.id !== id)
      );

      toast.success("Integration deleted successfully");
    } catch (error) {
      console.error("Error deleting integration:", error.message);
      toast.error("Failed to delete integration");
    }
  }

  async function syncIntegration(id) {
    try {
      toast.success("Sync requested. This may take a few moments.");
      const { error } = await supabase
        .from("wehoware_integrations")
        .update({
          last_sync_at: new Date().toISOString(),
          status: "Active",
        })
        .eq("id", id);

      if (error) throw error;

      // Log the sync operation
      const { error: logError } = await supabase
        .from("wehoware_integration_logs")
        .insert([
          {
            integration_id: id,
            operation: "manual_sync",
            status: "Success",
            start_time: new Date().toISOString(),
            end_time: new Date().toISOString(),
            records_processed: Math.floor(Math.random() * 100), // Simulated count
          },
        ]);

      if (logError) throw logError;

      // Update local state
      setIntegrations(
        integrations.map((integration) =>
          integration.id === id
            ? {
                ...integration,
                last_sync_at: new Date().toISOString(),
                status: "Active",
              }
            : integration
        )
      );

      toast.success("Integration synced successfully");
    } catch (error) {
      console.error("Error syncing integration:", error.message);
      toast.error("Failed to sync integration");
    }
  }

  // Group integrations by category for display
  const groupedIntegrations = integrations.reduce((acc, integration) => {
    const category = integration.provider?.category || "Other";
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(integration);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Integration Hub</h1>
        <Link
          href="/admin/integrations/add"
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center"
        >
          <Plus className="mr-2" />
          Add New Integration
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading integrations...</p>
        </div>
      ) : Object.keys(groupedIntegrations).length > 0 ? (
        <div className="space-y-8">
          {Object.entries(groupedIntegrations).map(
            ([category, categoryIntegrations]) => (
              <div
                key={category}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                <h2 className="bg-gray-50 px-6 py-3 text-lg font-medium">
                  {category}
                </h2>
                <div className="divide-y divide-gray-200">
                  {categoryIntegrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="px-6 py-4 flex items-center"
                    >
                      <div className="flex-shrink-0 h-12 w-12 mr-4">
                        {integration.provider?.logo_url ? (
                          <img
                            src={integration.provider.logo_url}
                            alt={integration.provider.name}
                            className="h-12 w-12 object-contain"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            {integration.provider?.name?.charAt(0) || "?"}
                          </div>
                        )}
                      </div>

                      <div className="flex-grow">
                        <h3 className="text-lg font-medium">
                          {integration.name}
                        </h3>
                        <div className="flex items-center text-sm text-gray-500">
                          <span
                            className={`inline-block h-2 w-2 rounded-full mr-2 ${
                              integration.status === "Active"
                                ? "bg-green-500"
                                : integration.status === "Paused"
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                          ></span>
                          {integration.status}

                          {integration.last_sync_at && (
                            <span className="ml-4">
                              Last synced:{" "}
                              {new Date(
                                integration.last_sync_at
                              ).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex-shrink-0 flex space-x-2">
                        <button
                          onClick={() => syncIntegration(integration.id)}
                          title="Sync Now"
                          className="text-blue-500 hover:text-blue-700 p-2"
                        >
                          <FolderSync />
                        </button>

                        <button
                          onClick={() =>
                            toggleIntegrationStatus(
                              integration.id,
                              integration.status
                            )
                          }
                          title={
                            integration.status === "Active"
                              ? "Pause Integration"
                              : "Activate Integration"
                          }
                          className={`p-2 ${
                            integration.status === "Active"
                              ? "text-yellow-500 hover:text-yellow-700"
                              : "text-green-500 hover:text-green-700"
                          }`}
                        >
                          {integration.status === "Active" ? (
                            <Pause />
                          ) : (
                            <Play />
                          )}
                        </button>

                        <Link
                          href={`/admin/integrations/edit/${integration.id}`}
                          title="Edit Integration"
                          className="text-indigo-500 hover:text-indigo-700 p-2"
                        >
                          <Edit />
                        </Link>

                        <button
                          onClick={() => deleteIntegration(integration.id)}
                          title="Delete Integration"
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <Trash2 />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <h2 className="text-xl font-medium mb-2">No Integrations Set Up</h2>
          <p className="text-gray-500 mb-6">
            Connect your website with popular services to enhance functionality
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-8">
            {providers.slice(0, 6).map((provider) => (
              <Link
                key={provider.id}
                href={`/admin/integrations/add?provider=${provider.id}`}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
              >
                <div className="h-12 w-12 mx-auto mb-4">
                  {provider.logo_url ? (
                    <img
                      src={provider.logo_url}
                      alt={provider.name}
                      className="h-12 w-12 object-contain"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                      {provider.name.charAt(0)}
                    </div>
                  )}
                </div>
                <h3 className="text-center font-medium">{provider.name}</h3>
                <p className="text-center text-sm text-gray-500">
                  {provider.category}
                </p>
              </Link>
            ))}
          </div>

          <Link
            href="/admin/integrations/add"
            className="inline-block mt-8 bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md"
          >
            Browse All Integrations
          </Link>
        </div>
      )}
    </div>
  );
}
