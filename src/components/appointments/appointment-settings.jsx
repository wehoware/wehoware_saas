"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import {
  Save,
  Clock,
  Globe,
  Calendar,
  Bell,
  ExternalLink,
  Video,
  Loader2,
  Upload,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SelectInput from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox.jsx";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/auth-context";

const DEFAULT_SETTINGS = {
  defaultAvailability: {
    monday: { enabled: true, start: "09:00", end: "17:00" },
    tuesday: { enabled: true, start: "09:00", end: "17:00" },
    wednesday: { enabled: true, start: "09:00", end: "17:00" },
    thursday: { enabled: true, start: "09:00", end: "17:00" },
    friday: { enabled: true, start: "09:00", end: "17:00" },
    saturday: { enabled: false, start: "10:00", end: "15:00" },
    sunday: { enabled: false, start: "10:00", end: "15:00" },
  },
  timeZone: "America/New_York",
  bufferTime: 15,
  minimumNotice: 24,
  futureLimit: 60,
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    sendReminders: true,
    reminderTiming: [24, 1],
  },
  integrations: {
    googleCalendar: false,
    outlookCalendar: false,
    zoom: false,
    googleMeet: true,
    teams: false,
  },
  bookingPage: {
    slug: "",
    brandColor: "#4f46e5",
    logo: "/path/to/logo.png",
    welcomeMessage: "",
    redirectUrl: "",
  },
};

