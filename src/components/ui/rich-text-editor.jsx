"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import Color from '@tiptap/extension-color';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import LinkExtension from '@tiptap/extension-link';
import TextStyle from '@tiptap/extension-text-style';

// Custom FontSize extension extending TextStyle
const FontSize = TextStyle.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return { style: `font-size: ${attributes.fontSize}` };
        },
      },
    };
  },
});

// Custom Table extension with alignment support
const TableAligned = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      align: {
        default: 'center',
        parseHTML: (element) => element.dataset.align || 'center',
        renderHTML: (attributes) => {
          if (!attributes.align) return {};
          return { 'data-align': attributes.align };
        },
      },
    };
  },
});

// Add styles for the editor
import "@/styles/rich-text-editor-styles.css";
import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import {
  Bold, 
  Italic, 
  Underline, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  AlignJustify,
  Heading1, 
  Heading2, 
  Heading3, 
  Quote, 
  ImageIcon, 
  Youtube as YoutubeIcon,
  Code, 
  Undo, 
  Redo,
  Link,
  Unlink,
  Palette,
  Type,
  Table as TableIcon,
  Plus,
  Minus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Combine,
  Split,
} from 'lucide-react';

import { Button } from './button.jsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './tooltip.jsx';
import { Separator } from './separator.jsx';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.jsx";
import { Input } from './input.jsx';
import { Label } from './label.jsx';

