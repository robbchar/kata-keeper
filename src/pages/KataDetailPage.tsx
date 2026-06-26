import { useParams, Link } from 'react-router-dom'

export default function KataDetailPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link to="/" className="text-sm text-indigo-600 hover:underline">← Back</Link>
      <p className="mt-4 text-slate-500">Kata detail for {id} — coming soon.</p>
    </div>
  )
}
