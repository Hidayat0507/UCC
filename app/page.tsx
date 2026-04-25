import Link from "next/link";

export const dynamic = "force-dynamic";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "Contact", href: "mailto:hello@iatrum.com" },
];

const FEATURES = [
  {
    icon: "🏥",
    title: "Patient Queue Management",
    description:
      "Real-time queue visibility across every clinic. Staff see waitlists, check-ins, and triage status at a glance.",
  },
  {
    icon: "📋",
    title: "Clinical Workflows",
    description:
      "Guided consultation flows with structured SOAP notes, diagnosis coding, prescriptions, and referrals built in.",
  },
  {
    icon: "🧪",
    title: "Lab & Imaging Orders",
    description:
      "Order investigations, capture results, and attach reports — all linked to the patient's permanent record.",
  },
  {
    icon: "🏢",
    title: "Multi-Clinic Management",
    description:
      "Run a single clinic or an entire group. Each branch gets its own portal; admin sees everything from one dashboard.",
  },
  {
    icon: "💊",
    title: "Inventory & Billing",
    description:
      "Track medications, consumables, and supplier orders. Generate itemised bills and medical certificates in seconds.",
  },
  {
    icon: "🔒",
    title: "FHIR-Compliant Records",
    description:
      "Patient data stored on a battle-tested FHIR backend — structured, interoperable, and audit-ready.",
  },
];

const STEPS = [
  {
    step: "01",
    title: "Set up your clinic",
    description:
      "Register your clinic, add your team, and configure the modules you need. Go live in a day.",
  },
  {
    step: "02",
    title: "Onboard your patients",
    description:
      "Import existing records or register patients on arrival. Every visit is tracked from check-in to discharge.",
  },
  {
    step: "03",
    title: "Run smarter, grow faster",
    description:
      "Use analytics, billing insights, and inventory reports to make data-driven decisions across your network.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight" style={{ color: "#1c1e4b" }}>
              Iatrum<span className="font-light">OS</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <a
            href="mailto:hello@iatrum.com?subject=Demo Request"
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#1c1e4b" }}
          >
            Book a Demo
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 py-28 text-center md:py-36">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 60% 40%, #1c1e4b 0%, transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-4xl">
          <span
            className="mb-6 inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
            style={{ backgroundColor: "#eef0f8", color: "#1c1e4b" }}
          >
            Built for clinic owners
          </span>
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            The operating system
            <br />
            <span style={{ color: "#1c1e4b" }}>for modern clinics.</span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-lg leading-relaxed text-gray-500">
            Iatrum OS brings your patient queue, clinical records, billing, and
            multi-branch management into one intelligent platform — so you can
            focus on care, not admin.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="mailto:hello@iatrum.com?subject=Demo Request"
              className="rounded-xl px-8 py-4 text-base font-semibold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
              style={{ backgroundColor: "#1c1e4b" }}
            >
              Book a Demo →
            </a>
            <a
              href="#features"
              className="rounded-xl border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-50"
            >
              See Features
            </a>
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <div className="border-y border-gray-100 bg-gray-50 px-6 py-10">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 text-center md:grid-cols-4">
          {[
            { value: "< 1 day", label: "Setup time" },
            { value: "Multi-branch", label: "Clinic networks supported" },
            { value: "FHIR R4", label: "Compliant records" },
            { value: "Real-time", label: "Queue & analytics" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold" style={{ color: "#1c1e4b" }}>
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Features */}
      <section id="features" className="px-6 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Everything your clinic needs
            </h2>
            <p className="mx-auto max-w-xl text-gray-500">
              From the front desk to the consulting room, Iatrum OS covers every
              touchpoint in the patient journey.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="mb-4 text-3xl">{feature.icon}</div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section
        id="how-it-works"
        className="px-6 py-24"
        style={{ backgroundColor: "#f7f8fc" }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
              Up and running in three steps
            </h2>
            <p className="text-gray-500">
              No lengthy implementations. No IT department needed.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {STEPS.map((step) => (
              <div key={step.step} className="text-center">
                <div
                  className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full text-lg font-bold text-white"
                  style={{ backgroundColor: "#1c1e4b" }}
                >
                  {step.step}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section
        className="px-6 py-24 text-center text-white"
        style={{ backgroundColor: "#1c1e4b" }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl">
            Ready to run your clinic smarter?
          </h2>
          <p className="mb-10 text-blue-200">
            Book a personalised demo and see how Iatrum OS fits your clinic in
            30 minutes.
          </p>
          <a
            href="mailto:hello@iatrum.com?subject=Demo Request"
            className="inline-block rounded-xl bg-white px-10 py-4 text-base font-semibold transition-all hover:scale-105"
            style={{ color: "#1c1e4b" }}
          >
            Book a Demo →
          </a>
        </div>
      </section>

      {/* Footer */}
        <footer className="border-t border-gray-100 bg-white px-6 py-10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-gray-400 md:flex-row">
            <span className="font-semibold" style={{ color: "#1c1e4b" }}>
              IatrumOS
            </span>
            <span>© {new Date().getFullYear()} Iatrum. All rights reserved.</span>
            <div className="flex gap-6">
              <a href="mailto:hello@iatrum.com" className="hover:text-gray-600">
                hello@iatrum.com
              </a>
            </div>
          </div>
          {/* Compliance - Companies Act 2016 Section 30(2)(b) */}
          <div className="mx-auto mt-6 max-w-7xl border-t border-gray-100 pt-6 text-center text-xs text-gray-400">
            IATRUM SDN. BHD. (Registration No. 202601015400 (1677497-X))
          </div>
        </footer>
    </div>
  );
}
