"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "react-hot-toast";
import supabase from "@/lib/supabase";
import AdminPageHeader from "@/components/AdminPageHeader";
import { useAuth } from "@/contexts/auth-context";
import { Loader2 } from "lucide-react";

export default function AddClientPage() {
  const router = useRouter();
  const { user, isEmployee, isLoading: authLoading } = useAuth();

  const [newClient, setNewClient] = useState({
    company_name: "",
    contact_person: "",
    contact_number: "",
    email: "",
    address: "",
    website: "",
    industry: "",
    domain: "",
    active: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        toast.error("Please log in to add a client.");
        router.push("/login");
      } else if (!isEmployee) {
        toast.error("Access Denied: Only employees can add clients.");
        router.push("/admin");
      }
    }
  }, [user, isEmployee, authLoading, router]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewClient({
      ...newClient,
      [name]: type === "checkbox" ? checked : value,
    });
  };

  const handleAddClient = async (e) => {
    e.preventDefault();

    if (!newClient.company_name) {
      toast.error("Company name is required");
      return;
    }

    console.log("Client data:", newClient);

    try {
      setIsSubmitting(true);
      const clientData = {
        ...newClient,
        created_at: new Date(),
        updated_at: new Date(),
      };

      console.log("Client data:", clientData);

      const { data, error } = await supabase
        .from("wehoware_clients")
        .insert(clientData)
        .select();

      console.log("Client added:", data);

      if (error) throw error;
      toast.success("Client added successfully");
      router.push("/admin/clients");
    } catch (error) {
      console.error("Error adding client:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      toast.error(error.message || "Failed to add client");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user || !isEmployee) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <AdminPageHeader
        title="Add New Client"
        description="Fill in the details to create a new client"
      />
      <form onSubmit={handleAddClient} className="max-w-lg mx-auto space-y-4">
        <div>
          <label htmlFor="company_name" className="block mb-1">
            Company Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="company_name"
            name="company_name"
            placeholder="ABC Corporation"
            value={newClient.company_name}
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
            placeholder="John Doe"
            value={newClient.contact_person}
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
            placeholder="+1 (555) 123-4567"
            value={newClient.contact_number}
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
            placeholder="contact@example.com"
            value={newClient.email}
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
            placeholder="https://example.com"
            value={newClient.website}
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
            placeholder="123 Business Ave, Suite 101, City, State ZIP"
            value={newClient.address}
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
            placeholder="Technology"
            value={newClient.industry}
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
            placeholder="example.com"
            value={newClient.domain}
            onChange={handleInputChange}
          />
        </div>
        <div className="flex items-center">
          <Switch
            id="active"
            name="active"
            checked={newClient.active}
            onCheckedChange={(checked) =>
              setNewClient({ ...newClient, active: checked })
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
            {isSubmitting ? "Adding..." : "Add Client"}
          </Button>
        </div>
      </form>
    </div>
  );
}
