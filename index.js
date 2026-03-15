import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: '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',
  baseURL: 'https://integrate.api.nvidia.com/v1',
})
 
async function main() {
  const completion = await openai.chat.completions.create({
    model: "openai/gpt-oss-120b",
    messages: [{"role":"user","content":"what is python?"}],
    temperature: 1,
    top_p: 1,
    max_tokens: 4096,
    stream: true
  })
   
  for await (const chunk of completion) {
    const reasoning = chunk.choices[0]?.delta?.reasoning_content;
    if (reasoning) process.stdout.write(reasoning);
    process.stdout.write(chunk.choices[0]?.delta?.content || '')
  }
  
}

main();



// client = OpenAI(
//   base_url = "https://integrate.api.nvidia.com/v1",
//   api_key = "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"
// )

// completion = client.chat.completions.create(
//   model="minimaxai/minimax-m2.5",
//   messages=[{"role":"user","content":""}],
//   temperature=1,
//   top_p=0.95,
//   max_tokens=8192,
//   stream=True
// )

// for chunk in completion:
//   if not getattr(chunk, "choices", None):
//     continue
//   if chunk.choices[0].delta.content is not None:
//     print(chunk.choices[0].delta.content, end="")
  

