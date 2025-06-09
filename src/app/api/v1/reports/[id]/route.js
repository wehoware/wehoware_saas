import { NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { withAuth } from '../../utils/auth-middleware';

// Helper function to fetch report and authorize user
async function getReportAndAuthorize(supabase, request, reportId) {
    const { data: report, error: fetchError } = await supabase
        .from('wehoware_reports')
        .select('*, client_id') // Ensure client_id is selected
        .eq('id', reportId)
        .single();

    if (fetchError || !report) {
        if (fetchError?.code === 'PGRST116') {
            return { report: null, authorized: false, error: 'Report not found.', status: 404 };
        }
        console.error('Error fetching report:', fetchError);
        return { report: null, authorized: false, error: 'Failed to fetch report.', status: 500 };
    }

    // Authorization logic
    let authorized = false;
    if (request.user.role === 'client' && String(report.client_id) === String(request.user.clientId)) {
        authorized = true;
    } else if (['employee', 'admin'].includes(request.user.role)) {
        if (request.user.activeClientId && String(report.client_id) === String(request.user.activeClientId)) {
            authorized = true;
        }
    }

    if (!authorized) {
        return { report, authorized: false, error: 'Unauthorized to access this report.', status: 403 };
    }

    return { report, authorized: true, error: null, status: 200 };
}

// GET a specific report by ID
export const GET = withAuth(async (request, { params }) => {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const reportId = params.id;

        if (!reportId) {
            return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
        }

        const { report, authorized, error, status } = await getReportAndAuthorize(supabase, request, reportId);

        if (!authorized) {
            return NextResponse.json({ error: error || 'Unauthorized' }, { status });
        }

        // Optionally fetch related data if needed, e.g., created_by profile
        const { data: reportWithDetails, error: detailsError } = await supabase
            .from('wehoware_reports')
            .select('*, created_by:wehoware_profiles!created_by(id, first_name, last_name), updated_by:wehoware_profiles!updated_by(id, first_name, last_name)')
            .eq('id', reportId)
            .single();
        
        if (detailsError) {
             console.error('Error fetching report details:', detailsError);
             // Fallback to returning the basic report if details fail
             return NextResponse.json(report);
        }

        return NextResponse.json(reportWithDetails || report);

    } catch (error) {
        console.error('Unexpected error fetching report:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}, { allowedRoles: ['client', 'employee', 'admin'] });

// PUT update a specific report by ID
export const PUT = withAuth(async (request, { params }) => {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const reportId = params.id;
        const body = await request.json();
        const { title, content, type, report_date, status } = body;

        if (!reportId) {
            return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
        }

        // 1. Fetch and Authorize (only employees/admins can update)
        const { report, authorized, error: authError, status: authStatus } = await getReportAndAuthorize(supabase, request, reportId);

        if (!authorized) {
             // Check if the user is simply not allowed or if the report wasn't found
             return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authStatus });
        }
        
        // Further check: ensure only employee/admin is making the request
        if (!['employee', 'admin'].includes(request.user.role)) {
            return NextResponse.json({ error: 'Only employees or admins can update reports.' }, { status: 403 });
        }
        
        // Ensure they are updating within their active context (already checked by getReportAndAuthorize)

        // 2. Prepare update data
        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (content !== undefined) updateData.content = content; // Allow updating JSONB content
        if (type !== undefined) updateData.type = type;
        if (report_date !== undefined) updateData.report_date = report_date;
        if (status !== undefined) updateData.status = status;

        if (Object.keys(updateData).length === 0) {
             return NextResponse.json({ error: 'No valid fields provided for update.' }, { status: 400 });
        }

        updateData.updated_by = request.user.id;
        updateData.updated_at = new Date().toISOString();

        // 3. Perform update using user-scoped client (RLS applies)
        const { data: updatedReport, error: updateError } = await supabase
            .from('wehoware_reports')
            .update(updateData)
            .eq('id', reportId)
            // .eq('client_id', report.client_id) // RLS should handle this
            .select('*, created_by:wehoware_profiles!created_by(id, first_name, last_name), updated_by:wehoware_profiles!updated_by(id, first_name, last_name)')
            .single();

        if (updateError) {
            console.error('Error updating report:', updateError);
            return NextResponse.json({ error: `Failed to update report: ${updateError.message}` }, { status: 500 });
        }

        if (!updatedReport) {
            console.warn(`Update for report ${reportId} returned no data unexpectedly.`);
            return NextResponse.json({ error: 'Report update failed (check permissions/RLS).' }, { status: 500 });
        }

        return NextResponse.json(updatedReport);

    } catch (error) {
        console.error('Unexpected error updating report:', error);
         // Handle potential JSON parsing errors
        if (error instanceof SyntaxError) {
            return NextResponse.json({ error: 'Invalid JSON format in request body.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}, { allowedRoles: ['employee', 'admin'] });

// DELETE a specific report by ID
export const DELETE = withAuth(async (request, { params }) => {
    try {
        const supabase = createRouteHandlerClient({ cookies });
        const reportId = params.id;

        if (!reportId) {
            return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
        }

        // Middleware already ensures user is admin

        // 1. Fetch and Authorize (Admin must be in the report's client context)
        const { report, authorized, error: authError, status: authStatus } = await getReportAndAuthorize(supabase, request, reportId);
        
        if (!authorized) {
            // Check if the report wasn't found or if admin lacks context
            return NextResponse.json({ error: authError || 'Unauthorized' }, { status: authStatus });
        }
        
        // Ensure admin is making the request (redundant check due to middleware, but safe)
        if (request.user.role !== 'admin') {
            return NextResponse.json({ error: 'Only admins can delete reports.' }, { status: 403 });
        }

        // Ensure admin has active context matching the report (checked by getReportAndAuthorize)
        if (!request.user.activeClientId || String(request.user.activeClientId) !== String(report.client_id)) {
             return NextResponse.json({ error: 'Admin must have active context matching the report to delete it.' }, { status: 403 });
        }

        // 2. Perform delete using user-scoped client (RLS applies)
        const { error: deleteError, count } = await supabase
            .from('wehoware_reports')
            .delete({ count: 'exact' })
            .eq('id', reportId);
            // .eq('client_id', report.client_id); // RLS should handle this

        if (deleteError) {
            console.error('Error deleting report:', deleteError);
            return NextResponse.json({ error: `Failed to delete report: ${deleteError.message}` }, { status: 500 });
        }

        if (count === 0) {
            console.warn(`Delete operation for report ${reportId} affected 0 rows unexpectedly.`);
            // This could mean the record was deleted between fetch and delete, or RLS prevented it
            return NextResponse.json({ error: 'Report not found or delete failed (check permissions/RLS).' }, { status: 404 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Unexpected error deleting report:', error);
        return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
}, { allowedRoles: ['admin'] }); // Only Admins can delete
