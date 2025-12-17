import AuthStatus from "./ui/AuthStatus";
import HomeFeed from "./ui/HomeFeed";

export default function Home() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-center gap-4">
        <h1 className="text-2xl font-semibold">📚 SourceSprints Reads</h1>
        <div className="flex items-center gap-4">
          <a href="/inbox" className="text-sm text-gray-600 underline">Inbox</a>
		  <a href="/up-next" className="text-sm text-gray-600 underline">Up Next</a>
          <a href="/admin" className="text-sm text-gray-600 underline">Admin</a>
          <a href="/login" className="text-sm text-gray-600 underline">Login</a>
          <AuthStatus />
        </div>
      </header>

      <HomeFeed />
    </main>
  );
}
