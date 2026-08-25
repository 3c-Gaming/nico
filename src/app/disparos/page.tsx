'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { ListaDisparos } from '@/components/disparos/ListaDisparos'
import { Button } from '@/components/ui/Button'
import { Plus, MessageSquare } from 'lucide-react'
import Link from 'next/link'

export default function DisparosPage() {
  return (
    <>
      <PageHeader
        titulo="Disparos"
        descricao="Todos os disparos cadastrados"
        acoes={
          <div className="flex items-center gap-2">
            <Link href="/disparos/sms-rapido">
              <Button size="sm" variant="secondary" icon={<MessageSquare size={16} />}>
                Disparo SMS
              </Button>
            </Link>
            <Link href="/disparos/novo">
              <Button size="sm" icon={<Plus size={16} />}>
                Novo Disparo
              </Button>
            </Link>
          </div>
        }
      />
      <ListaDisparos />
    </>
  )
}
