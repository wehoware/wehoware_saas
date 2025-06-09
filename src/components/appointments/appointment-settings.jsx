"use client";

import { useState } from "react";
import {
  Save,
  Clock,
  Globe,
  Calendar,
  Bell,
  ExternalLink,
  Video,
  
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

export function AppointmentSettings() {
  const [settings, setSettings] = useState({
    // General settings
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
    futureLimit: 60, // Days

    // Notification settings
    notifications: {
      emailNotifications: true,
      smsNotifications: false,
      sendReminders: true,
      reminderTiming: [24, 1], // Hours before appointment
    },

    // Integration settings
    integrations: {
      googleCalendar: false,
      outlookCalendar: false,
      zoom: false,
      googleMeet: true,
      teams: false,
    },

    // Booking page settings
    bookingPage: {
      slug: "acme-company",
      brandColor: "#4f46e5",
      logo: "/path/to/logo.png",
      welcomeMessage:
        "Thanks for scheduling with Acme Company. Please select an appointment type below.",
      redirectUrl: "",
    },
  });

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

  const handleSaveSettings = () => {
    // In a real app, this would save to backend
    console.log("Saving settings:", settings);
    alert("Settings saved!");
  };

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
            </div>
            <div className="flex items-center space-x-2">
              {settings.integrations.googleCalendar ? (
                <Badge>Connected</Badge>
              ) : (
                <Button variant="outline" size="sm">
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
            </div>
            <div className="flex items-center space-x-2">
              {settings.integrations.outlookCalendar ? (
                <Badge>Connected</Badge>
              ) : (
                <Button variant="outline" size="sm">
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
                <div className="flex items-center space-x-2">
                  <Video className="h-4 w-4" />
                  <Label>Zoom</Label>
                </div>
                <div className="flex items-center space-x-2">
                  {settings.integrations.zoom ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
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
                  {settings.integrations.googleMeet ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
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
                  {settings.integrations.teams ? (
                    <Badge>Connected</Badge>
                  ) : (
                    <Button variant="outline" size="sm">
                      Connect
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
    </div>
  );
}
