import NewPatientForm from "./new-patient-form";

type SearchParams = { [key: string]: string | string[] | undefined };
type VisitIntent = "consultation" | "otc" | "follow_up";

type Props = {
  searchParams?: Promise<SearchParams>;
};

export default async function Page({ searchParams }: Props) {
  const resolvedParams: SearchParams = searchParams
    ? await searchParams.catch(() => ({} as SearchParams))
    : {};

  const fullName = typeof resolvedParams.fullName === "string" ? resolvedParams.fullName : "";
  const nric = typeof resolvedParams.nric === "string" ? resolvedParams.nric : "";
  const visitIntentValue =
    typeof resolvedParams.visitIntent === "string" ? resolvedParams.visitIntent : "";
  const visitIntent: VisitIntent | undefined =
    visitIntentValue === "consultation" ||
    visitIntentValue === "otc" ||
    visitIntentValue === "follow_up"
      ? visitIntentValue
      : undefined;

  return (
    <NewPatientForm
      initialFullName={fullName}
      initialNric={nric}
      initialVisitIntent={visitIntent}
    />
  );
}
