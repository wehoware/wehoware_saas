'use client';

import { useEffect, useState } from 'react';
import supabase from "@/lib/supabase";
import Link from 'next/link';
import { File, Download, Plus, Tags, Check, Times, Notes } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ReportsPage() {
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReports();
    } else {
      fetchTemplates();
    }
  }, [activeTab]);

  async function fetchReports() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wehoware_reports')
        .select(`
          *,
          template:template_id(title, report_type)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error) {
      console.error('Error fetching reports:', error.message);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wehoware_report_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching report templates:', error.message);
      toast.error('Failed to load report templates');
    } finally {
      setLoading(false);
    }
  }

  async function deleteReport(id) {
    if (!confirm('Are you sure you want to delete this report?')) return;

    try {
      const { error } = await supabase
        .from('wehoware_reports')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Report deleted successfully');
      fetchReports();
    } catch (error) {
      console.error('Error deleting report:', error.message);
      toast.error('Failed to delete report');
    }
  }

  async function deleteTemplate(id) {
    if (!confirm('Are you sure you want to delete this template? Any reports using this template will be affected.')) return;

    try {
      const { error } = await supabase
        .from('wehoware_report_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error.message);
      toast.error('Failed to delete template');
    }
  }

  function downloadReport(report) {
    // In a real implementation, this would generate a PDF
    toast.success('Report download started');
    
    // For demo, create a JSON file
    const reportData = JSON.stringify(report.report_data || {}, null, 2);
    const blob = new Blob([reportData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${report.id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function generateShareLink(reportId) {
    try {
      // Generate a unique token for sharing
      const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      
      // Create a share record
      const { data, error } = await supabase
        .from('wehoware_report_shares')
        .insert([{
          report_id: reportId,
          access_token: token,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
        }])
        .select();

      if (error) throw error;
      
      if (data && data.length > 0) {
        // Create shareable URL
        const shareUrl = `${window.location.origin}/reports/share/${token}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            toast.success('Share link copied to clipboard');
          })
          .catch(() => {
            toast.success('Share link created: ' + shareUrl);
          });
      }
    } catch (error) {
      console.error('Error generating share link:', error.message);
      toast.error('Failed to create share link');
    }
  }

  const renderReports = () => {
    if (loading) {
      return (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading reports...</p>
        </div>
      );
    }

    if (reports.length === 0) {
      return (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <File className="mx-auto text-gray-400 text-4xl mb-4" />
          <p className="text-gray-500 mb-4">No reports found</p>
          <Link href="/admin/reports/generate" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
            Generate your first report
          </Link>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Report</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Range</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {reports.map((report) => (
              <tr key={report.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{report.title}</div>
                  <div className="text-sm text-gray-500">
                    {report.is_scheduled && (
                      <span className="flex items-center text-xs text-gray-500 mt-1">
                        <Clock className="mr-1" /> 
                        {report.schedule_frequency} report
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.template?.report_type || 'Custom'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {report.date_range_start && report.date_range_end 
                    ? `${new Date(report.date_range_start).toLocaleDateString()} - ${new Date(report.date_range_end).toLocaleDateString()}`
                    : 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    report.status === 'Published' ? 'bg-green-100 text-green-800' :
                    report.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex space-x-2">
                    <Link href={`/admin/reports/view/${report.id}`} className="text-blue-500 hover:text-blue-700">
                      <Eye className="inline" />
                    </Link>
                    <button
                      onClick={() => downloadReport(report)}
                      className="text-green-500 hover:text-green-700"
                    >
                      <Download className="inline" />
                    </button>
                    <button
                      onClick={() => generateShareLink(report.id)}
                      className="text-purple-500 hover:text-purple-700"
                    >
                      <Share className="inline" />
                    </button>
                    <Link href={`/admin/reports/edit/${report.id}`} className="text-indigo-500 hover:text-indigo-700">
                      <Edit className="inline" />
                    </Link>
                    <button
                      onClick={() => deleteReport(report.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash className="inline" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTemplates = () => {
    if (loading) {
      return (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading templates...</p>
        </div>
      );
    }

    if (templates.length === 0) {
      return (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No report templates found</p>
          <Link href="/admin/reports/templates/add" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
            Create your first template
          </Link>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {templates.map((template) => (
          <div key={template.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900">{template.title}</h3>
              <p className="mt-1 text-sm text-gray-500">{template.description}</p>
              <div className="mt-2">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  {template.report_type}
                </span>
                {template.is_system_template && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                    System
                  </span>
                )}
              </div>
            </div>
            <div className="bg-gray-50 px-6 py-4 mt-auto flex justify-between">
              <Link 
                href={`/admin/reports/generate?template=${template.id}`}
                className="text-blue-500 hover:text-blue-700 text-sm font-medium"
              >
                Generate Report
              </Link>
              <div className="flex space-x-3">
                <Link 
                  href={`/admin/reports/templates/edit/${template.id}`}
                  className="text-indigo-500 hover:text-indigo-700"
                >
                  <Edit />
                </Link>
                {!template.is_system_template && (
                  <button
                    onClick={() => deleteTemplate(template.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <Trash />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">White-Label Reports</h1>
        <div className="flex space-x-2">
          {activeTab === 'reports' ? (
            <Link href="#" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center">
              <Plus className="mr-2" />
              New Report
            </Link>
          ) : (
            <Link href="/admin/reports/templates/add" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center">
              <Plus className="mr-2" />
              New Template
            </Link>
          )}
        </div>
      </div>

      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab('reports')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'reports'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Reports
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`py-4 px-6 text-sm font-medium ${
                activeTab === 'templates'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Templates
            </button>
          </nav>
        </div>
      </div>

      {activeTab === 'reports' ? renderReports() : renderTemplates()}
    </div>
  );
}
