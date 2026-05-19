"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";

type DeliveryMode = "manual" | "twilio";

interface FollowUpSettingsState {
  deliveryMode: DeliveryMode;
  googleReviewUrl: string;
  reviewTemplate: string;
  appointmentTemplate: string;
  twilioReviewContentSid: string;
  twilioAppointmentContentSid: string;
}

const EMPTY_SETTINGS: FollowUpSettingsState = {
  deliveryMode: "manual",
  googleReviewUrl: "",
  reviewTemplate: "",
  appointmentTemplate: "",
  twilioReviewContentSid: "",
  twilioAppointmentContentSid: "",
};

export function FollowUpSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = React.useState<FollowUpSettingsState>(EMPTY_SETTINGS);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const response = await fetch("/api/settings/follow-up", { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.success) throw new Error(data.error || "Failed to load follow-up settings");
        if (active) setSettings(data.settings);
      } catch (error) {
        toast({
          title: "Unable to load follow-up settings",
          description: error instanceof Error ? error.message : "Please try again.",
          variant: "destructive",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [toast]);

  function update<K extends keyof FollowUpSettingsState>(key: K, value: FollowUpSettingsState[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings/follow-up", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) throw new Error(data.error || "Failed to save follow-up settings");
      setSettings(data.settings);
      toast({ title: "Follow-up settings saved", description: "New follow-ups will use these settings." });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Could not save follow-up settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading follow-up settings...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Delivery mode</Label>
        <Select value={settings.deliveryMode} onValueChange={(value) => update("deliveryMode", value as DeliveryMode)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="manual">Manual WhatsApp</SelectItem>
            <SelectItem value="twilio">Twilio WhatsApp</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="google-review-url">Google review URL</Label>
        <Input
          id="google-review-url"
          placeholder="https://g.page/r/..."
          value={settings.googleReviewUrl}
          onChange={(event) => update("googleReviewUrl", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-template">Review request template</Label>
        <Textarea
          id="review-template"
          rows={3}
          value={settings.reviewTemplate}
          onChange={(event) => update("reviewTemplate", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Available variables: {"{{patientName}}"}, {"{{reviewUrl}}"}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="appointment-template">Appointment reminder template</Label>
        <Textarea
          id="appointment-template"
          rows={3}
          value={settings.appointmentTemplate}
          onChange={(event) => update("appointmentTemplate", event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Available variables: {"{{patientName}}"}, {"{{appointmentDate}}"}, {"{{clinicName}}"}, {"{{clinicSuffix}}"}
        </p>
      </div>

      {settings.deliveryMode === "twilio" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="twilio-review-content">Review Content SID</Label>
            <Input
              id="twilio-review-content"
              value={settings.twilioReviewContentSid}
              onChange={(event) => update("twilioReviewContentSid", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="twilio-appointment-content">Appointment Content SID</Label>
            <Input
              id="twilio-appointment-content"
              value={settings.twilioAppointmentContentSid}
              onChange={(event) => update("twilioAppointmentContentSid", event.target.value)}
            />
          </div>
        </div>
      ) : null}

      <Button type="button" onClick={save} disabled={saving}>
        {saving ? "Saving..." : "Save Follow Up Settings"}
      </Button>
    </div>
  );
}
