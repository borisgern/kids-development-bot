export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="max-w-2xl text-center">
        <h1 className="text-4xl font-bold mb-4">Kids Development Bot</h1>
        <p className="text-lg text-gray-600">
          Телеграм-бот для ежедневных задач развития детей
        </p>
        <p className="mt-4 text-sm text-gray-500">
          Бот работает в фоновом режиме и отправляет задачи в Telegram
        </p>
      </div>
    </main>
  )
}