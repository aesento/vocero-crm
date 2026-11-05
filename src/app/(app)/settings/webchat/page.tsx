import { notFound } from "next/navigation";
import { WebchatClient } from "@/components/settings/webchat-client";
import { isChannelEnabled } from "@/server/channels/enabled";

export const dynamic = "force-dynamic";

export default function WebchatSettingsPage() {
  if (!isChannelEnabled("webchat")) notFound();
  return <WebchatClient />;
}
