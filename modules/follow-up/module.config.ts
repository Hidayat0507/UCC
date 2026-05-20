import type { ModuleDefinition } from "@/lib/module-registry";

const moduleDefinition = {
  id: "follow-up",
  label: "Follow Up",
  description: "Patient review requests, appointment reminders, and WhatsApp follow-up work.",
  routePath: "/follow-up",
  icon: "message-circle",
  pages: {
    default: {
      title: "Follow Up",
      description: "Manage patient follow-ups and reminders.",
      load: () => import("./pages/follow-up-root"),
    },
  },
} satisfies ModuleDefinition;

export default moduleDefinition;
