'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { LAB_TESTS, type LabTestCode } from '@/lib/fhir/lab-constants';
import { toast } from 'sonner';

interface LabOrderFormProps {
  patientId: string;
  encounterId?: string;
  onOrderPlaced?: (serviceRequestId: string) => void;
}

// Group tests by category (restricted)
const LAB_TEST_CATEGORIES = {
  Panels: ['CBC', 'RENAL_PROFILE', 'LFT'] as LabTestCode[],
};

export function LabOrderForm({ patientId, encounterId, onOrderPlaced }: LabOrderFormProps) {
  const [selectedTests, setSelectedTests] = useState<Set<LabTestCode>>(new Set());
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleTest = (testCode: LabTestCode) => {
    const newSelected = new Set(selectedTests);
    if (newSelected.has(testCode)) {
      newSelected.delete(testCode);
    } else {
      newSelected.add(testCode);
    }
    setSelectedTests(newSelected);
  };

  const selectCategory = (category: keyof typeof LAB_TEST_CATEGORIES) => {
    const newSelected = new Set(selectedTests);
    LAB_TEST_CATEGORIES[category].forEach(test => newSelected.add(test));
    setSelectedTests(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedTests.size === 0) {
      toast.error('Please select at least one test');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/labs/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          encounterId,
          tests: Array.from(selectedTests),
          priority,
          clinicalNotes: clinicalNotes || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place lab order');
      }

      toast.success('Lab order placed successfully');
      
      // Reset form
      setSelectedTests(new Set());
      setClinicalNotes('');
      setPriority('routine');

      if (onOrderPlaced) {
        onOrderPlaced(data.serviceRequestId);
      }
    } catch (error: any) {
      console.error('Error placing lab order:', error);
      toast.error(error.message || 'Failed to place lab order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Laboratory Tests</CardTitle>
        <CardDescription>
          Select tests and specify priority for Point-of-Care Testing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Priority Selection */}
        <div className="space-y-2">
          <Label>Priority</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={priority === 'routine' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPriority('routine')}
            >
              Routine
            </Button>
            <Button
              type="button"
              variant={priority === 'urgent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPriority('urgent')}
            >
              Urgent
            </Button>
            <Button
              type="button"
              variant={priority === 'stat' ? 'destructive' : 'outline'}
              size="sm"
              onClick={() => setPriority('stat')}
            >
              STAT
            </Button>
          </div>
        </div>

        {/* Test Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Select Tests</Label>
            {selectedTests.size > 0 && (
              <Badge variant="secondary">{selectedTests.size} tests selected</Badge>
            )}
          </div>

          <Tabs defaultValue="Panels" className="w-full">
            <TabsList className="grid w-full grid-cols-1">
              <TabsTrigger value="Panels">Panels</TabsTrigger>
            </TabsList>

            <TabsContent value="Panels" className="space-y-4">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => selectCategory('Panels')}
              >
                Select All Panels
              </Button>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LAB_TEST_CATEGORIES.Panels.map((testCode) => (
                  <div key={testCode} className="flex items-center space-x-2">
                    <Checkbox
                      id={testCode}
                      checked={selectedTests.has(testCode)}
                      onCheckedChange={() => toggleTest(testCode)}
                    />
                    <Label
                      htmlFor={testCode}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {LAB_TESTS[testCode].display}
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Clinical Notes */}
        <div className="space-y-2">
          <Label htmlFor="clinicalNotes">Clinical Notes (Optional)</Label>
          <Textarea
            id="clinicalNotes"
            placeholder="Enter clinical indication or special instructions..."
            value={clinicalNotes}
            onChange={(e) => setClinicalNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedTests.size === 0}
          className="w-full"
        >
          {isSubmitting ? 'Placing Order...' : `Place Order (${selectedTests.size} tests)`}
        </Button>
      </CardContent>
    </Card>
  );
}







