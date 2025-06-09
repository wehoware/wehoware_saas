"use client";

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { PlusCircle, Trash2, Save, Loader2 } from 'lucide-react';
import AlertComponent from '@/components/ui/alert-component';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export function KeywordManager() {
  const { activeClient } = useAuth(); // Add auth context
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordId, setRecordId] = useState(null); // Store the ID of the keyword record if it exists

  const fetchData = useCallback(async () => {
    if (!activeClient) {
      setError('No active client selected');
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    setSuccessMessage('');
    try {
      console.log('Fetching keywords with active client:', activeClient.id);
      const response = await fetch('/api/v1/seo/keywords', {
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': activeClient.id // Pass client ID in header
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      const result = await response.json();
      setSections(result.data?.sections || []);
      setRecordId(result.data?.id || null);
    } catch (err) {
      console.error("Failed to fetch keywords:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [activeClient]); // Depend on activeClient so this refreshes when client changes

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAddSection = () => {
    const newSection = {
      id: Date.now().toString(), // Temporary unique ID for UI
      title: `New Section ${sections.length + 1}`,
      keywords: []
    };
    setSections([...sections, newSection]);
  };

  const handleSectionTitleChange = (sectionId, newTitle) => {
    setSections(sections.map(sec => 
      sec.id === sectionId ? { ...sec, title: newTitle } : sec
    ));
  };

  const handleDeleteSection = (sectionId) => {
    setSections(sections.filter(sec => sec.id !== sectionId));
  };

  const handleAddKeyword = (sectionId) => {
    setSections(sections.map(sec => {
      if (sec.id === sectionId) {
        const newKeyword = {
          id: Date.now().toString(), // Temporary unique ID
          text: ''
        };
        return { ...sec, keywords: [...sec.keywords, newKeyword] };
      }
      return sec;
    }));
  };

  const handleKeywordTextChange = (sectionId, keywordId, newText) => {
    setSections(sections.map(sec => {
      if (sec.id === sectionId) {
        return {
          ...sec,
          keywords: sec.keywords.map(kw => 
            kw.id === keywordId ? { ...kw, text: newText } : kw
          )
        };
      }
      return sec;
    }));
  };

  const handleDeleteKeyword = (sectionId, keywordId) => {
    setSections(sections.map(sec => {
      if (sec.id === sectionId) {
        return { ...sec, keywords: sec.keywords.filter(kw => kw.id !== keywordId) };
      }
      return sec;
    }));
  };

  const handleSaveChanges = async () => {
    if (!activeClient) {
      setError('No active client selected');
      return;
    }
    
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    try {
      // Clean up temporary IDs if needed, though API might handle it
      const payload = { sections: sections.map(sec => ({ 
        ...sec, 
        keywords: sec.keywords.map(kw => ({ text: kw.text })) // Only send text
      })) };
      
      console.log('Saving keywords with active client:', activeClient.id);
      const response = await fetch('/api/v1/seo/keywords', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': activeClient.id // Pass client ID in header
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      // Update state with potentially new IDs from the backend if needed
      // For simplicity, we just refetch for now
      setSuccessMessage('Keywords saved successfully!');
      fetchData(); // Refetch to get latest state and IDs

    } catch (err) {
      console.error("Failed to save keywords:", err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Show a more detailed loading or error state for debugging
  if (loading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  // If we have no active client, show a clear message
  if (!activeClient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Manage SEO Keywords</CardTitle>
        </CardHeader>
        <CardContent>
          <AlertComponent 
            type="error" 
            message="No active client selected. Please select a client to manage SEO keywords." 
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage SEO Keywords</CardTitle>
        <p className="text-sm text-muted-foreground">
          Organize keywords into sections for tracking and analysis.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <AlertComponent type="error" message={error} onClose={() => setError(null)} />}
        {successMessage && <AlertComponent type="success" message={successMessage} onClose={() => setSuccessMessage('')} />}

        <Button onClick={handleAddSection} size="sm">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Section
        </Button>

        {sections.length === 0 && !loading && (
          <p className="text-muted-foreground italic text-center py-4">No keyword sections created yet.</p>
        )}

        <div className="space-y-4">
          {sections.map((section) => (
            <Card key={section.id} className="bg-muted/30">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Input 
                  value={section.title}
                  onChange={(e) => handleSectionTitleChange(section.id, e.target.value)}
                  className="text-lg font-semibold border-0 shadow-none focus-visible:ring-0 p-0 h-auto mr-4"
                  placeholder="Section Title"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                     <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                       <Trash2 className="h-4 w-4" />
                     </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Section?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the section "{section.title}" and all its keywords? This cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDeleteSection(section.id)} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
                        Delete Section
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent className="pt-2 space-y-2">
                 {section.keywords.map((keyword) => (
                   <div key={keyword.id} className="flex items-center space-x-2">
                     <Input 
                       value={keyword.text}
                       onChange={(e) => handleKeywordTextChange(section.id, keyword.id, e.target.value)}
                       placeholder="Enter keyword"
                       className="flex-grow"
                     />
                     <Button variant="ghost" size="icon" onClick={() => handleDeleteKeyword(section.id, keyword.id)} className="text-muted-foreground hover:text-destructive">
                       <Trash2 className="h-4 w-4" />
                     </Button>
                   </div>
                 ))}
                 <Button variant="outline" size="sm" onClick={() => handleAddKeyword(section.id)}>
                   <PlusCircle className="mr-2 h-4 w-4" /> Add Keyword
                 </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
      <CardFooter className="border-t pt-4">
         <Button onClick={handleSaveChanges} disabled={saving || loading}>
           {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} 
           Save Keywords
         </Button>
      </CardFooter>
    </Card>
  );
}