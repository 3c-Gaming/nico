import { notFound } from 'next/navigation'
import { getResultado } from '@/lib/api-store'
import { ApresentacaoResultado } from '@/components/resultados-junho/ApresentacaoResultado'

export default async function ApresentarResultadoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const resultado = await getResultado(id)
  if (!resultado) notFound()

  return (
    <div className="h-full w-full">
      <ApresentacaoResultado titulo={resultado.titulo} dados={resultado.dados} topicos={resultado.topicos} />
    </div>
  )
}
