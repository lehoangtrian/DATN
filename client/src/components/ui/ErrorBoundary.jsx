import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
          <div className="text-6xl mb-4">😵</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Đã có lỗi xảy ra</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md">
            Trang này gặp sự cố không mong muốn. Vui lòng thử lại hoặc quay về trang chủ.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="btn-outline px-5 py-2.5 rounded-xl text-sm"
            >
              Thử lại
            </button>
            <Link to="/" className="btn-primary px-5 py-2.5 rounded-xl text-sm">
              Về trang chủ
            </Link>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-6 text-left max-w-lg">
              <summary className="text-xs text-gray-400 cursor-pointer">Chi tiết lỗi (dev only)</summary>
              <pre className="mt-2 text-xs text-red-500 bg-red-50 p-3 rounded-lg overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
