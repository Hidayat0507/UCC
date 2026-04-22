'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, CheckCircle2, TrendingDown, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { LabReportSummary } from '@/lib/fhir/lab-constants';

interface LabResultsViewProps {
  patientId: string;
  encounterId?: string;
}

export function LabResultsView({ patientId, encounterId }: LabResultsViewProps) {
  const [reports, setReports] = useState<LabReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLabResults = useCallback(async () => {
    try {
      const endpoint = encounterId 
        ? `/api/labs/results?encounterId=${encounterId}`
        : `/api/labs/results?patientId=${patientId}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();

      if (response.ok) {
        setReports(data.reports || []);
      }
    } catch (error) {
      console.error('Error loading lab results:', error);
    } finally {
      setIsLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => {
    loadLabResults();
  }, [loadLabResults]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'final': return 'default';
      case 'preliminary': return 'secondary';
      case 'corrected': return 'outline';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getInterpretationIcon = (interpretation?: string) => {
    switch (interpretation) {
      case 'normal':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'high':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'low':
        return <TrendingDown className="h-4 w-4 text-blue-500" />;
      case 'critical':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Laboratory Results</CardTitle>
          <CardDescription>No lab results available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No laboratory tests have been ordered or completed for this {encounterId ? 'encounter' : 'patient'}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {reports.map((report) => (
        <Card key={report.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>Laboratory Report</CardTitle>
                <CardDescription>
                  Ordered: {new Date(report.orderedAt).toLocaleDateString()}
                  {report.issuedAt && ` • Issued: ${new Date(report.issuedAt).toLocaleDateString()}`}
                </CardDescription>
              </div>
              <Badge variant={getStatusColor(report.status)}>
                {report.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Critical Results Alert */}
            {report.results.some(r => r.interpretation === 'critical') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Critical Results Detected</AlertTitle>
                <AlertDescription>
                  This report contains critical values that require immediate attention.
                </AlertDescription>
              </Alert>
            )}

            {/* Results Table */}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Reference Range</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Interpretation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.results.map((result, idx) => (
                  <TableRow key={idx} className={result.interpretation === 'critical' ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">{result.testName}</TableCell>
                    <TableCell>
                      {result.value} {result.unit}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {result.referenceRange || 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {result.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        {getInterpretationIcon(result.interpretation)}
                        {result.interpretation && (
                          <span className="text-xs capitalize">
                            {result.interpretation}
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Conclusion */}
            {report.conclusion && (
              <div className="rounded-lg bg-muted p-4">
                <h4 className="text-sm font-semibold mb-2">Conclusion</h4>
                <p className="text-sm">{report.conclusion}</p>
              </div>
            )}

            {/* Ordering Physician */}
            {report.orderingPhysician && (
              <p className="text-sm text-muted-foreground">
                Ordered by: {report.orderingPhysician}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}