export default function RichTextEditor({ 
  value, 
  onChange, 
  placeholder = 'Write something...',
  className,
  editorClassName
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkTarget, setLinkTarget] = useState('_blank');
  const [linkRel, setLinkRel] = useState('noopener noreferrer');
  const [fontSizeOpen, setFontSizeOpen] = useState(false);
  const [fontSizeValue, setFontSizeValue] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageOpen, setImageOpen] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [youtubeOpen, setYoutubeOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const imageInputRef = useRef(null);
  
  // Initialize editor with extensions
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ allowBase64: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
        alignments: ['left', 'center', 'right', 'justify'],
      }),
      Color,
      FontSize,
      Youtube.configure({
        controls: true,
        nocookie: true,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TableAligned.configure({
        resizable: true,
        HTMLAttributes: {
          class: 'rich-text-table',
        },
      }),
      TableRow,
      TableHeader,
      TableCell.configure({
        HTMLAttributes: {
          class: 'rich-text-table-cell',
        },
      }),
      LinkExtension.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
    ],
    content: value,
    immediatelyRender: false,
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  // Update editor content when value prop changes
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [editor, value]);

  // Image handling
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (editor) {
          editor.chain().focus().setImage({ src: e.target.result }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Reset file input
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  // Insert image by URL
  const addImageByUrl = useCallback(() => {
    if (editor && imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImageOpen(false);
    }
  }, [editor, imageUrl]);

  // Insert YouTube video
  const addYoutubeVideo = useCallback(() => {
    if (editor && youtubeUrl) {
      editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run();
      setYoutubeUrl('');
      setYoutubeOpen(false);
    }
  }, [editor, youtubeUrl]);

  // Add or update link
  const addLink = useCallback(() => {
    if (editor && linkUrl) {
      // Check if the URL has http/https prefix
      const isExternal = linkUrl.startsWith('http');
      const url = isExternal ? linkUrl : `https://${linkUrl}`;
      const target = linkTarget || (isExternal ? '_blank' : '_self');
      const rel = target === '_blank' ? (linkRel || 'noopener noreferrer') : null;
      
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: url, target, rel })
        .run();
      
      setLinkUrl('');
      setLinkTarget('_blank');
      setLinkRel('noopener noreferrer');
      setLinkOpen(false);
    }
  }, [editor, linkUrl, linkTarget, linkRel]);

  // Remove link
  const removeLink = useCallback(() => {
    if (editor) {
      editor.chain().focus().unsetLink().run();
    }
  }, [editor]);

  // Set font size on selected text
  const setFontSize = useCallback((size) => {
    if (editor) {
      if (size) {
        editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
      } else {
        editor.chain().focus().setMark('textStyle', { fontSize: null }).run();
      }
      setFontSizeValue(size || '');
    }
  }, [editor]);

  // Insert table
  const insertTable = useCallback(() => {
    if (editor) {
      editor.chain().focus().insertTable({ rows: tableRows, cols: tableCols, withHeaderRow: true }).run();
      setTableOpen(false);
    }
  }, [editor, tableRows, tableCols]);

  // Check if editor is ready
  if (!editor) {
    return null;
  }

  return (
    <div className={cn("border rounded-md", className)}>
      <div className="flex flex-wrap items-center gap-1 p-1 border-b bg-muted/20">
        <TooltipProvider delayDuration={150}>
          {/* Text Style Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={editor.isActive('bold') ? 'bg-muted' : ''}
              >
                <Bold className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bold</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={editor.isActive('italic') ? 'bg-muted' : ''}
              >
                <Italic className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Italic</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={editor.isActive('strike') ? 'bg-muted' : ''}
              >
                <Underline className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Underline</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={editor.isActive('code') ? 'bg-muted' : ''}
              >
                <Code className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Code</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Heading Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={editor.isActive('heading', { level: 1 }) ? 'bg-muted' : ''}
              >
                <Heading1 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 1</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={editor.isActive('heading', { level: 2 }) ? 'bg-muted' : ''}
              >
                <Heading2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 2</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={editor.isActive('heading', { level: 3 }) ? 'bg-muted' : ''}
              >
                <Heading3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Heading 3</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* List Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={editor.isActive('bulletList') ? 'bg-muted' : ''}
              >
                <List className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Bullet List</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={editor.isActive('orderedList') ? 'bg-muted' : ''}
              >
                <ListOrdered className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ordered List</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Alignment Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                className={editor.isActive({ textAlign: 'left' }) ? 'bg-muted' : ''}
              >
                <AlignLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Left</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                className={editor.isActive({ textAlign: 'center' }) ? 'bg-muted' : ''}
              >
                <AlignCenter className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Center</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                className={editor.isActive({ textAlign: 'right' }) ? 'bg-muted' : ''}
              >
                <AlignRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Align Right</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                className={editor.isActive({ textAlign: 'justify' }) ? 'bg-muted' : ''}
              >
                <AlignJustify className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Justify</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Block Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={editor.isActive('blockquote') ? 'bg-muted' : ''}
              >
                <Quote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Blockquote</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Font Size Control */}
          <Popover open={fontSizeOpen} onOpenChange={(open) => {
            setFontSizeOpen(open);
            if (open) {
              const attrs = editor.getAttributes('textStyle');
              setFontSizeValue(attrs.fontSize || '');
            }
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={editor.getAttributes('textStyle').fontSize ? 'bg-muted' : ''}
                  >
                    <Type className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Font Size</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-56">
              <div className="grid gap-3">
                <div className="font-medium text-sm">Font Size</div>
                <div className="grid grid-cols-4 gap-1.5">
                  {['12px', '14px', '16px', '18px'].map((size) => (
                    <Button
                      key={size}
                      type="button"
                      variant={fontSizeValue === size ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs"
                      style={{ fontSize: size }}
                      onClick={() => setFontSize(size)}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="font-size-custom">Custom Size</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="font-size-custom"
                      type="text"
                      placeholder="e.g. 22px"
                      value={fontSizeValue}
                      onChange={(e) => setFontSizeValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setFontSize(fontSizeValue);
                          setFontSizeOpen(false);
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => { setFontSize(fontSizeValue); setFontSizeOpen(false); }}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => { setFontSize(null); setFontSizeOpen(false); }}
                >
                  Reset Font Size
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Link Controls */}
          <Popover open={linkOpen} onOpenChange={(open) => {
            setLinkOpen(open);
            if (open && editor.isActive('link')) {
              const attrs = editor.getAttributes('link');
              setLinkUrl(attrs.href || '');
              setLinkTarget(attrs.target || '_blank');
              setLinkRel(attrs.rel || 'noopener noreferrer');
            } else if (open) {
              setLinkUrl('');
              setLinkTarget('_blank');
              setLinkRel('noopener noreferrer');
            }
          }}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={editor.isActive('link') ? 'bg-muted' : ''}
                  >
                    <Link className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Add Link</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="link">Link URL</Label>
                  <Input 
                    id="link" 
                    placeholder="https://example.com or /internal-page" 
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addLink();
                      }
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Enter full URL for external links or path (e.g. /about) for internal links.</p>
                </div>
                <div className="space-y-2">
                  <Label>Link Target</Label>
                  <div className="flex items-center space-x-2">
                    <Button
                      type="button"
                      variant={linkTarget === '_blank' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setLinkTarget('_blank'); setLinkRel('noopener noreferrer'); }}
                    >
                      New Tab
                    </Button>
                    <Button
                      type="button"
                      variant={linkTarget === '_self' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setLinkTarget('_self'); setLinkRel(null); }}
                    >
                      Same Tab
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Use New Tab for external links, Same Tab for internal links.</p>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setLinkOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={addLink}>Add Link</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={removeLink}
                disabled={!editor.isActive('link')}
              >
                <Unlink className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Remove Link</TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Media Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => imageInputRef.current?.click()}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <ImageIcon className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Upload Image</TooltipContent>
          </Tooltip>

          <Popover open={imageOpen} onOpenChange={setImageOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon">
                    <ImageIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Insert Image by URL</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="image">Image URL</Label>
                  <Input 
                    id="image" 
                    placeholder="https://example.com/image.jpg" 
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setImageOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={addImageByUrl}>Insert</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Popover open={youtubeOpen} onOpenChange={setYoutubeOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon">
                    <YoutubeIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Insert YouTube Video</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-80">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube URL</Label>
                  <Input 
                    id="youtube" 
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ" 
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setYoutubeOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={addYoutubeVideo}>Insert</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* Table Controls */}
          <Popover open={tableOpen} onOpenChange={setTableOpen}>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={editor.isActive('table') ? 'bg-muted' : ''}
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Insert Table</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-72">
              <div className="grid gap-3">
                <div className="font-medium text-sm">Insert Table</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="table-rows">Rows</Label>
                    <Input
                      id="table-rows"
                      type="number"
                      min={1}
                      max={20}
                      value={tableRows}
                      onChange={(e) => setTableRows(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="table-cols">Columns</Label>
                    <Input
                      id="table-cols"
                      type="number"
                      min={1}
                      max={10}
                      value={tableCols}
                      onChange={(e) => setTableCols(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setTableOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="button" onClick={insertTable}>Insert Table</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {editor.isActive('table') && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Row Before</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Row After</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().addColumnBefore().run()}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Column Before</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().addColumnAfter().run()}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Column After</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().mergeCells().run()}
                    disabled={!editor.can().mergeCells()}
                  >
                    <Combine className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Merge Cells</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().splitCell().run()}
                    disabled={!editor.can().splitCell()}
                  >
                    <Split className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Split Cell</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                  >
                    <Heading3 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Header Row</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().deleteTable().run()}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete Table</TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="mx-1 h-6" />

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'left' }).run()}
                    className={editor.getAttributes('table').align === 'left' ? 'bg-muted' : ''}
                  >
                    <AlignLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Table Align Left</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'center' }).run()}
                    className={editor.getAttributes('table').align === 'center' ? 'bg-muted' : ''}
                  >
                    <AlignCenter className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Table Align Center</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => editor.chain().focus().updateAttributes('table', { align: 'right' }).run()}
                    className={editor.getAttributes('table').align === 'right' ? 'bg-muted' : ''}
                  >
                    <AlignRight className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Table Align Right</TooltipContent>
              </Tooltip>
            </>
          )}

          <Separator orientation="vertical" className="mx-1 h-6" />

          {/* History Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              >
                <Undo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              >
                <Redo className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <EditorContent 
        editor={editor} 
        className={cn(
          "rich-text-editor-content prose prose-sm sm:prose-base lg:prose-lg max-w-none p-4 focus:outline-none h-[400px] overflow-y-auto bg-white border rounded-md",
          editorClassName,
          isFocused ? 'ring-2 ring-ring ring-offset-2 border-primary' : ''
        )} 
      />
    </div>
  )
}
