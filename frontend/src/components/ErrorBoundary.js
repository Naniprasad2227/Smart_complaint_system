import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary captured runtime error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">System Notice</p>
            <h2 className="mt-2 text-2xl font-extrabold">Something went wrong</h2>
            <p className="mt-2 text-sm leading-6">
              The application hit an unexpected runtime issue. You can reload and continue your workflow.
            </p>
            <p className="mt-3 rounded-lg bg-white/80 px-3 py-2 text-xs break-all">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
