'use client';

import { useEffect, useState } from 'react';
import supabase from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Download, Tags, Check, Times, Notes } from 'lucide-react';
import { toast } from 'react-hot-toast';        

export default function FormSubmissions({ params }) {
  const router = useRouter();
  const { formId } = params;
  const [submissions, setSubmissions] = useState([]);
  const [formTemplate, setFormTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [submissionTags, setSubmissionTags] = useState([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    fetchFormTemplate();
    fetchSubmissions();
  }, [formId]);

  async function fetchFormTemplate() {
    try {
      const { data, error } = await supabase
        .from('wehoware_form_templates')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;
      setFormTemplate(data);
    } catch (error) {
      console.error('Error fetching form template:', error.message);
      toast.error('Failed to load form template');
    }
  }

  async function fetchSubmissions() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('wehoware_form_submissions')
        .select('*')
        .eq('form_template_id', formId)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);
    } catch (error) {
      console.error('Error fetching submissions:', error.message);
      toast.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }

  function openSubmissionDetails(submission) {
    setSelectedSubmission(submission);
    setNoteText(submission.notes || '');
    setSubmissionTags(submission.tags || []);
    setShowModal(true);
  }

  async function updateSubmissionStatus(id, status) {
    try {
      const { error } = await supabase
        .from('wehoware_form_submissions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      // Update local state
      setSubmissions(submissions.map(sub => 
        sub.id === id ? { ...sub, status } : sub
      ));
      
      toast.success(`Status updated to ${status}`);
    } catch (error) {
      console.error('Error updating submission status:', error.message);
      toast.error('Failed to update status');
    }
  }

  async function saveSubmissionNotes() {
    if (!selectedSubmission) return;
    
    try {
      const { error } = await supabase
        .from('wehoware_form_submissions')
        .update({
          notes: noteText,
          tags: submissionTags
        })
        .eq('id', selectedSubmission.id);

      if (error) throw error;
      
      // Update local state
      setSubmissions(submissions.map(sub => 
        sub.id === selectedSubmission.id 
          ? { ...sub, notes: noteText, tags: submissionTags } 
          : sub
      ));
      
      setShowModal(false);
      toast.success('Submission updated');
    } catch (error) {
      console.error('Error saving submission notes:', error.message);
      toast.error('Failed to save notes');
    }
  }

  function addTag() {
    if (newTag && !submissionTags.includes(newTag)) {
      setSubmissionTags([...submissionTags, newTag]);
      setNewTag('');
    }
  }

  function removeTag(tag) {
    setSubmissionTags(submissionTags.filter(t => t !== tag));
  }

  function exportToCSV() {
    if (!submissions.length) return;
    
    // Get all possible keys from all submissions
    const allKeys = new Set();
    submissions.forEach(submission => {
      if (submission.submission_data) {
        Object.keys(submission.submission_data).forEach(key => allKeys.add(key));
      }
    });
    
    // Create header row
    const headers = ['Submission ID', 'Date', 'Status', ...Array.from(allKeys)];
    let csvContent = headers.join(',') + '\n';
    
    // Add data rows
    submissions.forEach(submission => {
      const row = [
        submission.id,
        new Date(submission.submitted_at).toLocaleString(),
        submission.status
      ];
      
      // Add data for each field
      Array.from(allKeys).forEach(key => {
        let value = submission.submission_data && submission.submission_data[key] 
          ? submission.submission_data[key] 
          : '';
          
        // Escape commas and quotes in values
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        row.push(value);
      });
      
      csvContent += row.join(',') + '\n';
    });
    
    // Create and download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `form-submissions-${formId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-6">
        <button
          onClick={() => router.push('/admin/forms')}
          className="mr-4 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="inline-block mr-1" /> Back to Forms
        </button>
        <h1 className="text-2xl font-bold flex-grow">
          {formTemplate ? `Submissions: ${formTemplate.title}` : 'Form Submissions'}
        </h1>
        <button
          onClick={exportToCSV} 
          disabled={!submissions.length}
          className={`flex items-center px-4 py-2 rounded-md ${
            submissions.length 
              ? 'bg-green-500 hover:bg-green-600 text-white' 
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Download className="mr-2" /> Export CSV
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <div className="spinner"></div>
          <p className="mt-2">Loading submissions...</p>
        </div>
      ) : submissions.length > 0 ? (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {submissions.map((submission) => (
                <tr key={submission.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(submission.submitted_at).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-h-20 overflow-y-auto">
                      {submission.submission_data && Object.entries(submission.submission_data).map(([key, value]) => (
                        <div key={key} className="mb-1">
                          <span className="font-medium">{key}:</span> {value}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => openSubmissionDetails(submission)}
                      className="mt-2 text-blue-500 hover:text-blue-700 text-sm"
                    >
                      View All Details
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      submission.status === 'New' ? 'bg-blue-100 text-blue-800' :
                      submission.status === 'Viewed' ? 'bg-purple-100 text-purple-800' :
                      submission.status === 'Contacted' ? 'bg-yellow-100 text-yellow-800' :
                      submission.status === 'Converted' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {submission.status}
                    </span>
                    {submission.tags && submission.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {submission.tags.map((tag, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => updateSubmissionStatus(submission.id, 'Viewed')}
                        className="text-purple-500 hover:text-purple-700"
                        title="Mark as Viewed"
                      >
                        <Check className="inline" />
                      </button>
                      <button
                        onClick={() => updateSubmissionStatus(submission.id, 'Contacted')}
                        className="text-yellow-500 hover:text-yellow-700"
                        title="Mark as Contacted"
                      >
                        <Check className="inline" />
                      </button>
                      <button
                        onClick={() => updateSubmissionStatus(submission.id, 'Converted')}
                        className="text-green-500 hover:text-green-700"
                        title="Mark as Converted"
                      >
                        <Check className="inline" />
                      </button>
                      <button
                        onClick={() => updateSubmissionStatus(submission.id, 'Archived')}
                        className="text-red-500 hover:text-red-700"
                        title="Archive"
                      >
                        <Times className="inline" />
                      </button>
                      <button
                        onClick={() => openSubmissionDetails(submission)}
                        className="text-blue-500 hover:text-blue-700"
                        title="Add Notes"
                      >
                        <Notes className="inline" />
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
          <p className="text-gray-500">No submissions found for this form</p>
        </div>
      )}

      {/* Submission Details Modal */}
      {showModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Submission Details</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  &times;
                </button>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Submitted on</h3>
                <p className="text-gray-900">
                  {new Date(selectedSubmission.submitted_at).toLocaleString()}
                </p>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Submission Data</h3>
                <div className="bg-gray-50 p-4 rounded-md">
                  {selectedSubmission.submission_data && Object.entries(selectedSubmission.submission_data).map(([key, value]) => (
                    <div key={key} className="mb-2">
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2 mb-2">
                  {submissionTags.map((tag, idx) => (
                    <div key={idx} className="bg-gray-100 px-3 py-1 rounded-full flex items-center">
                      <span className="text-sm">{tag}</span>
                      <button
                        onClick={() => removeTag(tag)}
                        className="ml-2 text-red-500"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-grow px-3 py-2 border border-gray-300 rounded-l-md"
                    placeholder="Add a tag"
                  />
                  <button
                    onClick={addTag}
                    className="bg-blue-500 text-white px-4 py-2 rounded-r-md"
                  >
                    <Tags className="inline mr-1" /> Add    
                  </button>
                </div>
              </div>
              
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-500 mb-2">Notes</h3>
                <textarea
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  rows="4"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Add notes about this submission..."
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-4">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={saveSubmissionNotes}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-md"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