export function AppointmentSettings() {
  const { activeClient } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [oauthDialogOpen, setOauthDialogOpen] = useState(false);
  const [oauthIntegration, setOauthIntegration] = useState(null);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [realIntegrations, setRealIntegrations] = useState({
    googleCalendar: null,
    outlookCalendar: null,
    zoom: null,
  });
  const [syncStatus, setSyncStatus] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          "/api/v1/settings/group/appointments?format=keyValue"
        );
        if (!res.ok) throw new Error("Failed to load settings");
        const json = await res.json();
        const raw = json.data?.appointment_settings;
        if (raw && !cancelled) {
          try {
            const parsed = JSON.parse(raw);
            setSettings((prev) => ({
              ...prev,
              ...parsed,
              defaultAvailability: {
                ...prev.defaultAvailability,
                ...parsed.defaultAvailability,
              },
              notifications: {
                ...prev.notifications,
                ...parsed.notifications,
              },
              integrations: {
                ...prev.integrations,
                ...parsed.integrations,
              },
              bookingPage: {
                ...prev.bookingPage,
                ...parsed.bookingPage,
              },
            }));
          } catch {
            // ignore parse errors, keep defaults
          }
        }
      } catch (err) {
        console.error("[AppointmentSettings] load error:", err);
      }

      // Load real integrations from DB
      try {
        const intRes = await fetch("/api/v1/integrations");
        if (intRes.ok) {
          const intJson = await intRes.json();
          const list = intJson.data || [];
          const google = list.find((i) => i.provider?.name === "Google Calendar" || i.name === "Google Calendar");
          const outlook = list.find((i) => i.provider?.name === "Outlook Calendar" || i.name === "Outlook Calendar");
          const zoom = list.find((i) => i.provider?.name === "Zoom" || i.name === "Zoom");
          if (!cancelled) {
            setRealIntegrations({
              googleCalendar: google || null,
              outlookCalendar: outlook || null,
              zoom: zoom || null,
            });
          }
        }
      } catch (err) {
        console.error("[AppointmentSettings] integrations load error:", err);
      }

      // Load sync status
      try {
        const statusRes = await fetch("/api/v1/integrations/sync-status");
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (!cancelled) {
            setSyncStatus(statusJson.data || []);
          }
        }
      } catch (err) {
        console.error("[AppointmentSettings] sync status load error:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeClient?.id]);

  const weekdays = [
    { id: "monday", label: "Monday" },
    { id: "tuesday", label: "Tuesday" },
    { id: "wednesday", label: "Wednesday" },
    { id: "thursday", label: "Thursday" },
    { id: "friday", label: "Friday" },
    { id: "saturday", label: "Saturday" },
    { id: "sunday", label: "Sunday" },
  ];

  const timeZones = [
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Chicago", label: "Central Time (CT)" },
    { value: "America/Denver", label: "Mountain Time (MT)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
    { value: "Europe/Paris", label: "Central European Time (CET)" },
    { value: "Asia/Tokyo", label: "Japan Standard Time (JST)" },
    { value: "Asia/Shanghai", label: "China Standard Time (CST)" },
  ];

  const handleAvailabilityChange = (day, field, value) => {
    setSettings((prev) => ({
      ...prev,
      defaultAvailability: {
        ...prev.defaultAvailability,
        [day]: {
          ...prev.defaultAvailability[day],
          [field]: value,
        },
      },
    }));
  };

  const handleReminderToggle = (timing) => {
    setSettings((prev) => {
      const currentTimings = [...prev.notifications.reminderTiming];
      const index = currentTimings.indexOf(timing);

      if (index === -1) {
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            reminderTiming: [...currentTimings, timing].sort((a, b) => b - a),
          },
        };
      } else {
        return {
          ...prev,
          notifications: {
            ...prev.notifications,
            reminderTiming: currentTimings.filter((t) => t !== timing),
          },
        };
      }
    });
  };

  const handleSaveSettings = async () => {
    try {
      const res = await fetch("/api/v1/settings/group/appointments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyValues: [
            {
              settingKey: "appointment_settings",
              settingValue: JSON.stringify(settings),
            },
          ],
        }),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      toast.success("Settings saved successfully");
    } catch (err) {
      toast.error(err.message || "Failed to save settings");
    }
  };

  const toggleVideoConfig = async (integrationName, configKey, value) => {
    let record = null;
    if (integrationName === "Google Meet") {
      record = realIntegrations.googleCalendar;
    } else if (integrationName === "Microsoft Teams") {
      record = realIntegrations.outlookCalendar;
    }
    if (!record?.id) {
      toast.error(`Please connect ${integrationName === "Google Meet" ? "Google Calendar" : "Outlook Calendar"} first`);
      return;
    }
    try {
      const res = await fetch(`/api/v1/integrations/${record.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: { ...record.config, [configKey]: value },
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success(`${integrationName} ${value ? "enabled" : "disabled"}`);
      // Refresh integrations
      const intRes = await fetch("/api/v1/integrations");
      if (intRes.ok) {
        const intJson = await intRes.json();
        const list = intJson.data || [];
        const google = list.find((i) => i.provider?.name === "Google Calendar" || i.name === "Google Calendar");
        const outlook = list.find((i) => i.provider?.name === "Outlook Calendar" || i.name === "Outlook Calendar");
        const zoom = list.find((i) => i.provider?.name === "Zoom" || i.name === "Zoom");
        setRealIntegrations({
          googleCalendar: google || null,
          outlookCalendar: outlook || null,
          zoom: zoom || null,
        });
      }
    } catch (err) {
      toast.error(err.message || `Failed to toggle ${integrationName}`);
    }
  };

  const handleOAuthConnect = (integrationKey, integrationName) => {
    if (integrationName === "Google Calendar") {
      globalThis.location.href = "/api/v1/integrations/google/calendar/auth";
      return;
    }
    if (integrationName === "Outlook Calendar") {
      globalThis.location.href = "/api/v1/integrations/microsoft/calendar/auth";
      return;
    }
    if (integrationName === "Zoom") {
      globalThis.location.href = "/api/v1/integrations/zoom/auth";
      return;
    }
    // Dialog only for Meet/Teams config toggles (no separate OAuth)
    setOauthIntegration(integrationName);
    setOauthDialogOpen(true);
  };

  const handleDisconnect = async (integrationName) => {
    const keyMap = {
      "Google Calendar": "googleCalendar",
      "Outlook Calendar": "outlookCalendar",
      "Zoom": "zoom",
    };
    const record = realIntegrations[keyMap[integrationName]];
    if (!record?.id) {
      toast.error("No active integration found");
      return;
    }
    try {
      const res = await fetch(`/api/v1/integrations/${record.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success(`${integrationName} disconnected`);
      setRealIntegrations((prev) => ({
        ...prev,
        [keyMap[integrationName]]: null,
      }));
    } catch (err) {
      toast.error(err.message || `Failed to disconnect ${integrationName}`);
    }
  };

  const handleOAuthConfirm = async () => {
    if (!oauthIntegration) return;
    setOauthLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const integrationKeyMap = {
        "Zoom": "zoom",
        "Google Meet": "googleMeet",
        "Microsoft Teams": "teams",
      };
      const key = integrationKeyMap[oauthIntegration];
      if (key) {
        setSettings((prev) => ({
          ...prev,
          integrations: {
            ...prev.integrations,
            [key]: true,
          },
        }));
      }
      toast.success(`${oauthIntegration} connected successfully!`);
      setOauthDialogOpen(false);
    } catch (err) {
      toast.error(`Failed to connect ${oauthIntegration}`);
    } finally {
      setOauthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Appointment Settings</h2>
        <Button onClick={handleSaveSettings}>
          <Save className="mr-2 h-4 w-4" /> Save Settings
        </Button>
      </div>

      {/* Availability Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center mb-4">
          <Clock className="mr-2 h-5 w-5" /> Default Availability
        </h3>

        <div className="space-y-4">
          <div className="grid gap-4">
            {weekdays.map((day) => (
              <div
                key={day.id}
                className="grid grid-cols-12 items-center gap-4"
              >
                <div className="col-span-3">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={settings.defaultAvailability[day.id].enabled}
                      onCheckedChange={(checked) =>
                        handleAvailabilityChange(day.id, "enabled", checked)
                      }
                    />
                    <Label>{day.label}</Label>
                  </div>
                </div>

                <div className="col-span-4 flex items-center space-x-2">
                  <Label className="w-12">From</Label>
                  <Input
                    type="time"
                    value={settings.defaultAvailability[day.id].start}
                    onChange={(e) =>
                      handleAvailabilityChange(day.id, "start", e.target.value)
                    }
                    disabled={!settings.defaultAvailability[day.id].enabled}
                  />
                </div>

                <div className="col-span-4 flex items-center space-x-2">
                  <Label className="w-12">To</Label>
                  <Input
                    type="time"
                    value={settings.defaultAvailability[day.id].end}
                    onChange={(e) =>
                      handleAvailabilityChange(day.id, "end", e.target.value)
                    }
                    disabled={!settings.defaultAvailability[day.id].enabled}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6 pt-4 border-t">
            <div>
              <Label htmlFor="timeZone">Time Zone</Label>
              <SelectInput
                id="timeZone"
                name="timeZone"
                options={timeZones}
                value={settings.timeZone}
                onChange={(e) =>
                  setSettings({ ...settings, timeZone: e.target.value })
                }
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="bufferTime">
                Buffer Between Appointments (minutes)
              </Label>
              <SelectInput
                id="bufferTime"
                name="bufferTime"
                options={[
                  { value: "0", label: "No buffer" },
                  { value: "5", label: "5 minutes" },
                  { value: "10", label: "10 minutes" },
                  { value: "15", label: "15 minutes" },
                  { value: "30", label: "30 minutes" },
                ]}
                value={settings.bufferTime.toString()}
                onChange={(e) =>
                  setSettings({ ...settings, bufferTime: parseInt(e.target.value) })
                }
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="minimumNotice">
                Minimum Scheduling Notice (hours)
              </Label>
              <Input
                id="minimumNotice"
                type="number"
                value={settings.minimumNotice}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    minimumNotice: parseInt(e.target.value),
                  })
                }
                min={0}
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="futureLimit">
                Booking Window (days in advance)
              </Label>
              <Input
                id="futureLimit"
                type="number"
                value={settings.futureLimit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    futureLimit: parseInt(e.target.value),
                  })
                }
                min={1}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Notification Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center mb-4">
          <Bell className="mr-2 h-5 w-5" /> Notifications
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="emailNotifications" className="font-medium">
                Email Notifications
              </Label>
              <p className="text-sm text-gray-500">
                Receive email notifications for new bookings, cancellations,
                etc.
              </p>
            </div>
            <Switch
              id="emailNotifications"
              checked={settings.notifications.emailNotifications}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    emailNotifications: checked,
                  },
                })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="smsNotifications" className="font-medium">
                SMS Notifications
              </Label>
              <p className="text-sm text-gray-500">
                Receive text messages for new bookings and reminders
              </p>
            </div>
            <Switch
              id="smsNotifications"
              checked={settings.notifications.smsNotifications}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  notifications: {
                    ...settings.notifications,
                    smsNotifications: checked,
                  },
                })
              }
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <Label htmlFor="sendReminders" className="font-medium">
                  Send Appointment Reminders
                </Label>
                <p className="text-sm text-gray-500">
                  Send automatic reminders to clients before appointments
                </p>
              </div>
              <Switch
                id="sendReminders"
                checked={settings.notifications.sendReminders}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    notifications: {
                      ...settings.notifications,
                      sendReminders: checked,
                    },
                  })
                }
              />
            </div>

            {settings.notifications.sendReminders && (
              <div className="ml-6 space-y-2">
                <Label className="text-sm font-medium">Reminder Timing</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder24h"
                      checked={settings.notifications.reminderTiming.includes(
                        24
                      )}
                      onCheckedChange={() => handleReminderToggle(24)}
                    />
                    <Label htmlFor="reminder24h" className="text-sm">
                      24 hours before
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder2h"
                      checked={settings.notifications.reminderTiming.includes(
                        2
                      )}
                      onCheckedChange={() => handleReminderToggle(2)}
                    />
                    <Label htmlFor="reminder2h" className="text-sm">
                      2 hours before
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="reminder1h"
                      checked={settings.notifications.reminderTiming.includes(
                        1
                      )}
                      onCheckedChange={() => handleReminderToggle(1)}
                    />
                    <Label htmlFor="reminder1h" className="text-sm">
                      1 hour before
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center mb-4">
          <Calendar className="mr-2 h-5 w-5" /> Calendar & Video Integrations
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Google Calendar</Label>
              <p className="text-sm text-gray-500">
                Sync appointments with your Google Calendar
              </p>
              {realIntegrations.googleCalendar && syncStatus.length > 0 && (
                (() => {
                  const s = syncStatus.find((st) => st.name === "Google Calendar" || st.provider === "Google Calendar");
                  if (!s) return null;
                  return (
                    <p className={`text-xs mt-0.5 ${s.errorCount > 0 ? "text-red-500" : "text-green-600"}`}>
                      {s.errorCount > 0 ? `${s.errorCount} sync error${s.errorCount > 1 ? "s" : ""} in last 24h` : "Sync healthy — last synced recently"}
                    </p>
                  );
                })()
              )}
            </div>
            <div className="flex items-center space-x-2">
              {realIntegrations.googleCalendar ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect("Google Calendar")}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOAuthConnect("googleCalendar", "Google Calendar")}
                >
                  Connect <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Outlook Calendar</Label>
              <p className="text-sm text-gray-500">
                Sync appointments with your Outlook Calendar
              </p>
              {realIntegrations.outlookCalendar && syncStatus.length > 0 && (
                (() => {
                  const s = syncStatus.find((st) => st.name === "Outlook Calendar" || st.provider === "Outlook Calendar");
                  if (!s) return null;
                  return (
                    <p className={`text-xs mt-0.5 ${s.errorCount > 0 ? "text-red-500" : "text-green-600"}`}>
                      {s.errorCount > 0 ? `${s.errorCount} sync error${s.errorCount > 1 ? "s" : ""} in last 24h` : "Sync healthy — last synced recently"}
                    </p>
                  );
                })()
              )}
            </div>
            <div className="flex items-center space-x-2">
              {realIntegrations.outlookCalendar ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDisconnect("Outlook Calendar")}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOAuthConnect("outlookCalendar", "Outlook Calendar")}
                >
                  Connect <ExternalLink className="ml-2 h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <Label className="font-medium">Video Conferencing</Label>
            <p className="text-sm text-gray-500 mb-4">
              Automatically generate meeting links for appointments
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Video className="h-4 w-4" />
                    <Label>Zoom</Label>
                  </div>
                  {realIntegrations.zoom && (
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">
                      Connected — meetings auto-generated for video appointments
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  {realIntegrations.zoom ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnect("Zoom")}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOAuthConnect("zoom", "Zoom")}
                    >
                      Connect <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4" />
                  <Label>Google Meet</Label>
                </div>
                <div className="flex items-center space-x-2">
                  {realIntegrations.googleCalendar?.config?.enableMeet ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVideoConfig("Google Meet", "enableMeet", false)}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVideoConfig("Google Meet", "enableMeet", true)}
                    >
                      Enable
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4" />
                  <Label>Microsoft Teams</Label>
                </div>
                <div className="flex items-center space-x-2">
                  {realIntegrations.outlookCalendar?.config?.enableTeams ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVideoConfig("Microsoft Teams", "enableTeams", false)}
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleVideoConfig("Microsoft Teams", "enableTeams", true)}
                    >
                      Enable
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Booking Page Settings */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold flex items-center mb-4">
          <Globe className="mr-2 h-5 w-5" /> Booking Page Settings
        </h3>

        <div className="space-y-4">
          <div>
            <Label>Logo</Label>
            <div className="mt-2 border rounded-lg p-4 bg-gray-50">
              {settings.bookingPage.logo ? (
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 bg-white border rounded-lg flex items-center justify-center overflow-hidden">
                    <img src={settings.bookingPage.logo} alt="Logo" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                    setSettings({
                      ...settings,
                      bookingPage: {
                        ...settings.bookingPage,
                        logo: "",
                      },
                    });
                      }}
                    >
                      Remove Logo
                    </Button>
                    <p className="text-xs text-gray-500">
                      Current logo: {settings.bookingPage.logo}
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      formData.append("entityType", "general");
                      try {
                        toast.loading("Uploading logo...", { id: "logo-upload" });
                        const res = await fetch("/api/v1/uploads", {
                          method: "POST",
                          body: formData,
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Upload failed");
                        setSettings({
                          ...settings,
                          bookingPage: {
                            ...settings.bookingPage,
                            logo: data.url,
                          },
                        });
                        toast.success("Logo uploaded!", { id: "logo-upload" });
                      } catch (err) {
                        toast.error(err.message || "Upload failed", { id: "logo-upload" });
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById("logo-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Logo
                  </Button>
                  <p className="text-xs text-gray-500 mt-2">
                    Recommended: PNG or JPG, max 10MB
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="slug">Booking Page URL</Label>
              <div className="flex items-center mt-1">
                <span className="text-sm text-gray-500 mr-1">
                  https://example.com/
                </span>
                <Input
                  id="slug"
                  value={settings.bookingPage.slug}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      bookingPage: {
                        ...settings.bookingPage,
                        slug: e.target.value,
                      },
                    })
                  }
                />
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label>Public Booking Link</Label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 overflow-auto">
                  {globalThis.window?.location?.origin ? `${globalThis.window.location.origin}/book/${settings.bookingPage.slug}` : `/book/${settings.bookingPage.slug}`}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const url = globalThis.window?.location?.origin ? `${globalThis.window.location.origin}/book/${settings.bookingPage.slug}` : `/book/${settings.bookingPage.slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("URL copied!");
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label>Embed Code (iframe)</Label>
              <textarea
                readOnly
                className="w-full text-sm bg-gray-100 p-2 rounded mt-1 font-mono"
                rows={3}
                value={`<iframe src="${globalThis.window?.location?.origin || ""}/book/${settings.bookingPage.slug}" width="100%" height="700" frameborder="0" allowfullscreen></iframe>`}
              />
            </div>

            <div>
              <Label htmlFor="brandColor">Brand Color</Label>
              <div className="flex items-center space-x-2 mt-1">
                <Input
                  id="brandColor"
                  type="color"
                  value={settings.bookingPage.brandColor}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      bookingPage: {
                        ...settings.bookingPage,
                        brandColor: e.target.value,
                      },
                    })
                  }
                  className="w-12 h-12 p-1"
                />
                <span>{settings.bookingPage.brandColor}</span>
              </div>
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={settings.bookingPage.welcomeMessage}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bookingPage: {
                      ...settings.bookingPage,
                      welcomeMessage: e.target.value,
                    },
                  })
                }
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="col-span-1 md:col-span-2">
              <Label htmlFor="redirectUrl">
                Redirect After Booking (optional)
              </Label>
              <Input
                id="redirectUrl"
                value={settings.bookingPage.redirectUrl}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    bookingPage: {
                      ...settings.bookingPage,
                      redirectUrl: e.target.value,
                    },
                  })
                }
                placeholder="https://example.com/thank-you"
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* OAuth Connection Dialog */}
      <Dialog open={oauthDialogOpen} onOpenChange={setOauthDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect {oauthIntegration}</DialogTitle>
            <DialogDescription>
              You will be redirected to {oauthIntegration} to authorize access to your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              This will allow the application to sync appointments and generate meeting links automatically.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOauthDialogOpen(false)}
              disabled={oauthLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleOAuthConfirm} disabled={oauthLoading}>
              {oauthLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {oauthLoading ? "Connecting..." : "Authorize"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
