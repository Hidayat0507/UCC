import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LandingPage from "@/app/(routes)/landing/page";
import { SESSION_COOKIE } from "@/lib/server/cookie-constants";

export const dynamic = "force-dynamic";

export default async function Home() {
  const jar = await cookies();
  if (jar.get(SESSION_COOKIE)?.value) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}
