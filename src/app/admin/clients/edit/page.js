"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";

export default function EditClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = searchParams.get("id");

  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!clientId) {
      toast.error("Client ID not provided");
      router.push("/admin/clients");
      return;
    }

    const fetchClient = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from("wehoware_clients")
          .select("*")
          .eq("id", clientId)
          .single();

        if (error) throw error;
        setClient(data);
      } catch (error) {
        console.error("Error fetching client:", error);
        toast.error(error.message || "Failed to fetch client");
        router.push("/admin/clients");
      } finally {
        setIsLoading(false);
      }
    };

    fetchClient();
  }, [clientId, router]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setClient({ ...client, [name]: type === "checkbox" ? checked : value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const { error } = await supabase
        .from("wehoware_clients")
        .update({
          ...client,
          updated_at: new Date(),
        })
        .eq("id", clientId);

      if (error) throw error;
      toast.success("Client updated successfully");
      router.push("/admin/clients");
    } catch (error) {
      console.error("Error updating client:", error);
      toast.error(error.message || "Failed to update client");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <AdminPageHeader
        title="Edit Client"
        description="Update client details"
      />
      <form onSubmit={handleSubmit} className="max-w-lg mx-auto space-y-4">
        <div>
          <label htmlFor="company_name" className="block mb-1">
            Company Name<span className="text-destructive">*</span>
          </label>
          <Input
            id="company_name"
            name="company_name"
            value={client?.company_name || ""}
            onChange={handleInputChange}
            required
          />
        </div>
        <div>
          <label htmlFor="contact_person" className="block mb-1">
            Contact Person
          </label>
          <Input
            id="contact_person"
            name="contact_person"
            value={client?.contact_person || ""}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="email" className="block mb-1">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            value={client?.email || ""}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="contact_number" className="block mb-1">
            Contact Number
          </label>
          <Input
            id="contact_number"
            name="contact_number"
            value={client?.contact_number || ""}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="website" className="block mb-1">
            Website
          </label>
          <Input
            id="website"
            name="website"
            value={client?.website || ""}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="address" className="block mb-1">
            Address
          </label>
          <Textarea
            id="address"
            name="address"
            value={client?.address || ""}
            onChange={handleInputChange}
            rows={2}
          />
        </div>
        <div>
          <label htmlFor="industry" className="block mb-1">
            Industry
          </label>
          <Input
            id="industry"
            name="industry"
            value={client?.industry || ""}
            onChange={handleInputChange}
          />
        </div>
        <div>
          <label htmlFor="domain" className="block mb-1">
            Domain
          </label>
          <Input
            id="domain"
            name="domain"
            value={client?.domain || ""}
            onChange={handleInputChange}
          />
        </div>
        <div className="flex items-center">
          <Switch
            id="active"
            name="active"
            checked={client?.active}
            onCheckedChange={(checked) =>
              setClient({ ...client, active: checked })
            }
          />
          <label htmlFor="active" className="ml-2">
            Active
          </label>
        </div>
        <div className="flex justify-end space-x-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Updating..." : "Update Client"}
          </Button>
        </div>
      </form>
    </div>
  );
}
