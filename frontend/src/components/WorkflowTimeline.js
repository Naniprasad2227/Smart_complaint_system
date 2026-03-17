import React from 'react';

const STEP_ORDER = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Closed'];

const getCurrentStepIndex = (status) => {
  const index = STEP_ORDER.indexOf(status);
  return index >= 0 ? index : 0;
};

const WorkflowTimeline = ({ status, compact = false }) => {
  const currentStepIndex = getCurrentStepIndex(status);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white/80 ${compact ? 'p-2.5' : 'p-3.5'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">Workflow</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {STEP_ORDER.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isActive = index === currentStepIndex;

          return (
            <React.Fragment key={step}>
              <div
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                  isActive
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : isCompleted
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              >
                {step}
              </div>
              {index < STEP_ORDER.length - 1 ? (
                <span
                  className={`h-[2px] w-5 rounded-full ${
                    index < currentStepIndex ? 'bg-emerald-300' : 'bg-slate-200'
                  }`}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowTimeline;
