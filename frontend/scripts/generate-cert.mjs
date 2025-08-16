import fs from 'fs'
import os from 'os'
import path from 'path'

async function main() {
  const keyPath = path.resolve('./localhost-key.pem')
  const certPath = path.resolve('./localhost-cert.pem')
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('HTTPS certs already present')
    return
  }
  let selfsigned
  try {
    selfsigned = (await import('selfsigned')).default
  } catch (e) {
    console.error('Missing dev dependency: selfsigned. Installing is required to auto-generate certs.')
    process.exit(0)
  }
  const attrs = [{ name: 'commonName', value: 'localhost' }]
  const ifaces = os.networkInterfaces()
  const sanHosts = ['localhost', '127.0.0.1']
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) sanHosts.push(ni.address)
    }
  }
  const pems = selfsigned.generate(attrs, {
    days: 3650,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [{ name: 'basicConstraints', cA: true }],
    clientCertificate: true,
    clientCertificateCN: 'localhost',
    altNames: sanHosts.map((h) => ({ type: isNaN(Number(h.split('.').join(''))) ? 2 : 7, value: h })),
  })
  fs.writeFileSync(keyPath, pems.private)
  fs.writeFileSync(certPath, pems.cert)
  console.log('Generated self-signed HTTPS certs for Vite dev server')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
