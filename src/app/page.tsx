import ClientBookshelf from "./ui/ClientBookshelf";

export default function Home() {
  return (
    <main className="p-6 max-w-6xl mx-auto">
      <header className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">📚 Bookshelf</h1>
        <a href="/login" className="text-sm text-gray-600">Login</a>
      </header>
      <ClientBookshelf />
    </main>
  );
}
