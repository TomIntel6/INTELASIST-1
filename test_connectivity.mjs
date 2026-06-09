import http from 'http'

console.log('🔍 Probando conectividad con el backend...\n')

const testConfigs = [
  { host: 'localhost', port: 3000, name: 'localhost:3000' },
  { host: '127.0.0.1', port: 3000, name: '127.0.0.1:3000' },
  { host: '10.10.1.50', port: 3000, name: '10.10.1.50:3000' },
]

async function testConnection(host, port, name) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: host, port, path: '/auth/login', method: 'POST', timeout: 3000 },
      (res) => {
        req.destroy()
        resolve({ name, status: 'CONECTADO ✓', statusCode: res.statusCode })
      }
    )

    req.on('error', (err) => {
      resolve({ name, status: `ERROR: ${err.code || err.message}`, statusCode: null })
    })

    req.on('timeout', () => {
      req.destroy()
      resolve({ name, status: 'TIMEOUT (sin respuesta)', statusCode: null })
    })

    req.write('{}')
    req.end()
  })
}

async function runTests() {
  console.log('Probando diferentes configuraciones:\n')
  
  for (const config of testConfigs) {
    const result = await testConnection(config.host, config.port, config.name)
    console.log(`${result.name}: ${result.status}`)
  }

  console.log('\n✓ Si ves "CONECTADO" en 10.10.1.50:3000, el backend está accesible.')
  console.log('✗ Si no, el firewall podría estar bloqueando la conexión.')
}

runTests().catch(console.error)
