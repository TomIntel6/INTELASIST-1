import http from 'http'

const postData = JSON.stringify({
  email: 'ycordoba@intelasist.com',
  password: 'Temporal123!'
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

const req = http.request(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    console.log('Status:', res.statusCode)
    console.log('Headers:', res.headers)
    console.log('Response:', data)
    process.exit(0)
  })
})

req.on('error', (error) => {
  console.error('Error:', error.message)
  process.exit(1)
})

req.write(postData)
req.end()
