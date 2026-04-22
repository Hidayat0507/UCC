/**
 * Module Management System
 * Allows features like POCT, PACS, Triage to be enabled/disabled
 */

export type ModuleId = 'triage' | 'poct' | 'pacs' | 'inventory' | 'appointments' | 'analytics';

export interface Module {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  route?: string;
  enabled: boolean;
  category: 'clinical' | 'administrative' | 'diagnostic';
}

// Default module configuration
export const MODULES: Record<ModuleId, Omit<Module, 'enabled'>> = {
  triage: {
    id: 'triage',
    name: 'Triage',
    description: 'Patient triage and priority queue management',
    icon: 'AlertTriangle',
    // route removed - triage is now integrated into Dashboard
    category: 'clinical',
  },
  poct: {
    id: 'poct',
    name: 'POCT',
    description: 'On-site laboratory testing and results management',
    icon: 'TestTube',
    route: '/poct',
    category: 'diagnostic',
  },
  pacs: {
    id: 'pacs',
    name: 'PACS',
    description: 'Picture Archiving and Communication System for medical images',
    icon: 'Image',
    route: '/pacs',
    category: 'diagnostic',
  },
  inventory: {
    id: 'inventory',
    name: 'Inventory',
    description: 'Medication and supplies inventory tracking',
    icon: 'Package',
    route: '/inventory',
    category: 'administrative',
  },
  appointments: {
    id: 'appointments',
    name: 'Appointments',
    description: 'Appointment scheduling and management',
    icon: 'Calendar',
    route: '/appointments',
    category: 'administrative',
  },
  analytics: {
    id: 'analytics',
    name: 'Analytics',
    description: 'Statistical analysis and reporting',
    icon: 'BarChart',
    route: '/analytics',
    category: 'administrative',
  },
};

// Get module configuration from environment or localStorage
export function getModuleConfig(): Record<ModuleId, Module> {
  const config: Record<string, Module> = {};
  
  for (const [id, module] of Object.entries(MODULES)) {
    const envKey = `NEXT_PUBLIC_MODULE_${id.toUpperCase()}`;
    const envValue = process.env[envKey];
    
    // Default enabled state
    let enabled = true;
    
    // Check environment variable
    if (envValue !== undefined) {
      enabled = envValue === 'true' || envValue === '1';
    }
    
    // For client-side, also check localStorage
    if (typeof window !== 'undefined') {
      const storedValue = localStorage.getItem(`module_${id}`);
      if (storedValue !== null) {
        enabled = storedValue === 'true';
      }
    }
    
    config[id] = {
      ...module,
      enabled,
    } as Module;
  }
  
  return config as Record<ModuleId, Module>;
}

// Check if a module is enabled
export function isModuleEnabled(moduleId: ModuleId): boolean {
  const config = getModuleConfig();
  return config[moduleId]?.enabled ?? false;
}

// Get all enabled modules
export function getEnabledModules(): Module[] {
  const config = getModuleConfig();
  return Object.values(config).filter((module) => module.enabled);
}

// Get modules by category
export function getModulesByCategory(category: Module['category']): Module[] {
  const config = getModuleConfig();
  return Object.values(config).filter(
    (module) => module.category === category && module.enabled
  );
}

// Client-side: Toggle module state
export function toggleModule(moduleId: ModuleId, enabled: boolean): void {
  if (typeof window === 'undefined') return;
  
  localStorage.setItem(`module_${moduleId}`, String(enabled));
  
  // Trigger a custom event to notify other components
  window.dispatchEvent(
    new CustomEvent('moduleToggle', {
      detail: { moduleId, enabled },
    })
  );
}

// Client-side: Get all module states
export function getAllModuleStates(): Record<ModuleId, boolean> {
  if (typeof window === 'undefined') {
    return Object.keys(MODULES).reduce((acc, id) => {
      acc[id as ModuleId] = true;
      return acc;
    }, {} as Record<ModuleId, boolean>);
  }
  
  return Object.keys(MODULES).reduce((acc, id) => {
    const stored = localStorage.getItem(`module_${id}`);
    acc[id as ModuleId] = stored === null ? true : stored === 'true';
    return acc;
  }, {} as Record<ModuleId, boolean>);
}

// Client-side: Reset all modules to default
export function resetModulesToDefault(): void {
  if (typeof window === 'undefined') return;
  
  Object.keys(MODULES).forEach((id) => {
    localStorage.removeItem(`module_${id}`);
  });
  
  window.dispatchEvent(new CustomEvent('modulesReset'));
}








