'use client';

import { useEffect, useState } from 'react';
import supabase from "@/lib/supabase";
import Link from 'next/link';
import { Plus, Edit, Trash, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function FormTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFormTemplates();
  }, []);

  async function fetchFormTemplates() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wehoware_form_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error fetching form templates:', error.message);
      toast.error('Failed to load form templates');
    } finally {
      setLoading(false);
    }
  }

  async function deleteFormTemplate(id) {
    if (!confirm('Are you sure you want to delete this form template?')) return;

    try {
      const { error } = await supabase
        .from('wehoware_form_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Form template deleted successfully');
      fetchFormTemplates();
    } catch (error) {
      console.error('Error deleting form template:', error.message);
      toast.error('Failed to delete form template');
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Custom Form Templates</h1>
        <Link href="/admin/forms/add" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center">
          <Plus className="mr-2" />
          Create New Form
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading form templates...</p>
        </div>
      ) : templates.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Submissions</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {templates.map((template) => (
                <tr key={template.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{template.title}</div>
                    <div className="text-sm text-gray-500">{template.description}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      template.status === 'Published' ? 'bg-green-100 text-green-800' :
                      template.status === 'Draft' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {template.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(template.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <Link href={`/admin/forms/submissions/${template.id}`} className="text-blue-500 hover:text-blue-700">
                      View Submissions
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <Link href={`/admin/forms/preview/${template.id}`} className="text-blue-500 hover:text-blue-700">
                        <Eye className="inline" />
                      </Link>
                      <Link href={`/admin/forms/edit/${template.id}`} className="text-indigo-500 hover:text-indigo-700">
                        <Edit className="inline" />
                      </Link>
                      <button
                        onClick={() => deleteFormTemplate(template.id)}
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
      ) : (
        <div className="text-center py-10 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No form templates found</p>
          <Link href="/admin/forms/add" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md">
            Create your first form
          </Link>
        </div>
      )}
    </div>
  );
}
