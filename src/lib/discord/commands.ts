import { SlashCommandBuilder } from 'discord.js'

export const commands = [
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Lista o status de todos os bots WhatsApp'),

  new SlashCommandBuilder()
    .setName('fluxos')
    .setDescription('Lista os fluxos/funis de um bot específico')
    .addStringOption(option =>
      option
        .setName('bot')
        .setDescription('ID ou nome do bot')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('testar')
    .setDescription('Executa um teste manual em um bot')
    .addStringOption(option =>
      option
        .setName('bot')
        .setDescription('ID ou nome do bot')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('relatorio')
    .setDescription('Gera um relatório completo de todos os bots'),

  new SlashCommandBuilder()
    .setName('ajuda')
    .setDescription('Lista todos os comandos disponíveis'),
]
