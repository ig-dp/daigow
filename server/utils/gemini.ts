export async function generateProductDescription(name: string, photoUrl: string, category?: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const imageResponse = await fetch(photoUrl)
  if (!imageResponse.ok) throw new Error(`Failed to fetch photo: ${imageResponse.status}`)
  const mimeType = imageResponse.headers.get('content-type') ?? 'image/jpeg'
  const imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64')

  const prompt = `Write a short, appealing product description in Indonesian for an online jastip (personal shopper) listing.\nProduct name: ${name}${category ? `\nCategory: ${category}` : ''}\nBase the description on the product photo. Keep it under 60 words. Return only the description text, no formatting.`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    }),
  })
  if (!response.ok) throw new Error(`Gemini request failed: ${response.status}`)
  const result = await response.json()
  const description = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!description) throw new Error('Gemini returned no description')
  return description
}
