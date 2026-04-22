import Link from 'next/link';

export const metadata = {
  title: 'Clinic not found — UCC EMR',
};

export default function ClinicNotFoundPage() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="space-y-3 max-w-md">
        <p className="text-5xl">🏥</p>
        <h1 className="text-2xl font-semibold">Clinic not found</h1>
        <p className="text-muted-foreground">
          The clinic at this address does not exist or has not been set up yet.
          Please check your URL, or contact your system administrator.
        </p>
      </div>

      <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
        <p>If you believe this is an error, try:</p>
        <ul className="list-disc text-left space-y-1 pl-4">
          <li>Double-checking the subdomain in your browser's address bar</li>
          <li>Asking your administrator to verify the clinic is provisioned</li>
          <li>
            Visiting the{' '}
            <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
              login page
            </Link>{' '}
            if you have direct access
          </li>
        </ul>
      </div>
    </div>
  );
}
