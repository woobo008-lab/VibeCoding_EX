import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { mkdir, open, readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const jsonDirectory = fileURLToPath(new URL('./json/', import.meta.url))
const categories = new Set(['맛집', '카페', '주차장', '공원', '기타'])
const maxRequestBytes = 5 * 1024 * 1024

function isValidPin(pin) {
  return (
    pin &&
    (typeof pin.id === 'string' || typeof pin.id === 'number') &&
    Array.isArray(pin.position) &&
    pin.position.length === 2 &&
    pin.position.every((coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate)) &&
    pin.position[0] >= -90 &&
    pin.position[0] <= 90 &&
    pin.position[1] >= -180 &&
    pin.position[1] <= 180 &&
    (pin.name === undefined || typeof pin.name === 'string') &&
    (pin.memo === undefined || typeof pin.memo === 'string') &&
    (pin.category === undefined ||
      (typeof pin.category === 'string' && categories.has(pin.category)))
  )
}

function sendJson(response, statusCode, data) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(data))
}

async function readRequestJson(request) {
  const chunks = []
  let bytesRead = 0

  for await (const chunk of request) {
    bytesRead += chunk.length
    if (bytesRead > maxRequestBytes) {
      const error = new Error('요청 파일이 너무 큽니다.')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    const error = new Error('올바른 JSON이 아닙니다.')
    error.statusCode = 400
    throw error
  }
}

async function createPinFilesMiddleware(request, response, next) {
  const remoteAddress = request.socket.remoteAddress
  if (
    remoteAddress !== '127.0.0.1' &&
    remoteAddress !== '::1' &&
    remoteAddress !== '::ffff:127.0.0.1'
  ) {
    sendJson(response, 403, { error: '이 기능은 이 컴퓨터에서만 사용할 수 있습니다.' })
    return
  }

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST')
    sendJson(response, 405, { error: '지원하지 않는 요청 방식입니다.' })
    return
  }

  try {
    await mkdir(jsonDirectory, { recursive: true })
    const requestPath = new URL(request.url, 'http://localhost').pathname

    if (request.method === 'GET' && requestPath === '/') {
      const entries = await readdir(jsonDirectory, { withFileTypes: true })
      const files = entries
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => entry.name)
        .sort((left, right) => right.localeCompare(left))
      sendJson(response, 200, { files })
      return
    }

    if (request.method === 'POST' && requestPath === '/') {
      const data = await readRequestJson(request)
      if (
        !data ||
        data.version !== 1 ||
        !Array.isArray(data.pins) ||
        !data.pins.every(isValidPin)
      ) {
        sendJson(response, 400, { error: '내보낼 핀 데이터의 형식이 올바르지 않습니다.' })
        return
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      let filename = `inter-map-pins-${timestamp}.json`
      let fileHandle
      let suffix = 1
      while (!fileHandle) {
        try {
          fileHandle = await open(join(jsonDirectory, filename), 'wx')
        } catch (error) {
          if (error.code !== 'EEXIST') throw error
          filename = `inter-map-pins-${timestamp}-${suffix++}.json`
        }
      }

      try {
        await fileHandle.writeFile(`${JSON.stringify(data, null, 2)}\n`, 'utf8')
      } finally {
        await fileHandle.close()
      }
      sendJson(response, 201, { filename })
      return
    }

    if (request.method === 'GET' && requestPath.startsWith('/')) {
      let filename
      try {
        filename = decodeURIComponent(requestPath.slice(1))
      } catch {
        sendJson(response, 400, { error: '파일 이름이 올바르지 않습니다.' })
        return
      }

      if (!filename || basename(filename) !== filename || !filename.endsWith('.json')) {
        sendJson(response, 400, { error: 'JSON 파일 이름이 올바르지 않습니다.' })
        return
      }

      const content = await readFile(join(jsonDirectory, filename), 'utf8')
      sendJson(response, 200, JSON.parse(content))
      return
    }

    sendJson(response, 404, { error: '요청한 JSON 파일을 찾을 수 없습니다.' })
  } catch (error) {
    if (error.code === 'ENOENT') {
      sendJson(response, 404, { error: '요청한 JSON 파일을 찾을 수 없습니다.' })
      return
    }
    if (error.statusCode) {
      sendJson(response, error.statusCode, { error: error.message })
      return
    }
    next(error)
  }
}

function pinFileApi() {
  return {
    name: 'inter-map-pin-file-api',
    configureServer(server) {
      server.middlewares.use('/api/pin-files', createPinFilesMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/pin-files', createPinFilesMiddleware)
    },
  }
}

export default defineConfig({
  plugins: [react(), pinFileApi()],
})
