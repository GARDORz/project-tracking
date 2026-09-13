interface PlaceholderProps {
  title: string
}

function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 bg-white text-center dark:border-gray-700 dark:bg-gray-800">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">{title}</h1>
      <p className="text-sm text-gray-400 dark:text-gray-500">หน้านี้อยู่ระหว่างการพัฒนา</p>
    </div>
  )
}

export default Placeholder
