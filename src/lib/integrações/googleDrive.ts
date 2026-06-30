import { JWT } from 'google-auth-library'
import type { DriveFile, DriveFolder } from '@/types'

const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID!
const SCOPE = 'https://www.googleapis.com/auth/drive'

let cachedToken: string | null = null
let cachedExpiry = 0

function getAuth(): JWT {
  return new JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
    scopes: [SCOPE],
  })
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedExpiry) return cachedToken
  const auth = getAuth()
  const tokens = await auth.authorize()
  const token = tokens.access_token
  if (!token) throw new Error('Failed to get Google Drive access token')
  cachedToken = token
  cachedExpiry = Date.now() + (tokens.expiry_date ?? 3600 * 1000) - 60000
  return token
}

async function buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const token = await getAccessToken()
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, options?: RequestInit): Promise<any> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }
  if (options?.headers) {
    const extra = options.headers as Record<string, string>
    for (const k of Object.keys(extra)) headers[k] = extra[k]
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, {
    ...options,
    headers,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Drive API error ${res.status}: ${text}`)
  }
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearFile(item: any): DriveFile {
  return {
    id: item.id,
    nome: item.name,
    mimeType: item.mimeType,
    tamanho: Number(item.size ?? 0),
    criadoEm: item.createdTime,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapearFolder(item: any): DriveFolder {
  return { id: item.id, nome: item.name }
}

export async function listarPastas(): Promise<DriveFolder[]> {
  const q = encodeURIComponent(
    `'${ROOT_FOLDER_ID}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const json = await api(`/files?q=${q}&orderBy=name desc&pageSize=100&fields=files(id,name)`)
  return (json.files ?? []).map(mapearFolder)
}

export async function listarPastasFilhas(parentId: string): Promise<DriveFolder[]> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const json = await api(`/files?q=${q}&orderBy=name&pageSize=20&fields=files(id,name)`)
  return (json.files ?? []).map(mapearFolder)
}

export async function listarArquivos(pastaId: string): Promise<DriveFile[]> {
  const q = encodeURIComponent(
    `'${pastaId}' in parents and mimeType='text/csv' and trashed=false`
  )
  const json = await api(`/files?q=${q}&orderBy=name&pageSize=50&fields=files(id,name,mimeType,size,createdTime)`)
  return (json.files ?? []).map(mapearFile)
}

export async function criarPasta(nome: string, parentId: string = ROOT_FOLDER_ID): Promise<DriveFolder> {
  const json = await api('/files', {
    method: 'POST',
    body: JSON.stringify({
      name: nome,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId],
    }),
  })
  return mapearFolder(json)
}

export async function copiarArquivo(
  fileId: string,
  pastaDestinoId: string,
  novoNome?: string
): Promise<DriveFile> {
  const json = await api(`/files/${fileId}/copy`, {
    method: 'POST',
    body: JSON.stringify({
      name: novoNome,
      parents: [pastaDestinoId],
    }),
  })
  return mapearFile(json)
}

export async function copiarArquivosEntrePastas(
  pastaOrigemId: string,
  pastaDestinoId: string
): Promise<DriveFile[]> {
  const arquivos = await listarArquivos(pastaOrigemId)
  const results: DriveFile[] = []
  for (const arq of arquivos) {
    const copia = await copiarArquivo(arq.id, pastaDestinoId)
    results.push(copia)
  }
  return results
}

export async function obterPastaPorNome(
  nome: string,
  parentId: string = ROOT_FOLDER_ID
): Promise<DriveFolder | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and name='${nome}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  )
  const json = await api(`/files?q=${q}&pageSize=1&fields=files(id,name)`)
  const folders = (json.files ?? []).map(mapearFolder)
  return folders[0] ?? null
}

export async function uploadArquivo(
  nome: string,
  mimeType: string,
  body: ArrayBuffer | Blob,
  parentId: string
): Promise<DriveFile> {
  const token = await getAccessToken()
  const boundary = `-------${Date.now().toString(36)}`

  const metadata = JSON.stringify({ name: nome, parents: [parentId] })
  const encoder = new TextEncoder()
  const metadataPart = encoder.encode(
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`
  )
  const filePart = encoder.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`)
  const footer = encoder.encode(`\r\n--${boundary}--`)

  const sizes = [metadataPart.byteLength, filePart.byteLength, body instanceof Blob ? body.size : body.byteLength, footer.byteLength]
  const totalSize = sizes.reduce((a, b) => a + b, 0)
  const fullBody = new Uint8Array(totalSize)
  let offset = 0
  fullBody.set(metadataPart, offset); offset += metadataPart.byteLength
  fullBody.set(filePart, offset); offset += filePart.byteLength
  if (body instanceof Blob) {
    const buf = await body.arrayBuffer()
    fullBody.set(new Uint8Array(buf), offset); offset += buf.byteLength
  } else {
    fullBody.set(new Uint8Array(body), offset); offset += body.byteLength
  }
  fullBody.set(footer, offset)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await fetch(
    `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: fullBody,
      signal: AbortSignal.timeout(30_000),
    }
  ).then(async (r) => {
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      throw new Error(`Upload error: ${r.status}${text ? ` — ${text}` : ''}`)
    }
    return r.json()
  })

  return mapearFile(json)
}

export async function downloadArquivo(fileId: string): Promise<{ buffer: ArrayBuffer; nome: string }> {
  const headers = await buildHeaders()
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`, { headers, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Download error: ${res.status}${text ? ` — ${text}` : ''}`)
  }
  const nome =
    res.headers.get('content-disposition')?.match(/filename="?(.+?)"?$/)?.[1] ??
    fileId
  return { buffer: await res.arrayBuffer(), nome }
}

export function formatarDataDDMM(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${dia}${mes}`
}

export function parseDataDDMM(str: string): Date {
  const dia = parseInt(str.slice(0, 2), 10)
  const mes = parseInt(str.slice(2, 4), 10)
  const ano = new Date().getFullYear()
  return new Date(ano, mes - 1, dia)
}

export function subtrairDias(dataStr: string, dias: number): string {
  const data = parseDataDDMM(dataStr)
  data.setDate(data.getDate() - dias)
  return formatarDataDDMM(data)
}
