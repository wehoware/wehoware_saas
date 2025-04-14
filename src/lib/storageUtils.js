import supabase from './supabase';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'wehoware-thumbnails';

/**
 * Extracts the file path from a Supabase storage public URL.
 * @param {string} url - The public URL.
 * @returns {string|null} The file path or null if not a valid Supabase URL.
 */
export function getPathFromSupabaseUrl(url) {
    if (!url || typeof url !== 'string') return null;
    try {
        const urlObject = new URL(url);
        const supabaseStorageBase = `/storage/v1/object/public/${BUCKET_NAME}/`;
        if (urlObject.pathname.startsWith(supabaseStorageBase)) {
            return urlObject.pathname.substring(supabaseStorageBase.length);
        }
    } catch (e) {
        // Invalid URL
        return null;
    }
    return null;
}

/**
 * Uploads a file to the Supabase storage bucket.
 * @param {File} file - The file to upload.
 * @param {string} entityType - 'services' or 'blogs' to organize files.
 * @returns {Promise<string>} The public URL of the uploaded file.
 */
export async function uploadThumbnail(file, entityType = 'general') {
    if (!file) throw new Error('No file provided for upload.');

    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;
    const filePath = `${entityType}/${fileName}`; // Organize by type

    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(filePath, file, {
            cacheControl: '3600', // Optional: Cache for 1 hour
            upsert: false, // Don't overwrite existing files with the same name
        });

    if (error) {
        console.error('Error uploading file:', error);
        throw new Error(`Failed to upload thumbnail: ${error.message}`);
    }

    // Get the public URL
    const { data: publicUrlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(filePath);

    if (!publicUrlData || !publicUrlData.publicUrl) {
         console.error('Error getting public URL for path:', filePath);
        throw new Error('File uploaded, but failed to get public URL.');
    }

    return publicUrlData.publicUrl;
}

/**
 * Deletes a file from the Supabase storage bucket using its path.
 * @param {string} path - The path of the file within the bucket.
 * @returns {Promise<void>}
 */
export async function deleteThumbnailByPath(path) {
    if (!path) return; // Nothing to delete

    console.log(`Attempting to delete thumbnail from path: ${path}`);
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .remove([path]);

    if (error) {
        // Log error but don't necessarily throw, as the record might still be updated
        console.error(`Failed to delete old thumbnail (${path}):`, error);
        // Optionally: toast.error(`Could not delete old thumbnail: ${error.message}`);
    } else {
        console.log(`Successfully deleted old thumbnail: ${path}`, data);
    }
}

/**
 * Deletes a file from Supabase storage using its full public URL.
 * @param {string} url - The public URL of the file to delete.
 * @returns {Promise<void>}
 */
export async function deleteThumbnailByUrl(url) {
    const path = getPathFromSupabaseUrl(url);
    if (path) {
        await deleteThumbnailByPath(path);
    } else {
        console.log("Skipping deletion, URL is not a Supabase storage URL:", url);
    }
}
