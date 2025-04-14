"use client";

import { useState, useEffect, useCallback } from 'react';
import supabase from '@/lib/supabase';
import { useAuth } from "@/contexts/auth-context";
import AdminPageHeader from "@/components/AdminPageHeader";
import GeneralSettingsForm from "@/components/settings/GeneralSettingsForm";
import ThemeSettingsForm from "@/components/settings/ThemeSettingsForm";
import { Loader2 } from "lucide-react";
import { toast } from "react-hot-toast";

// Define all expected setting keys grouped by their form/section
const settingKeys = {
    general: ['app_name', 'support_email', 'timezone'],
    theme: [
        'theme_primary_color',
        'theme_secondary_color',
        'theme_accent_color',
        'logo_url_light',
        'logo_url_dark',
        'favicon_url'
    ],
    // Add other groups here, e.g., 'email', 'integrations'
};

// Combine all keys for fetching
const allSettingKeys = Object.values(settingKeys).flat();

export default function SettingsPage() {
    const { activeClient, isEmployee } = useAuth();
    const [settings, setSettings] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    // Use separate saving states for better UX if forms are saved independently
    const [isSavingGeneral, setIsSavingGeneral] = useState(false);
    const [isSavingTheme, setIsSavingTheme] = useState(false);

    // Fetch settings from Supabase
    const fetchSettings = useCallback(async () => {
        if (!activeClient?.id) return;
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('wehoware_settings')
                .select('setting_key, setting_value')
                .eq('client_id', activeClient.id)
                .in('setting_key', allSettingKeys);

            if (error) throw error;

            const fetchedSettings = {};
            allSettingKeys.forEach(key => {
                const found = data.find(item => item.setting_key === key);
                fetchedSettings[key] = found ? found.setting_value : ''; // Default to empty string if not found
            });
            setSettings(fetchedSettings);

        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error("Failed to load settings. " + error.message);
        } finally {
            setIsLoading(false);
        }
    }, [activeClient?.id]);

    // Fetch settings on initial load or when client changes
    useEffect(() => {
        if (activeClient?.id) {
            fetchSettings();
        } else if (isEmployee) {
            setIsLoading(false);
            setSettings({}); // Clear settings if no client selected
        }
    }, [activeClient, isEmployee, fetchSettings]);

    // Handle changes in any form input
    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    // Generic function to save a group of settings
    const handleSaveSettings = async (keysToSave, group) => {
        if (!activeClient?.id) {
            toast.error("Please select an active client first.");
            return;
        }

        const savingSetter = group === 'general' ? setIsSavingGeneral : setIsSavingTheme;
        savingSetter(true);

        try {
            const updates = keysToSave
                .filter(key => key in settings) // Only include keys present in the current state
                .map(key => ({
                    client_id: activeClient.id,
                    setting_key: key,
                    setting_value: String(settings[key] || ''), // Ensure value is string and handle null/undefined
                    setting_group: group, // Assign group based on the form saving
                    updated_at: new Date().toISOString(),
                }));

            if (updates.length === 0) {
                toast.info("No changes detected to save.");
                savingSetter(false);
                return;
            }

            const { error } = await supabase
                .from('wehoware_settings')
                .upsert(updates, { onConflict: 'client_id, setting_key' });

            if (error) throw error;

            toast.success(`${group.charAt(0).toUpperCase() + group.slice(1)} settings saved successfully!`);
            // Optionally re-fetch settings after save, or just rely on local state
            // fetchSettings(); 
        } catch (error) {
            console.error(`Error saving ${group} settings:`, error);
            toast.error(`Failed to save ${group} settings. ${error.message}`);
        } finally {
            savingSetter(false);
        }
    };

    // Render logic
    if (isEmployee && !activeClient) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <p className="text-muted-foreground">Please select a client from the header dropdown to manage application settings.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="flex flex-col space-y-6">
            <AdminPageHeader
                title="Application Settings"
                description="Configure various aspects of the application for the selected client."
            />

            {/* General Settings Form */}
            <GeneralSettingsForm 
                settings={settings} 
                onSettingChange={handleSettingChange}
                onSave={(keys) => handleSaveSettings(keys, 'general')} // Pass group name
                isSaving={isSavingGeneral}
            />

            {/* Theme Settings Form */}
            <ThemeSettingsForm 
                settings={settings}
                onSettingChange={handleSettingChange}
                onSave={(keys) => handleSaveSettings(keys, 'theme')} // Pass group name
                isSaving={isSavingTheme}
            />

            {/* Add other settings forms here using the same pattern */}
            {/* e.g., <EmailSettingsForm settings={...} ... /> */}
            {/* e.g., <IntegrationSettingsForm settings={...} ... /> */}

        </div>
    );
}
