import { login, signup } from '../auth/actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error: string }
}) {
  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl shadow-2xl overflow-hidden relative">
        {/* Decorative Top Line */}
        <div className="h-1 w-full bg-gradient-to-r from-[#135bec] to-purple-600"></div>
        
        <div className="p-8">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#135bec] mx-auto flex items-center justify-center font-bold text-white text-xl mb-4 shadow-lg shadow-blue-500/20">
              K
            </div>
            <h1 className="text-2xl font-bold text-white">Welcome to Kanvas</h1>
            <p className="text-gray-400 mt-2 text-sm">Sign in to collaborate with your team</p>
          </div>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full bg-[#121212] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] transition-all"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full bg-[#121212] border border-[#333] rounded-lg px-4 py-3 text-white focus:outline-none focus:border-[#135bec] focus:ring-1 focus:ring-[#135bec] transition-all"
                placeholder="••••••••"
              />
            </div>

            {searchParams?.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/50 rounded-lg">
                 <p className="text-red-400 text-sm text-center">{searchParams.error}</p>
              </div>
            )}

            <div className="pt-2 grid grid-cols-2 gap-3 pb-8 border-b border-[#2A2A2A] mb-8">
              <button
                formAction={login}
                className="w-full bg-[#135bec] hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                Log In
              </button>
              <button
                formAction={signup}
                className="w-full bg-[#2A2A2A] hover:bg-[#333] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center"
              >
                Sign Up
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
