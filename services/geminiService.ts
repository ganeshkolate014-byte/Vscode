
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
      You are a super-fast code completion engine.
      Complete the following ${language} code. 
      Return ONLY the code that should follow the cursor.
      Do NOT wrap in markdown.
      Do NOT repeat the code provided.
      Do NOT add comments.
      
      Code So Far:
      ${codeBeforeCursor}
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
      config: {
        maxOutputTokens: 100, // Keep it short for autocomplete
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    let text = response.text || "";
    // Clean up if the model accidentally wrapped it
    text = text.replace(/```[a-z]*\n?/g, '').replace(/```/g, '');
    return text;
  } catch (error) {
    console.error(error);
    return "";
  }
};
