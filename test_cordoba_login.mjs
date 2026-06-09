import http from 'http'

const postData = JSON.stringify({
  email: 'ycordoba@intelasist.com',
  password: 'cordoba'
})

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}

console.log('Intentando login...')
console.log('Email: ycordoba@intelasist.com')
console.log('Password: cordoba\n')

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('Status:', res.statusCode)
    
    try {
      const json = JSON.parse(data)
      if (res.statusCode === 200 && json.user) {
        console.log('\n✅ LOGIN EXITOSO!')
        console.log('Usuario:', json.user.nombre)
        console.log('Email:', json.user.correo)
        console.log('Rol:', json.user.rol)
        console.log('Must Change Password:', json.must_change_password)
      } else {
        console.log('\n❌ Error al loguear:')
        console.log('Response:', JSON.stringify(json, null, 2))
      }
    } catch (e) {
      console.log('Response:', data)
    }
    
    process.exit(res.statusCode === 200 ? 0 : 1)
  })
})

req.on('error', (error) => {
  console.error('❌ Error de conexión:', error.message)
  process.exit(1)
})

req.write(postData)
req.end()
