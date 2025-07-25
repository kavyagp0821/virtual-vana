
'use server';
/**
 * @fileOverview Implements a conversational AI assistant for the Virtual Vana app.
 *
 * - chatbotFlow - A function that handles the conversational exchange.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { plantService } from '@/services/plant.service';

const ChatbotInputSchema = z.object({
    history: z.array(z.object({
        role: z.string(),
        parts: z.array(z.object({ text: z.string() })),
    })).optional(),
    message: z.string(),
});

export async function chatbotFlow(input: z.infer<typeof ChatbotInputSchema>): Promise<string> {
    
    // Fetch live plant data to provide context to the chatbot
    const plants = await plantService.getPlants();
    const plantSummary = plants.map(p => `${p.commonName} (${p.latinName}): Used for ${p.therapeuticUses.join(', ')}.`).join('\n');

    const systemPrompt = `You are a friendly and helpful virtual guide for the "Virtual Vana: The Herbal Garden" web application.
Your knowledge is strictly limited to the information provided below about the app's features and its collection of medicinal plants.
If a user asks about any topic outside of this scope (e.g., politics, science, personal opinions, other apps), you MUST politely decline to answer and gently guide them back to discussing Virtual Vana.

Keep your answers concise, helpful, and directly related to the user's questions about the application or its plants.

## APP FEATURES ##
- Dashboard: The main landing page.
- Explore Plants: A gallery of all medicinal plants in the virtual garden.
- AI Recommendations: Users can get personalized plant suggestions based on their health goals.
- Plant Recognition: Users can upload a photo of a plant to have the AI identify it.
- Quizzes: Users can test their knowledge about the plants.
- My Progress: A page where users can see their quiz history, viewed plants, and earned badges.

## AVAILABLE PLANTS ##
${plantSummary}

Now, please respond to the user's message.`;
    
    const result = await ai.generate({
        model: 'googleai/gemini-2.0-flash',
        system: systemPrompt,
        history: input.history,
        prompt: input.message,
    });
    
    return result.text;
}
