import { notFound } from 'next/navigation'
import { getResultadoPorToken } from '@/lib/api-store'
import { ApresentacaoResultado } from '@/components/resultados-junho/ApresentacaoResultado'

export default async function ResultadoPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const resultado = await getResultadoPorToken(token)
  if (!resultado) notFound()

  return (
    <div className="h-full w-full">
      <ApresentacaoResultado titulo={resultado.titulo} dados={resultado.dados} topicos={resultado.topicos} />
    </div>
  )
}
