import { login, signup } from '../auth/actions'

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="min-h-screen flex font-sans" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Left Panel — Illustrated */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1a1040 0%, #2d1b69 40%, #4c2a9e 70%, #6d3fc8 100%)' }}>
        {/* Geometric pattern overlay */}
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, #a78bfa 0%, transparent 50%),
              radial-gradient(circle at 75% 75%, #818cf8 0%, transparent 50%)`
          }} />
        {/* Floating abstract shapes */}
        <div className="absolute top-16 left-16 w-32 h-32 rounded-2xl border border-purple-400/30 rotate-12" />
        <div className="absolute top-32 left-32 w-20 h-20 rounded-xl bg-purple-500/20 -rotate-6" />
        <div className="absolute bottom-40 right-16 w-48 h-48 rounded-3xl border border-indigo-400/20 rotate-6" />
        <div className="absolute bottom-20 right-32 w-16 h-16 rounded-xl bg-indigo-400/30 rotate-12" />
        {/* Mini canvas preview */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-56 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl p-4">
          <div className="flex gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-400/70" />
            <div className="w-2 h-2 rounded-full bg-yellow-400/70" />
            <div className="w-2 h-2 rounded-full bg-green-400/70" />
          </div>
          <div className="grid grid-cols-3 gap-2 h-32">
            {['#FFF9C4','#B2EBF2','#F8BBD0','#C8E6C9','#FFE0B2','#E1BEE7'].map((c, i) => (
              <div key={i} className="rounded-lg shadow-sm" style={{ background: c, opacity: 0.9 }} />
            ))}
          </div>
        </div>
        {/* Logo + tagline */}
        <div className="absolute bottom-12 left-12 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-bold text-xl">K</div>
            <span className="text-2xl font-bold tracking-tight">Kanvas</span>
          </div>
          <p className="text-purple-200 text-sm max-w-xs leading-relaxed">
            Real-time collaborative workspace for teams that move fast.
          </p>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white">K</div>
            <span className="text-xl font-semibold text-gray-900">Kanvas</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-8">Sign in to your workspace</p>

          {searchParams?.error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
              {searchParams.error}
            </div>
          )}

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="email">Email address</label>
              <input
                id="email" name="email" type="email" required autoComplete="email"
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700" htmlFor="password">Password</label>
                <a href="#" className="text-xs text-indigo-600 hover:text-indigo-700">Forgot password?</a>
              </div>
              <input
                id="password" name="password" type="password" required autoComplete="current-password"
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400
                  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow"
              />
            </div>

            <button
              formAction={login}
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
            >
              Sign in
            </button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
              <div className="relative flex justify-center"><span className="px-3 text-xs text-gray-400 bg-white">or</span></div>
            </div>

            <button
              type="button"
              className="w-full py-2.5 px-4 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2.5"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <button formAction={signup} form="signup-form" className="text-indigo-600 font-medium hover:text-indigo-700">Create one free</button>
          </p>
          {/* Hidden signup form */}
          <form id="signup-form" className="hidden">
            <input name="email" /><input name="password" />
          </form>
        </div>
      </div>
    </div>
  )
}
