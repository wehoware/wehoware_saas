"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabase";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "react-hot-toast";
import SelectInput from "@/components/ui/select";

export default function GenerateReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [report, setReport] = useState({
    title: "",
    description: "",
    template_id: templateId || "",
    date_range_start: new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split("T")[0], // 30 days ago
    date_range_end: new Date().toISOString().split("T")[0],
    status: "Draft",
    is_scheduled: false,
    schedule_frequency: "monthly",
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (templateId && templates.length > 0) {
      const template = templates.find((t) => t.id === templateId);
      if (template) {
        setSelectedTemplate(template);
        setReport((prev) => ({
          ...prev,
          title: `${template.title} - ${new Date().toLocaleDateString()}`,
          template_id: template.id,
        }));
      }
    }
  }, [templateId, templates]);

  async function fetchTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("wehoware_report_templates")
        .select("*")
        .order("title");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error.message);
      toast.error("Failed to load report templates");
    } finally {
      setLoading(false);
    }
  }

  const handleTemplateChange = (e) => {
    const id = e.target.value;
    const template = templates.find((t) => t.id === id);
    setSelectedTemplate(template);
    setReport({
      ...report,
      template_id: id,
      title: template
        ? `${template.title} - ${new Date().toLocaleDateString()}`
        : "",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setReport({ ...report, [name]: value });
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setReport({ ...report, [name]: checked });
  };

  const generateReport = async (e) => {
    e.preventDefault();

    if (!report.title || !report.template_id) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setGenerating(true);

      // In a real implementation, we would make API calls to gather the data
      // For this demo, we'll create some sample data based on the report type
      let reportData = {};

      if (selectedTemplate) {
        switch (selectedTemplate.report_type) {
          case "analytics":
            reportData = {
              page_views: Math.floor(Math.random() * 10000) + 1000,
              unique_visitors: Math.floor(Math.random() * 5000) + 500,
              avg_time_on_site: Math.floor(Math.random() * 300) + 60,
              bounce_rate: (Math.random() * 50 + 30).toFixed(2),
              top_pages: [
                { page: "/", views: Math.floor(Math.random() * 1000) + 100 },
                {
                  page: "/services",
                  views: Math.floor(Math.random() * 800) + 50,
                },
                { page: "/about", views: Math.floor(Math.random() * 500) + 25 },
                {
                  page: "/contact",
                  views: Math.floor(Math.random() * 300) + 10,
                },
                { page: "/blog", views: Math.floor(Math.random() * 200) + 5 },
              ],
              traffic_sources: {
                direct: Math.floor(Math.random() * 50) + 10,
                organic: Math.floor(Math.random() * 30) + 10,
                social: Math.floor(Math.random() * 20) + 5,
                referral: Math.floor(Math.random() * 15) + 5,
                email: Math.floor(Math.random() * 10) + 5,
              },
            };
            break;

          case "leads":
            reportData = {
              total_leads: Math.floor(Math.random() * 100) + 10,
              conversion_rate: (Math.random() * 10 + 1).toFixed(2),
              lead_sources: {
                contact_form: Math.floor(Math.random() * 30) + 5,
                newsletter: Math.floor(Math.random() * 20) + 3,
                ebook_download: Math.floor(Math.random() * 15) + 2,
                webinar: Math.floor(Math.random() * 10) + 1,
                other: Math.floor(Math.random() * 5) + 1,
              },
              lead_status: {
                new: Math.floor(Math.random() * 30) + 5,
                contacted: Math.floor(Math.random() * 25) + 3,
                qualified: Math.floor(Math.random() * 20) + 2,
                converted: Math.floor(Math.random() * 15) + 1,
                lost: Math.floor(Math.random() * 10) + 1,
              },
            };
            break;

          case "content":
            reportData = {
              total_content: Math.floor(Math.random() * 50) + 5,
              content_breakdown: {
                blogs: Math.floor(Math.random() * 30) + 5,
                services: Math.floor(Math.random() * 15) + 3,
                testimonials: Math.floor(Math.random() * 10) + 2,
                case_studies: Math.floor(Math.random() * 5) + 1,
              },
              popular_content: [
                {
                  title: "Sample Blog Post 1",
                  views: Math.floor(Math.random() * 500) + 100,
                },
                {
                  title: "Sample Service Page",
                  views: Math.floor(Math.random() * 400) + 80,
                },
                {
                  title: "Sample Blog Post 2",
                  views: Math.floor(Math.random() * 300) + 60,
                },
                {
                  title: "Sample Case Study",
                  views: Math.floor(Math.random() * 200) + 40,
                },
                {
                  title: "Sample Blog Post 3",
                  views: Math.floor(Math.random() * 100) + 20,
                },
              ],
            };
            break;

          default:
            reportData = {
              sample_data: "This is a demo report with sample data",
              date_generated: new Date().toISOString(),
            };
        }
      }

      // Save the report to the database
      const { data, error } = await supabase
        .from("wehoware_reports")
        .insert([
          {
            ...report,
            report_data: reportData,
            last_generated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;

      if (data && data.length > 0) {
        toast.success("Report generated successfully");
        router.push(`/admin/reports/view/${data[0].id}`);
      }
    } catch (error) {
      console.error("Error generating report:", error.message);
      toast.error("Failed to generate report");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.push("/admin/reports")}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="inline-block mr-1" /> Back to Reports
        </button>
        <h1 className="text-2xl font-bold">Generate New Report</h1>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading templates...</p>
        </div>
      ) : (
        <form
          onSubmit={generateReport}
          className="bg-white rounded-lg shadow overflow-hidden max-w-3xl mx-auto"
        >
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Report Template <span className="text-red-500">*</span>
              </label>

              <SelectInput
                name="template_id"
                value={report.template_id}
                onChange={handleTemplateChange}
                options={templates.map((template) => ({
                  value: template.id,
                  label: `${template.title} (${template.report_type})`,
                }))}
                required
              />
            </div>

            {selectedTemplate && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Report Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={report.title}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={report.description}
                    onChange={handleInputChange}
                    rows="3"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Optional description of this report..."
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Range Start <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="text-gray-400" />
                      </div>
                      <input
                        type="date"
                        name="date_range_start"
                        value={report.date_range_start}
                        onChange={handleInputChange}
                        className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Range End <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Calendar className="text-gray-400" />
                      </div>
                      <input
                        type="date"
                        name="date_range_end"
                        value={report.date_range_end}
                        onChange={handleInputChange}
                        className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <SelectInput
                    name="status"
                    value={report.status}
                    onChange={handleInputChange}
                    options={[
                      { value: "Draft", label: "Draft" },
                      { value: "Published", label: "Published" },
                    ]}
                    required
                  />
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-start">
                    <div className="flex items-center h-5">
                      <input
                        id="is_scheduled"
                        name="is_scheduled"
                        type="checkbox"
                        checked={report.is_scheduled}
                        onChange={handleCheckboxChange}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                      />
                    </div>
                    <div className="ml-3 text-sm">
                      <label
                        htmlFor="is_scheduled"
                        className="font-medium text-gray-700"
                      >
                        Schedule this report
                      </label>
                      <p className="text-gray-500">
                        Automatically generate updated versions of this report
                      </p>
                    </div>
                  </div>

                  {report.is_scheduled && (
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Frequency
                      </label>
                      <SelectInput
                        name="schedule_frequency"
                        value={report.schedule_frequency}
                        onChange={handleInputChange}
                        options={[
                          { value: "weekly", label: "Weekly" },
                          { value: "monthly", label: "Monthly" },
                          { value: "quarterly", label: "Quarterly" },
                        ]}
                        required
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
            <Link
              href="/admin/reports"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={generating || !selectedTemplate}
              className={`px-4 py-2 rounded-md text-white ${
                selectedTemplate
                  ? "bg-blue-500 hover:bg-blue-600"
                  : "bg-gray-300 cursor-not-allowed"
              }`}
            >
              {generating ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
