'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { ListaDisparos } from '@/components/disparos/ListaDisparos'
import { Button } from '@/components/ui/Button'
import { Plus } from 'lucide-react'
import Link from 'next/link'

export default function DisparosPage() {
  return (
    <>
      <PageHeader
        titulo="Disparos"
        descricao="Todos os disparos cadastrados"
        acoes={
          <Link href="/disparos/novo">
            <Button size="sm" icon={<Plus size={16} />}>
              Novo Disparo
            </Button>
          </Link>
        }
      />
      <ListaDisparos />
    </>
  )
}
