const urls = [
  'http://localhost:3000/api/users/with-permissions',
  'http://localhost:3000/api/audit-logs?limit=1000'
]

for (const url of urls) {
  try {
    const res = await fetch(url)
    const text = await res.text()
    console.log('URL:', url)
    console.log('STATUS:', res.status)
    console.log('BODY:', text)
    console.log('---')
  } catch (err) {
    console.error('FETCH ERROR:', err)
  }
}
