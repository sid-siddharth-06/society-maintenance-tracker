export default function Loading() {
  return (
    <div className="p-8 max-w-6xl mx-auto flex justify-center items-center min-h-[50vh]">
      <div className="flex flex-col items-center space-y-4">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
        <p className="text-gray-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}
