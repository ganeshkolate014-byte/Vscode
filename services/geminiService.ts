import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateCodeHelp = async (prompt: string, currentContext: string): Promise<string> => {
  try {
    const ai = getClient();
    // Using Flash for speed on mobile
    const modelId = "gemini-3-flash-preview"; 
    
    const fullPrompt = `
      You are an expert web developer assistant for a mobile code editor.
      User request: ${prompt}
      
      Current Code Context:
      ${currentContext}
      
      Provide a concise, correct code snippet or short explanation. 
      If providing code, wrap it in Markdown code blocks (e.g., \`\`\`html ... \`\`\`).
      Keep answers short and mobile-friendly.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: fullPrompt,
    });

    return response.text || "// No response generated";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "// Error connecting to AI service.";
  }
};

export const completeCode = async (codeBeforeCursor: string, language: string): Promise<string> => {
  try {
    const ai = getClient();
    const modelId = "gemini-3-flash-preview";

    const prompt = `
      You are an autocomplete engine. 
      Complete the ${language} code at the end of this string.
      Do not explain. Do not wrap in markdown. Just return the missing code.
      
      Code:
      ${codeBeforeCursor}
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        maxOutputTokens: 50, // Keep it very short for autocomplete
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 } // Disable thinking for low latency autocomplete
      }
    });

    // Strip markdown if present, though we asked for direct completion
    let text = response.text || "";
    text = text.replace(/```[a-z]*\n/g, '').replace(/```/g, '');
    return text;
  } catch (error) {
    console.error(error);
    return "";
  }
};