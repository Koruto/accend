export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-3xl font-semibold">Accend</h1>
        <div className="flex flex-col gap-3">
          <a href="/login" className="w-full rounded bg-black text-white py-2">
            Login
          </a>
        </div>
      </div>
    </main>
  );
} 