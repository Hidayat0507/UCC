import type { ModuleDefinition } from "@/lib/module-registry";

const moduleDefinition = {
  id: "poct",
  label: "POCT (Point of Care Testing)",
  description: "On-site laboratory testing and results management.",
  routePath: "/poct",
  icon: "test-tube",
  pages: {
    default: {
      title: "Point of Care Testing",
      description: "Manage point-of-care tests and results.",
      load: () => import("./pages/poct-root"),
    },
  },
} satisfies ModuleDefinition;

export default moduleDefinition;
