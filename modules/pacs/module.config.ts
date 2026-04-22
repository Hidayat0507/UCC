import type { ModuleDefinition } from "@/lib/module-registry";

const moduleDefinition = {
  id: "pacs",
  label: "PACS (Medical Imaging)",
  description: "Picture Archiving and Communication System for medical images.",
  routePath: "/pacs",
  icon: "image",
  pages: {
    default: {
      title: "Medical Imaging",
      description: "View and manage imaging orders and studies.",
      load: () => import("./pages/pacs-root"),
    },
  },
} satisfies ModuleDefinition;

export default moduleDefinition;
