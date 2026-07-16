export const DISCORD_COMMANDS = [
  {
    name: 'status',
    description: 'Lista o status de todos os bots WhatsApp',
  },
  {
    name: 'fluxos',
    description: 'Lista os fluxos/funis de um bot específico',
    options: [
      {
        type: 3,
        name: 'bot',
        description: 'ID ou nome do bot',
        required: true,
      },
    ],
  },
  {
    name: 'testar',
    description: 'Executa um teste manual em um bot',
    options: [
      {
        type: 3,
        name: 'bot',
        description: 'ID ou nome do bot',
        required: true,
      },
    ],
  },
  {
    name: 'relatorio',
    description: 'Gera um relatório completo de todos os bots',
  },
  {
    name: 'ajuda',
    description: 'Lista todos os comandos disponíveis',
  },
  {
    name: 'testartodos',
    description: 'Testa todos os bots ativos de uma vez',
  },
]
