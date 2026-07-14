import { Context } from 'grammy'
import { menuPrincipal } from '../keyboards'

export async function handleStart(ctx: Context) {
  await ctx.reply(
    '🐓 *Bem-vindo ao Nico Bot!*\nGerencie suas páginas de forma rápida.',
    { reply_markup: menuPrincipal(), parse_mode: 'Markdown' }
  )
}

export async function handleMenu(ctx: Context) {
  await ctx.editMessageText(
    '🐓 *Nico Bot*\nO que deseja fazer?',
    { reply_markup: menuPrincipal(), parse_mode: 'Markdown' }
  )
  await ctx.answerCallbackQuery()
}
