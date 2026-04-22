'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, FileImage } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import type { ImagingReportSummary } from '@/lib/fhir/imaging-constants';

interface ImagingResultsViewProps {
  patientId: string;
  encounterId?: string;
}

export function ImagingResultsView({ patientId, encounterId }: ImagingResultsViewProps) {
  const [studies, setStudies] = useState<ImagingReportSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadImagingStudies = useCallback(async () => {
    try {
      const endpoint = encounterId 
        ? `/api/imaging/results?encounterId=${encounterId}`
        : `/api/imaging/results?patientId=${patientId}`;
      
      const response = await fetch(endpoint);
      const data = await response.json();

      if (response.ok) {
        setStudies(data.studies || []);
      }
    } catch (error) {
      console.error('Error loading imaging studies:', error);
    } finally {
      setIsLoading(false);
    }
  }, [encounterId, patientId]);

  useEffect(() => {
    loadImagingStudies();
  }, [loadImagingStudies]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available': return 'default';
      case 'registered': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getReportStatusColor = (status?: string) => {
    switch (status) {
      case 'final': return 'default';
      case 'preliminary': return 'secondary';
      case 'amended': return 'outline';
      case 'corrected': return 'outline';
      default: return 'secondary';
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

  if (studies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Imaging Studies</CardTitle>
          <CardDescription>No imaging studies available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No imaging studies have been ordered or completed for this {encounterId ? 'encounter' : 'patient'}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {studies.map((study) => (
        <Card key={study.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileImage className="h-5 w-5" />
                  <CardTitle>{study.procedure}</CardTitle>
                </div>
                <CardDescription>
                  <div className="flex items-center gap-2 text-xs">
                    <Badge variant="outline">{study.modality}</Badge>
                    <span>•</span>
                    <span>Ordered: {new Date(study.orderedAt).toLocaleDateString()}</span>
                    {study.performedAt && (
                      <>
                        <span>•</span>
                        <span>Performed: {new Date(study.performedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </CardDescription>
              </div>
              <Badge variant={getStatusColor(study.status)}>
                {study.status.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Study Information */}
            {study.study && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold">Study Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {study.study.accessionNumber && (
                    <div>
                      <p className="text-muted-foreground">Accession #</p>
                      <p className="font-medium">{study.study.accessionNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-muted-foreground">Series</p>
                    <p className="font-medium">{study.study.numberOfSeries}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Images</p>
                    <p className="font-medium">{study.study.numberOfInstances}</p>
                  </div>
                  {study.study.pacsUrl && (
                    <div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => window.open(study.study?.pacsUrl, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View in PACS
                      </Button>
                    </div>
                  )}
                </div>

                {/* Series Information */}
                {study.study.series.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Series:</p>
                    <div className="grid gap-2">
                      {study.study.series.map((series) => (
                        <div
                          key={series.uid}
                          className="flex items-center justify-between p-3 border rounded-lg bg-accent/50"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              Series {series.number}: {series.description || 'Unnamed Series'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {series.numberOfInstances} images • {series.modality}
                              {series.bodySite && ` • ${series.bodySite}`}
                            </p>
                          </div>
                          {series.endpoint && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(series.endpoint, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Radiology Report */}
            {study.report && (
              <>
                <Separator />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold">Radiology Report</h4>
                    <Badge variant={getReportStatusColor(study.report.status)}>
                      {study.report.status?.toUpperCase()}
                    </Badge>
                  </div>

                  {/* Findings */}
                  {study.report.findings && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Findings:</p>
                      <div className="rounded-lg bg-muted p-4">
                        <p className="text-sm whitespace-pre-line">{study.report.findings}</p>
                      </div>
                    </div>
                  )}

                  {/* Impression */}
                  {study.report.impression && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Impression:</p>
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                        <p className="text-sm font-medium whitespace-pre-line">
                          {study.report.impression}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Report Metadata */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                    {study.report.radiologist && (
                      <span>Interpreted by: {study.report.radiologist}</span>
                    )}
                    {study.report.issuedAt && (
                      <span>Issued: {new Date(study.report.issuedAt).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* No Report Available */}
            {!study.report && study.status === 'available' && (
              <div className="rounded-lg border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Images are available but radiologist report is pending.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}







