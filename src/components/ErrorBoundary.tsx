import * as React from 'react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary capturó un error:', error, info)
  }

  reset = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 py-12 text-center">
          <div className="max-w-xl rounded-3xl border border-border bg-card p-10 shadow-lg">
            <h1 className="text-2xl font-bold text-foreground">Algo salió mal</h1>
            <p className="mt-4 text-sm text-muted-foreground">
              Ocurrió un error inesperado. Por favor recarga la página o intenta nuevamente más tarde.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button onClick={this.reset}>Recargar</Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
