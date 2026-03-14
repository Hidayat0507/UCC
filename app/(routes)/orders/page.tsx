import { getConsultationsWithDetails } from "@/lib/models";
import { QueueStatus } from '@/lib/types';
import OrdersClient from "./orders-client";

export const dynamic = 'force-dynamic';

export default async function OrdersPage() {
  const statuses: QueueStatus[] = ['meds_and_bills', 'completed'];
  const consultations = await getConsultationsWithDetails(statuses);

  return <OrdersClient initialConsultations={consultations} />;
}
