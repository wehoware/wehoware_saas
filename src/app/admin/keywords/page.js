"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AdminPageHeader from "@/components/AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Plus, Check, X, Edit } from "lucide-react";
import AlertComponent from "@/components/ui/alert-component";
import supabase from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";

export default function ClientKeywordsPage() {
  const router = useRouter();
  const { user, activeClient } = useAuth();

  // recordId is the ID from wehoware_client_keywords (if it exists)
  const [recordId, setRecordId] = useState(null);
  // 'sections' holds an array of objects, each with a section name and an array of keywords
  const [sections, setSections] = useState([]);

  // For adding a new section
  const [newSectionName, setNewSectionName] = useState("");
  const [showAddSectionForm, setShowAddSectionForm] = useState(false);

  // For adding new keywords to a section, mapping section index -> input value
  const [newKeyword, setNewKeyword] = useState({});

  // For editing section names
  const [editingSectionIndex, setEditingSectionIndex] = useState(null);
  const [editingSectionName, setEditingSectionName] = useState("");

  // UI state flags
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorDialogOpen, setErrorDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Fetch the stored sections when the active client changes.
  useEffect(() => {
    if (activeClient) {
      fetchSections();
    }
  }, [activeClient ]);

  // Retrieve sections from Supabase.
  const fetchSections = async () => {
    if (!activeClient?.id || !user?.id) {
      setErrorMessage("No active client selected or user missing.");
      setErrorDialogOpen(true);
      setSections([]);
      setRecordId(null);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("wehoware_client_keywords")
        .select("*")
        .eq("client_id", activeClient.id)
        .eq("employee_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRecordId(data.id);
        // Expect stored JSON to be: { sections: [...] }
        setSections(data.keywords?.sections || []);
      } else {
        setRecordId(null);
        setSections([]);
      }
    } catch (err) {
      console.error("Error fetching sections:", err);
      setErrorMessage(err.message || "Failed to fetch sections");
      setErrorDialogOpen(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Immediately update the database with the current sections.
  const handleSaveSections = async () => {
    if (!activeClient?.id || !user?.id) {
      setErrorMessage("No active client selected or user missing.");
      setErrorDialogOpen(true);
      return;
    }
    try {
      setIsSubmitting(true);
      if (recordId) {
        const { error } = await supabase
          .from("wehoware_client_keywords")
          .update({
            keywords: { sections },
            updated_at: new Date(),
          })
          .eq("id", recordId);
        if (error) throw error;
        setSuccessMessage("Sections updated successfully!");
      } else {
        const { data, error } = await supabase
          .from("wehoware_client_keywords")
          .insert({
            client_id: activeClient.id,
            employee_id: user.id,
            keywords: { sections },
          });
        if (error) throw error;
        if (data && data.length > 0) {
          setRecordId(data[0].id);
        }
        setSuccessMessage("Sections created successfully!");
      }
      setSuccessDialogOpen(true);
    } catch (err) {
      console.error("Error saving sections:", err);
      setErrorMessage(err.message || "Failed to save sections");
      setErrorDialogOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Add a new section.
  const handleAddSection = () => {
    if (!newSectionName.trim()) {
      setErrorMessage("Section name cannot be empty.");
      setErrorDialogOpen(true);
      return;
    }
    // Prevent duplicate section names.
    const exists = sections.some(
      (sec) => sec.name.toLowerCase() === newSectionName.trim().toLowerCase()
    );
    if (exists) {
      setErrorMessage("This section already exists.");
      setErrorDialogOpen(true);
      return;
    }
    const updatedSections = [
      ...sections,
      { name: newSectionName.trim(), keywords: [] },
    ];
    setSections(updatedSections);
    setNewSectionName("");
    setShowAddSectionForm(false);
    handleSaveSections();
  };

  // Remove an entire section with confirmation.
  const handleRemoveSection = (sectionIndex) => {
    const confirmed = window.confirm(
      "Are you sure? You want to delete this section."
    );
    if (!confirmed) return;
    const updatedSections = sections.filter((_, i) => i !== sectionIndex);
    setSections(updatedSections);
    handleSaveSections();
  };

  // Begin editing a section name.
  const handleEditSection = (sectionIndex) => {
    setEditingSectionIndex(sectionIndex);
    setEditingSectionName(sections[sectionIndex].name);
  };

  // Update section name after edit.
  const handleUpdateSectionName = (sectionIndex) => {
    if (!editingSectionName.trim()) {
      setErrorMessage("Section name cannot be empty.");
      setErrorDialogOpen(true);
      return;
    }
    const updatedSections = [...sections];
    updatedSections[sectionIndex].name = editingSectionName.trim();
    setSections(updatedSections);
    setEditingSectionIndex(null);
    setEditingSectionName("");
    handleSaveSections();
  };

  const handleCancelEditSection = () => {
    setEditingSectionIndex(null);
    setEditingSectionName("");
  };

  // Add keywords (split by commas) to a section.
  const handleAddKeywordToSection = (sectionIndex) => {
    const input = newKeyword[sectionIndex] || "";
    // Split input string by comma, trim and remove empty items.
    const keywordsToAdd = input
      .split(",")
      .map((kw) => kw.trim())
      .filter((kw) => kw.length > 0);
    if (keywordsToAdd.length === 0) {
      setErrorMessage("Please enter at least one valid keyword.");
      setErrorDialogOpen(true);
      return;
    }
    // Exclude keywords that already exist in this section (case insensitive).
    const currentKeywords = sections[sectionIndex].keywords || [];
    const newKeywords = keywordsToAdd.filter(
      (kw) =>
        !currentKeywords.some(
          (existing) => existing.toLowerCase() === kw.toLowerCase()
        )
    );
    if (newKeywords.length === 0) {
      setErrorMessage("All entered keywords already exist in this section.");
      setErrorDialogOpen(true);
      return;
    }
    const updatedSections = [...sections];
    updatedSections[sectionIndex].keywords = [
      ...currentKeywords,
      ...newKeywords,
    ];
    setSections(updatedSections);
    // Clear the input for that section.
    setNewKeyword((prev) => ({ ...prev, [sectionIndex]: "" }));
    // Immediately save changes.
    handleSaveSections();
  };

  // Remove an individual keyword from a section.
  const handleRemoveKeywordFromSection = (sectionIndex, keywordToRemove) => {
    const updatedSections = [...sections];
    updatedSections[sectionIndex].keywords = updatedSections[
      sectionIndex
    ].keywords.filter(
      (kw) => kw.toLowerCase() !== keywordToRemove.toLowerCase()
    );
    setSections(updatedSections);
    handleSaveSections();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex-1 space-y-6">
        <AdminPageHeader
          title="Client Keyword Sections"
          description="Manage your keyword sections (e.g., Long Tailed, Short Tailed)"
          actionLabel={showAddSectionForm ? "Cancel" : "Add Section"}
          actionIcon={showAddSectionForm ? <X size={16} /> : <Plus size={16} />}
          onAction={() => setShowAddSectionForm(!showAddSectionForm)}
        />

        {showAddSectionForm && (
          <div className="border border-gray-200 shadow-sm rounded-md p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAddSection();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <label
                  htmlFor="newSection"
                  className="block text-sm font-medium"
                >
                  New Section Name *
                </label>
                <Input
                  id="newSection"
                  name="newSection"
                  placeholder="e.g. Long Tailed Keywords"
                  value={newSectionName}
                  onChange={(e) => setNewSectionName(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddSectionForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Add Section</Button>
              </div>
            </form>
          </div>
        )}

        {sections.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No keyword sections found for{" "}
            {activeClient ? activeClient.name : ""}. Add a section to begin.
          </div>
        ) : (
          sections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className="border border-gray-200 shadow-sm rounded-md p-4 space-y-4"
            >
              {/* Section header with edit and delete buttons */}
              <div className="flex items-center justify-between">
                {editingSectionIndex === sectionIndex ? (
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      value={editingSectionName}
                      onChange={(e) => setEditingSectionName(e.target.value)}
                      className="w-full"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleUpdateSectionName(sectionIndex)}
                    >
                      <Check size={16} />
                    </Button>
                    <Button variant="outline" onClick={handleCancelEditSection}>
                      <X size={16} />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="font-semibold text-lg">
                      {section.name}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleEditSection(sectionIndex)}
                      >
                        <Edit size={16} />
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => handleRemoveSection(sectionIndex)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* List keywords in the section */}
              {section.keywords.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No keywords in this section. Add below.
                </div>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {section.keywords.map((kw, kwIndex) => (
                    <li
                      key={kwIndex}
                      className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-800"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        title="Remove keyword"
                        onClick={() =>
                          handleRemoveKeywordFromSection(sectionIndex, kw)
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* Input to add new keywords, comma-separated */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Enter keywords (comma separated)"
                  value={newKeyword[sectionIndex] || ""}
                  onChange={(e) =>
                    setNewKeyword((prev) => ({
                      ...prev,
                      [sectionIndex]: e.target.value,
                    }))
                  }
                />
                <Button
                  variant="outline"
                  onClick={() => handleAddKeywordToSection(sectionIndex)}
                >
                  <Plus size={16} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Alert components for error/success messages */}
      <AlertComponent
        open={errorDialogOpen}
        onOpenChange={setErrorDialogOpen}
        title="Error"
        message={errorMessage}
        actionLabel="OK"
      />
      <AlertComponent
        open={successDialogOpen}
        onOpenChange={setSuccessDialogOpen}
        title="Success"
        message={successMessage}
        actionLabel="OK"
      />
    </div>
  );
}