import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "../trpc";
import { Configuration, OpenAIApi } from "openai";
import { encode } from "gpt-3-encoder";
import { Prisma } from "@prisma/client";
import axios, { type AxiosError } from "axios";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});

const openai = new OpenAIApi(configuration);

function checkAPIKey() {
  if (!configuration.apiKey) {
    return {
      error: {
        message:
          "OpenAI API key not configured, please follow instructions in README.md",
      },
    };
  }
}

function generatePrompt(query: string) {
  // For now just passthrough result
  return query.trim() + ":";
}

function handleError(error: unknown) {
  // TODO: Improve error handling
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const axiosError = error as AxiosError<
        {
          error: {
            message: string;
            type: string;
            // param: any;
            code: string;
          };
        },
        Error
      >;
      // console.log(JSON.stringify(axiosError.response?.data, null, 2));

      const message = axiosError.response?.data.error.message;
      const requestMessage = error.message;

      return {
        error: {
          message: message ?? requestMessage,
        },
      };
    } else {
      console.error(`Error with OpenAI API request: ${error.message}`);
      return {
        error: {
          message: "An error occurred during your request.",
        },
      };
    }
  } else if (error instanceof Error) {
    // Just a stock error
    return {
      error: {
        message: "An error occurred during your request.",
      },
    };
  } else {
    // unknown
    return {
      error: {
        message: "An error occurred...",
      },
    };
  }
}

const ChatMessage = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  name: z.string().optional(),
});

export const aiRouter = createTRPCRouter({
  prompt: publicProcedure
    .input(
      z.object({
        text: z.string(),
        temperature: z.number().optional(),
        task: z.string().optional(),
        max_tokens: z.number().optional(),
      })
    )
    .output(
      z.object({
        result: z.string().optional(),
        error: z
          .object({
            message: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      checkAPIKey();

      const query = input.text || "";
      if (query.trim().length === 0) {
        return {
          error: {
            message: "Please enter a valid prompt",
          },
        };
      }
      console.log("Input", query);
      const fullPrompt = generatePrompt(query);
      let output = "";

      try {
        const completion = await openai.createCompletion({
          model: "text-davinci-003",
          prompt: fullPrompt,
          temperature: input.temperature ?? 0.6,
          max_tokens: input.max_tokens ?? 265,
        });
        const result = completion.data.choices[0]?.text;
        console.log("Result", result);
        if (result) {
          output = result;
        } else {
          return {
            error: {
              message: "Could not read result from OpenAI API",
            },
          };
        }
      } catch (error: unknown) {
        return handleError(error);
      }

      await ctx.prisma.result
        .create({
          data: {
            task: input.task ?? "",
            model: "text-davinci-003",
            temperature: input.temperature ?? 0.6,
            userPrompt: input.text,
            fullPrompt: fullPrompt,
            result: output,
            userId: ctx.session?.user.id,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.log("Prisma error:", error.message);
          }
        });

      return {
        result: output,
      };
    }),
  chat: publicProcedure
    .input(
      z.object({
        text: z.string(),
        temperature: z.number().optional(),
        task: z.string().optional(),
        max_tokens: z.number().optional(),
        top_p: z.number().optional(),
        frequency_penalty: z.number().optional(),
        presence_penalty: z.number().optional(),
        stop: z.array(z.string()).optional(),
      })
    )
    .output(
      z.object({
        result: z.string().optional(),
        error: z
          .object({
            message: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      checkAPIKey();

      const query = input.text || "";
      if (query.trim().length === 0) {
        return {
          error: {
            message: "Please enter a valid prompt",
          },
        };
      }
      console.log("Input", query);
      const fullPrompt = query.trim();
      let output = "";

      try {
        const completion = await openai.createCompletion({
          model: "text-davinci-003",
          prompt: fullPrompt,
          temperature: input.temperature ?? 0.9,
          max_tokens: input.max_tokens ?? 150,
          top_p: input.top_p ?? 1,
          frequency_penalty: input.frequency_penalty ?? 0,
          presence_penalty: input.presence_penalty ?? 0.6,
          stop: input.stop ?? [" Human:", " AI:"],
        });

        const result = completion.data.choices[0]?.text;
        console.log("Result", result);
        if (result) {
          output = result;
        } else {
          return {
            error: {
              message: "Could not read result from OpenAI API",
            },
          };
        }
      } catch (error: unknown) {
        return handleError(error);
      }

      await ctx.prisma.result
        .create({
          data: {
            task: input.task ?? "",
            model: "text-davinci-003",
            temperature: input.temperature ?? 0.6,
            userPrompt: input.text,
            fullPrompt: fullPrompt,
            result: output,
            userId: ctx.session?.user.id,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.log("Prisma error:", error.message);
          }
        });

      return {
        result: output,
      };
    }),
  newchat: publicProcedure
    .input(
      z.object({
        messages: z.array(ChatMessage),
        temperature: z.number().optional(),
        task: z.string().optional(),
        top_p: z.number().optional(),
        frequency_penalty: z.number().optional(),
        presence_penalty: z.number().optional(),
        stop: z.array(z.string()).optional(),
      })
    )
    .output(
      z.object({
        result: ChatMessage.optional(),
        error: z
          .object({
            message: z.string(),
          })
          .optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      checkAPIKey();

      let output;

      try {
        // const chat = await openai.createCH
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: input.messages,
          temperature: input.temperature ?? 0.9,
          top_p: input.top_p ?? 1,
          frequency_penalty: input.frequency_penalty ?? 0,
          presence_penalty: input.presence_penalty ?? 0.6,
          stop: input.stop ?? [" Human:", " AI:"],
        });

        const result = completion.data.choices[0]?.message;
        console.log("Result", result);

        if (result) {
          output = result;
        } else {
          return {
            error: {
              message: "Could not read result from OpenAI API",
            },
          };
        }
      } catch (error: unknown) {
        return handleError(error);
      }

      await ctx.prisma.result
        .create({
          data: {
            task: input.task ?? "",
            model: "gpt-3.5-turbo",
            temperature: input.temperature ?? 0.6,
            userPrompt: "",
            fullPrompt: JSON.stringify(input.messages, null, 2),
            result: JSON.stringify(output, null, 2),
            userId: ctx.session?.user.id,
          },
        })
        .catch((error) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError) {
            console.log("Prisma error:", error.message);
          }
        });

      return {
        result: output,
      };
    }),
  tokens: publicProcedure
    .input(z.object({ text: z.string() }))
    .mutation(({ input }) => {
      const encoded = encode(input.text);
      return {
        count: encoded.length,
      };
    }),
});
