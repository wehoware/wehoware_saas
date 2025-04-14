"use client";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from "lucide-react";

export default function StaticPagesTable({ 
    pages = [], 
    onEdit, 
    onDelete 
}) {

    if (!pages || pages.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-8 border rounded-lg">
                No static pages found. Add one using the button above!
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Page Slug</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead className="hidden md:table-cell">Meta Desc.</TableHead>
                        <TableHead>Sitemap Freq.</TableHead>
                        <TableHead>Sitemap Prio.</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {pages.map((page) => (
                        <TableRow key={page.id}>
                            <TableCell className="font-mono text-sm">{page.page_slug}</TableCell>
                            <TableCell className="font-medium">{page.title}</TableCell>
                            <TableCell className="text-sm text-muted-foreground truncate max-w-xs hidden md:table-cell">
                                {page.meta_description || '-'}
                            </TableCell>
                            <TableCell className="text-sm">{page.sitemap_changefreq}</TableCell>
                            <TableCell className="text-sm">{page.sitemap_priority?.toFixed(1)}</TableCell>
                            <TableCell className="text-right">
                                <div className="flex space-x-1 justify-end">
                                    <Button variant="ghost" size="icon" title="Edit" onClick={() => onEdit(page)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        title="Delete" 
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => onDelete(page)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
