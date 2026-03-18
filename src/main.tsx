import {StrictMode, Component, ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-10 text-center">
          <h1 className="text-2xl font-bold mb-4">Erreur de l'application</h1>
          <p className="text-slate-400 mb-6">{this.state.error?.message || "Une erreur inconnue est survenue."}</p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-indigo-600 px-6 py-2 rounded-xl font-bold"
          >
            Recharger la page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

console.log("main.tsx: Starting application...");
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
