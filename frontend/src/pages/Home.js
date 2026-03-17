import React from 'react';
import { Link } from 'react-router-dom';

const workflow = [
  'Citizen submits complaint with text, image, and location.',
  'AI predicts category, department, and priority.',
  'Admin reviews and assigns the best field worker.',
  'Worker updates progress and closes the issue.',
];

const featureCards = [
  {
    title: 'Smart Routing',
    text: 'Complaints are categorized and prioritized automatically before they reach the admin desk.',
  },
  {
    title: 'Admin Analytics',
    text: 'Dashboards track department load, resolution speed, and the most common civic issues.',
  },
  {
    title: 'Worker Workflow',
    text: 'Assigned workers can update status, add notes, and move complaints to resolution.',
  },
];

const pageStructure = [
  { name: 'Home Page', scope: 'Project intro, login/register, submit CTA' },
  { name: 'User Dashboard', scope: 'Submit complaint, track status, history' },
  { name: 'Submit Complaint', scope: 'Title, description, image, location' },
  { name: 'Admin Dashboard', scope: 'Metrics, complaint queue, assignment' },
  { name: 'Worker Dashboard', scope: 'Assigned tasks and progress updates' },
  { name: 'Complaint Tracking', scope: 'Submitted -> Review -> Worker -> Resolved' },
];

const Home = () => {
  return (
    <div className="min-h-screen px-4 py-8 md:px-8 md:py-10 relative z-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="shell-frame overflow-hidden">
          <div className="grid gap-8 px-6 py-8 md:grid-cols-[1.02fr_0.98fr] md:px-10 md:py-12 blue-panel">
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100">Government-grade complaint workflow</p>
              <h1 className="max-w-xl text-4xl font-extrabold leading-tight text-white md:text-5xl">
                National AI Complaint Command Dashboard
              </h1>
              <p className="max-w-xl text-sm leading-7 text-blue-50 md:text-base">
                A civic operations platform for citizen grievance intake, AI triage, administrative review, worker dispatch,
                and end-to-end service tracking in one government-style control surface.
              </p>

              <div className="grid max-w-xl gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Citizen tickets</p>
                  <p className="mt-1 text-2xl font-extrabold text-white">24x7</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">AI triage</p>
                  <p className="mt-1 text-2xl font-extrabold text-white">Live</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-[0.16em] text-blue-100">Field response</p>
                  <p className="mt-1 text-2xl font-extrabold text-white">Tracked</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link to="/signup" className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[#123b83] transition hover:bg-blue-50">
                  Create Account
                </Link>
                <Link to="/login" className="rounded-full border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Sign In
                </Link>
              </div>
            </div>

            <div className="gov-layout-preview p-5 backdrop-blur-sm">
              <div className="gov-map-grid absolute inset-0 opacity-30" />
              <div className="relative h-full rounded-[22px] border border-white/10 bg-white/8 p-4">
                <div className="flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-white">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.18em] text-blue-100">Command preview</p>
                    <p className="text-sm font-bold">Administrative operations deck</p>
                  </div>
                  <div className="rounded-full border border-white/20 px-3 py-1 text-[11px] font-semibold">AI assisted</div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-3 rounded-[20px] bg-[#edf3ff] p-4 text-slate-800">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Open cases</p>
                        <p className="mt-1 text-xl font-extrabold">1,284</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Resolved</p>
                        <p className="mt-1 text-xl font-extrabold">72%</p>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Priority</p>
                        <p className="mt-1 text-xl font-extrabold">High</p>
                      </div>
                    </div>
                    <div className="h-28 rounded-2xl bg-gradient-to-r from-[#dbe8ff] via-white to-[#ecf3ff]" />
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Frontend</p>
                      <p className="mt-2 text-lg font-bold">React control desk</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Data Mode</p>
                      <p className="mt-2 text-lg font-bold">Local browser storage</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 text-slate-800 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI model</p>
                      <p className="mt-2 text-lg font-bold">Python triage engine</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {featureCards.map((card) => (
            <article key={card.title} className="gov-card rounded-2xl p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Core Feature</p>
              <h2 className="mt-2 text-xl font-bold text-slate-900">{card.title}</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{card.text}</p>
            </article>
          ))}
        </section>

        <section className="gov-card rounded-2xl p-6">
          <div className="grid gap-6 md:grid-cols-[0.95fr_1.05fr] md:items-start">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Workflow</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900">Complaint lifecycle</h2>
            </div>
            <div className="space-y-3">
              {workflow.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1d4fa3] text-sm font-bold text-white">
                    {index + 1}
                  </span>
                  <p className="text-sm leading-7 text-slate-700">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gov-card rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Complete workflow diagram</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Citizen -> AI -> Admin -> Worker -> Resolution</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {['Complaint Submitted', 'AI Category + Priority', 'Admin Review', 'Worker Assignment', 'Resolved + User Update'].map(
              (item, index) => (
                <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Step {index + 1}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-800">{item}</p>
                </div>
              )
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Example AI output</p>
            <p className="mt-1 text-sm text-blue-900">
              Complaint: "Big pothole on the road" -> Category: Road Department -> Priority: High
            </p>
          </div>
        </section>

        <section className="gov-card rounded-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Website pages structure</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">UI modules in the project</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pageStructure.map((item) => (
              <article key={item.name} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <h3 className="text-base font-bold text-slate-800">{item.name}</h3>
                <p className="mt-1 text-sm text-slate-600">{item.scope}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Home;