'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { IMAGING_PROCEDURES, type ImagingProcedureCode } from '@/lib/fhir/imaging-constants';
import { toast } from 'sonner';

interface ImagingOrderFormProps {
  patientId: string;
  encounterId?: string;
  onOrderPlaced?: (serviceRequestId: string) => void;
}

// Group procedures by modality type
const IMAGING_CATEGORIES = {
  'X-Ray': ['CHEST_XRAY', 'CHEST_XRAY_2V', 'ABDOMEN_XRAY', 'SPINE_LUMBAR_XRAY', 'KNEE_XRAY'] as ImagingProcedureCode[],
  'CT Scan': ['HEAD_CT', 'HEAD_CT_CONTRAST', 'CHEST_CT', 'ABDOMEN_CT', 'CTPA'] as ImagingProcedureCode[],
  'MRI': ['BRAIN_MRI', 'SPINE_MRI', 'KNEE_MRI'] as ImagingProcedureCode[],
  'Ultrasound': ['ABDOMEN_US', 'PELVIS_US', 'OBSTETRIC_US', 'THYROID_US', 'ECHO'] as ImagingProcedureCode[],
  'Mammography': ['MAMMOGRAM', 'MAMMOGRAM_BILATERAL'] as ImagingProcedureCode[],
};

export function ImagingOrderForm({ patientId, encounterId, onOrderPlaced }: ImagingOrderFormProps) {
  const [selectedProcedures, setSelectedProcedures] = useState<Set<ImagingProcedureCode>>(new Set());
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>('routine');
  const [clinicalIndication, setClinicalIndication] = useState('');
  const [clinicalQuestion, setClinicalQuestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleProcedure = (procedureCode: ImagingProcedureCode) => {
    const newSelected = new Set(selectedProcedures);
    if (newSelected.has(procedureCode)) {
      newSelected.delete(procedureCode);
    } else {
      newSelected.add(procedureCode);
    }
    setSelectedProcedures(newSelected);
  };

  const handleSubmit = async () => {
    if (selectedProcedures.size === 0) {
      toast.error('Please select at least one imaging procedure');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/imaging/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId,
          encounterId,
          procedures: Array.from(selectedProcedures),
          priority,
          clinicalIndication: clinicalIndication || undefined,
          clinicalQuestion: clinicalQuestion || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to place imaging order');
      }

      toast.success('Imaging order placed successfully');
      
      // Reset form
      setSelectedProcedures(new Set());
      setClinicalIndication('');
      setClinicalQuestion('');
      setPriority('routine');

      if (onOrderPlaced) {
        onOrderPlaced(data.serviceRequestId);
      }
    } catch (error: any) {
      console.error('Error placing imaging order:', error);
      toast.error(error.message || 'Failed to place imaging order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Imaging Studies</CardTitle>
        <CardDescription>
          Select imaging procedures and provide clinical indication
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

        {/* Procedure Selection by Modality */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Select Procedures</Label>
            {selectedProcedures.size > 0 && (
              <Badge variant="secondary">{selectedProcedures.size} procedures selected</Badge>
            )}
          </div>

          <Tabs defaultValue="X-Ray" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="X-Ray">X-Ray</TabsTrigger>
              <TabsTrigger value="CT Scan">CT</TabsTrigger>
              <TabsTrigger value="MRI">MRI</TabsTrigger>
              <TabsTrigger value="Ultrasound">US</TabsTrigger>
              <TabsTrigger value="Mammography">Mammo</TabsTrigger>
            </TabsList>

            {Object.entries(IMAGING_CATEGORIES).map(([category, procedures]) => (
              <TabsContent key={category} value={category} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {procedures.map((procedureCode) => (
                    <div key={procedureCode} className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-accent">
                      <Checkbox
                        id={procedureCode}
                        checked={selectedProcedures.has(procedureCode)}
                        onCheckedChange={() => toggleProcedure(procedureCode)}
                      />
                      <Label
                        htmlFor={procedureCode}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                      >
                        {IMAGING_PROCEDURES[procedureCode].display}
                      </Label>
                      <Badge variant="outline" className="text-xs">
                        {IMAGING_PROCEDURES[procedureCode].modality}
                      </Badge>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </div>

        {/* Clinical Indication */}
        <div className="space-y-2">
          <Label htmlFor="clinicalIndication">Clinical Indication *</Label>
          <Textarea
            id="clinicalIndication"
            placeholder="e.g., Suspected pneumonia, shortness of breath, fever x3 days"
            value={clinicalIndication}
            onChange={(e) => setClinicalIndication(e.target.value)}
            rows={2}
            required
          />
          <p className="text-xs text-muted-foreground">
            Provide the reason for the imaging study
          </p>
        </div>

        {/* Clinical Question */}
        <div className="space-y-2">
          <Label htmlFor="clinicalQuestion">Clinical Question (Optional)</Label>
          <Textarea
            id="clinicalQuestion"
            placeholder="e.g., Rule out consolidation? Evaluate for pleural effusion?"
            value={clinicalQuestion}
            onChange={(e) => setClinicalQuestion(e.target.value)}
            rows={2}
          />
          <p className="text-xs text-muted-foreground">
            What specific question should the radiologist answer?
          </p>
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || selectedProcedures.size === 0 || !clinicalIndication.trim()}
          className="w-full"
        >
          {isSubmitting ? 'Placing Order...' : `Place Order (${selectedProcedures.size} procedures)`}
        </Button>
      </CardContent>
    </Card>
  );
}








