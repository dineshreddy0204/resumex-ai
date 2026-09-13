import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: React.ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ResumeX ErrorBoundary]', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex items-center justify-center p-8">
          <div className="max-w-md w-full p-6 rounded-2xl bg-white border border-[#EAE8E1] shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#171713]">
                {this.props.fallbackTitle || 'Component Error Encountered'}
              </h3>
              <p className="text-xs text-[#6E6E63] leading-relaxed">
                {this.props.fallbackMessage ||
                  'An unexpected rendering issue occurred. Your progress and resume data have been preserved in your session.'}
              </p>
            </div>
            {this.state.error?.message && (
              <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#EAE8E1] text-[11px] font-mono text-[#6E6E63] text-left truncate">
                {this.state.error.message}
              </div>
            )}
            <button
              onClick={this.handleReset}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#4F5D2F] hover:bg-[#3D4824] text-white text-xs font-semibold shadow-xs transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
