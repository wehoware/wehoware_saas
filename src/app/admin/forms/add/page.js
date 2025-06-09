"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import supabase from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { Plus, ArrowUp, ArrowDown, Trash } from "lucide-react";
import SelectInput from "@/components/ui/select";

export default function AddFormTemplate() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formTemplate, setFormTemplate] = useState({
    title: "",
    description: "",
    status: "Draft",
    success_message: "Thank you for your submission!",
    redirect_url: "",
    notification_emails: [],
  });
  const [formFields, setFormFields] = useState([]);
  const [newEmail, setNewEmail] = useState("");

  const fieldTypes = [
    { value: "text", label: "Text Input" },
    { value: "textarea", label: "Text Area" },
    { value: "email", label: "Email" },
    { value: "phone", label: "Phone" },
    { value: "number", label: "Number" },
    { value: "date", label: "Date" },
    { value: "time", label: "Time" },
    { value: "checkbox", label: "Checkbox" },
    { value: "radio", label: "Radio Buttons" },
    { value: "select", label: "Dropdown" },
    { value: "file", label: "File Upload" },
    { value: "hidden", label: "Hidden Field" },
  ];

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormTemplate({ ...formTemplate, [name]: value });
  };

  const addFormField = () => {
    const newField = {
      field_type: "text",
      label: "New Field",
      placeholder: "",
      help_text: "",
      required: false,
      field_order: formFields.length,
      options: [],
      validation_rules: {},
      css_class: "",
    };
    setFormFields([...formFields, newField]);
  };

  const handleFieldChange = (index, field, value) => {
    const updatedFields = [...formFields];
    updatedFields[index][field] = value;
    setFormFields(updatedFields);
  };

  const moveFieldUp = (index) => {
    if (index === 0) return;
    const updatedFields = [...formFields];
    [updatedFields[index - 1], updatedFields[index]] = [
      updatedFields[index],
      updatedFields[index - 1],
    ];
    // Update field order
    updatedFields.forEach((field, i) => {
      field.field_order = i;
    });
    setFormFields(updatedFields);
  };

  const moveFieldDown = (index) => {
    if (index === formFields.length - 1) return;
    const updatedFields = [...formFields];
    [updatedFields[index], updatedFields[index + 1]] = [
      updatedFields[index + 1],
      updatedFields[index],
    ];
    // Update field order
    updatedFields.forEach((field, i) => {
      field.field_order = i;
    });
    setFormFields(updatedFields);
  };

  const removeField = (index) => {
    const updatedFields = [...formFields];
    updatedFields.splice(index, 1);
    // Recalculate field order
    updatedFields.forEach((field, i) => {
      field.field_order = i;
    });
    setFormFields(updatedFields);
  };

  const addOption = (fieldIndex) => {
    const updatedFields = [...formFields];
    if (!Array.isArray(updatedFields[fieldIndex].options)) {
      updatedFields[fieldIndex].options = [];
    }
    updatedFields[fieldIndex].options.push({
      label: "New Option",
      value: `option_${Date.now()}`,
    });
    setFormFields(updatedFields);
  };

  const updateOption = (fieldIndex, optionIndex, key, value) => {
    const updatedFields = [...formFields];
    updatedFields[fieldIndex].options[optionIndex][key] = value;
    setFormFields(updatedFields);
  };

  const removeOption = (fieldIndex, optionIndex) => {
    const updatedFields = [...formFields];
    updatedFields[fieldIndex].options.splice(optionIndex, 1);
    setFormFields(updatedFields);
  };

  const addNotificationEmail = () => {
    if (newEmail && !formTemplate.notification_emails.includes(newEmail)) {
      setFormTemplate({
        ...formTemplate,
        notification_emails: [...formTemplate.notification_emails, newEmail],
      });
      setNewEmail("");
    }
  };

  const removeNotificationEmail = (email) => {
    setFormTemplate({
      ...formTemplate,
      notification_emails: formTemplate.notification_emails.filter(
        (e) => e !== email
      ),
    });
  };

  const saveFormTemplate = async (e) => {
    e.preventDefault();

    if (!formTemplate.title) {
      toast.error("Form title is required");
      return;
    }

    if (formFields.length === 0) {
      toast.error("You need to add at least one form field");
      return;
    }

    try {
      setLoading(true);

      // Save form template
      const { data: templateData, error: templateError } = await supabase
        .from("wehoware_form_templates")
        .insert([
          {
            ...formTemplate,
            notification_emails: formTemplate.notification_emails,
          },
        ])
        .select();

      if (templateError) throw templateError;

      if (templateData && templateData.length > 0) {
        const templateId = templateData[0].id;

        // Save form fields
        const fieldsToInsert = formFields.map((field) => ({
          ...field,
          form_template_id: templateId,
          options: JSON.stringify(field.options),
          validation_rules: JSON.stringify(field.validation_rules),
        }));

        const { error: fieldsError } = await supabase
          .from("wehoware_form_fields")
          .insert(fieldsToInsert);

        if (fieldsError) throw fieldsError;

        toast.success("Form template created successfully!");
        router.push("/admin/forms");
      }
    } catch (error) {
      console.error("Error saving form template:", error);
      toast.error("Failed to save form template");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Create New Form Template</h1>

      <form onSubmit={saveFormTemplate} className="space-y-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Form Details</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium bg-white text-gray-700 mb-1">
                Form Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="title"
                value={formTemplate.title}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>

              <SelectInput
                name="status"
                value={formTemplate.status}
                onChange={handleFormChange}
                options={[
                  { value: "Draft", label: "Draft" },
                  { value: "Published", label: "Published" },
                  { value: "Archived", label: "Archived" },
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                name="description"
                value={formTemplate.description}
                onChange={handleFormChange}
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              ></textarea>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Success Message
              </label>
              <input
                type="text"
                name="success_message"
                value={formTemplate.success_message}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Redirect URL (Optional)
              </label>
              <input
                type="url"
                name="redirect_url"
                value={formTemplate.redirect_url}
                onChange={handleFormChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                placeholder="https://"
              />
            </div>
          </div>

          <div className="mt-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notification Emails
            </label>
            <div className="flex">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md"
                placeholder="Enter email address"
              />
              <button
                type="button"
                onClick={addNotificationEmail}
                className="bg-blue-500 text-white px-4 py-2 rounded-r-md"
              >
                Add
              </button>
            </div>

            {formTemplate.notification_emails.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {formTemplate.notification_emails.map((email, index) => (
                  <div
                    key={index}
                    className="bg-gray-100 px-3 py-1 rounded-full flex items-center"
                  >
                    <span className="text-sm">{email}</span>
                    <button
                      type="button"
                      onClick={() => removeNotificationEmail(email)}
                      className="ml-2 text-red-500"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Form Fields</h2>
            <button
              type="button"
              onClick={addFormField}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md flex items-center"
            >
              <Plus className="mr-2" /> Add Field
            </button>
          </div>

          {formFields.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
              <p className="text-gray-500 mb-4">No form fields added yet</p>
              <button
                type="button"
                onClick={addFormField}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
              >
                Add your first field
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {formFields.map((field, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-medium">Field #{index + 1}</h3>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => moveFieldUp(index)}
                        disabled={index === 0}
                        className={`p-1 rounded ${
                          index === 0
                            ? "text-gray-400"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveFieldDown(index)}
                        disabled={index === formFields.length - 1}
                        className={`p-1 rounded ${
                          index === formFields.length - 1
                            ? "text-gray-400"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        <ArrowDown />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeField(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Field Type <span className="text-red-500">*</span>
                      </label>
                      <SelectInput
                        name="field_type"
                        value={field.field_type}
                        onChange={(e) =>
                          handleFieldChange(index, "field_type", e.target.value)
                        }
                        options={fieldTypes}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Label <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={field.label}
                        onChange={(e) =>
                          handleFieldChange(index, "label", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Placeholder
                      </label>
                      <input
                        type="text"
                        value={field.placeholder || ""}
                        onChange={(e) =>
                          handleFieldChange(
                            index,
                            "placeholder",
                            e.target.value
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Help Text
                      </label>
                      <input
                        type="text"
                        value={field.help_text || ""}
                        onChange={(e) =>
                          handleFieldChange(index, "help_text", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id={`required-${index}`}
                        checked={field.required}
                        onChange={(e) =>
                          handleFieldChange(index, "required", e.target.checked)
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                      <label
                        htmlFor={`required-${index}`}
                        className="ml-2 block text-sm text-gray-700"
                      >
                        Required field
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CSS Class
                      </label>
                      <input
                        type="text"
                        value={field.css_class || ""}
                        onChange={(e) =>
                          handleFieldChange(index, "css_class", e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                  </div>

                  {/* Options for radio, checkbox, select */}
                  {["radio", "checkbox", "select"].includes(
                    field.field_type
                  ) && (
                    <div className="mt-4">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-sm font-medium text-gray-700">
                          Options
                        </h4>
                        <button
                          type="button"
                          onClick={() => addOption(index)}
                          className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                        >
                          Add Option
                        </button>
                      </div>

                      {field.options && field.options.length > 0 ? (
                        <div className="space-y-2">
                          {field.options.map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className="flex items-center space-x-2"
                            >
                              <input
                                type="text"
                                value={option.label}
                                onChange={(e) =>
                                  updateOption(
                                    index,
                                    optIndex,
                                    "label",
                                    e.target.value
                                  )
                                }
                                className="flex-grow px-2 py-1 border border-gray-300 rounded-md text-sm"
                                placeholder="Option label"
                              />
                              <input
                                type="text"
                                value={option.value}
                                onChange={(e) =>
                                  updateOption(
                                    index,
                                    optIndex,
                                    "value",
                                    e.target.value
                                  )
                                }
                                className="w-1/3 px-2 py-1 border border-gray-300 rounded-md text-sm"
                                placeholder="Value"
                              />
                              <button
                                type="button"
                                onClick={() => removeOption(index, optIndex)}
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash className="inline" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          No options added yet
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.push("/admin/forms")}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md flex items-center"
          >
            {loading ? "Saving..." : "Save Form Template"}
          </button>
        </div>
      </form>
    </div>
  );
}
