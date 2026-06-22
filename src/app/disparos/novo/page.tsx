'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import { FormNovoDisparo } from '@/components/disparos/FormNovoDisparo'

export default function NovoDisparoPage() {
  return (
    <>
      <PageHeader titulo="Novo Disparo" descricao="Preencha os dados para criar um novo disparo ou esteira" />
      <FormNovoDisparo />
    </>
  )
}
