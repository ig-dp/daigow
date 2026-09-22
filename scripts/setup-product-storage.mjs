// Run once with: node scripts/setup-product-storage.mjs
// Then apply scripts/product-storage-policies.sql in the same Supabase project.
// Uses the server-side service role key from .env; never expose that key in client code.
process.loadEnvFile('.env')

const baseUrl = process.env.NUXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!baseUrl || !serviceKey) throw new Error('Supabase URL or service role key is missing from .env')

const endpoint = `${baseUrl.replace(/\/$/, '')}/storage/v1/bucket`
const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json'
}

const existing = await fetch(`${endpoint}/products`, { headers })
const existingBody = existing.ok ? null : await existing.json()
if (existing.ok) {
  console.log('products bucket already exists')
} else if (existing.status === 404 || existingBody?.code === 'NoSuchBucket') {
  const created = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      id: 'products',
      name: 'products',
      public: true,
      file_size_limit: 6 * 1024 * 1024,
      allowed_mime_types: ['image/jpeg']
    })
  })
  if (!created.ok) throw new Error(`Failed to create products bucket: HTTP ${created.status} ${await created.text()}`)
  console.log('products bucket created')
} else {
  throw new Error(`Failed to inspect products bucket: HTTP ${existing.status} ${JSON.stringify(existingBody)}`)
}
