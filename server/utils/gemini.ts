export async function generateProductDescription(name: string, photoUrl: string, category?: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')
  // Keep the model configurable so it can be changed without a code deploy.
  // Gemini 2.0 Flash was shut down; 2.5 Flash-Lite is the stable multimodal
  // model used by the product-description feature.
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite'

  const imageResponse = await fetch(photoUrl)
  if (!imageResponse.ok) throw new Error(`Failed to fetch photo: ${imageResponse.status}`)
  const mimeType = imageResponse.headers.get('content-type') ?? 'image/jpeg'
  const imageBase64 = Buffer.from(await imageResponse.arrayBuffer()).toString('base64')

  const prompt = `Write a short, appealing product description in Indonesian for an online jastip (personal shopper) listing.\nProduct name: ${name}${category ? `\nCategory: ${category}` : ''}\nBase the description on the product photo. Keep it under 60 words. Return only the description text, no formatting.`

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
    }),
  })
  if (!response.ok) {
    const details = (await response.text()).trim()
    throw new Error(`Gemini request failed: ${response.status}${details ? ` ${details}` : ''}`)
  }
  const result = await response.json()
  const description = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
  if (!description) throw new Error('Gemini returned no description')
  return description
}
