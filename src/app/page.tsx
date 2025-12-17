import ClientBookshelf from "./ui/ClientBookshelf";
import AuthStatus from "./ui/AuthStatus";

export default function Home() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-semibold">📚 Bookshelf</h1>
        <div className="flex items-center gap-4">
          <AuthStatus />
          <a href="/login" className="text-sm text-gray-600 underline">Login</a>
        </div>
      </header>

      <ClientBookshelf />
    </main>
  );
}
